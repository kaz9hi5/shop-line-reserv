import { supabase } from "./supabase";
import type { Database } from "./database.types";
import type { AdminReservation } from "@/components/admin/reservationTypes";
import { selectFromTable, insertIntoTable, updateTable, deleteFromTable, callRpc } from "./admin-db-proxy";

type LineUser = Database["public"]["Tables"]["line_users"]["Row"];

export type Reservation = Database["public"]["Tables"]["reservations"]["Row"];
type ReservationInsert = Database["public"]["Tables"]["reservations"]["Insert"];
type ReservationUpdate = Database["public"]["Tables"]["reservations"]["Update"];

/**
 * Convert Supabase Reservation to AdminReservation
 */
export function toAdminReservation(reservation: Reservation): AdminReservation {
  const startDate = new Date(reservation.start_at);
  const year = startDate.getFullYear();
  const month = String(startDate.getMonth() + 1).padStart(2, "0");
  const day = String(startDate.getDate()).padStart(2, "0");
  const dateYmd = `${year}-${month}-${day}`;

  const hours = String(startDate.getHours()).padStart(2, "0");
  const minutes = String(startDate.getMinutes()).padStart(2, "0");
  const time = `${hours}:${minutes}`;

  return {
    id: reservation.id,
    dateYmd,
    time,
    name: reservation.user_name,
    lineUserId: reservation.line_user_id,
    lineDisplayName: reservation.line_display_name || undefined,
    menu: reservation.treatment_name_snapshot || "—",
    durationMinutes: reservation.treatment_duration_minutes_snapshot,
    priceYen: reservation.treatment_price_yen_snapshot,
    via: reservation.via === "phone" ? "phone" : reservation.via === "admin" ? "admin" : "web",
    arrivedAt: reservation.arrived_at || undefined
  };
}

/**
 * Get reservations for a specific date range (via Edge Function)
 */
export async function getReservationsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<Reservation[]> {
  const start = startDate.toISOString();
  const end = endDate.toISOString();

  try {
    const data = await selectFromTable<Reservation>("reservations", {
      where: {
        deleted_at: null
      },
      order: { column: "start_at", ascending: true }
    });

    // Filter by date range (Edge Function doesn't support complex where conditions yet)
    return (data || []).filter((r) => {
      const startAt = new Date(r.start_at);
      return startAt >= startDate && startAt < endDate;
    });
  } catch (error) {
    throw new Error(`Failed to fetch reservations: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get reservations for a specific date (YYYY-MM-DD)
 */
export async function getReservationsByDate(date: Date): Promise<Reservation[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return getReservationsByDateRange(startOfDay, endOfDay);
}

/**
 * Get AdminReservations for a specific date
 */
export async function getAdminReservationsByDate(date: Date): Promise<AdminReservation[]> {
  const reservations = await getReservationsByDate(date);
  return reservations.map(toAdminReservation);
}

/**
 * Get a single reservation by ID (via Edge Function)
 */
export async function getReservationById(id: string): Promise<Reservation | null> {
  try {
    const data = await selectFromTable<Reservation>("reservations", {
      where: { id, deleted_at: null },
      limit: 1
    });
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    // If error occurs, assume not found
    return null;
  }
}

/**
 * Create a new reservation (via Edge Function)
 */
export async function createReservation(
  reservation: ReservationInsert
): Promise<Reservation> {
  console.log("[createReservation] Called with:", reservation);
  try {
    console.log("[createReservation] Calling insertIntoTable");
    const data = await insertIntoTable<Reservation>("reservations", reservation);
    console.log("[createReservation] insertIntoTable completed:", data);
    return data;
  } catch (error) {
    console.error("[createReservation] Error:", error);
    throw new Error(`Failed to create reservation: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Create reservation from AdminReservation data
 */
export async function createReservationFromAdmin(
  adminReservation: AdminReservation,
  treatmentId: string,
  lineUserId: string
): Promise<Reservation> {
  console.log("[createReservationFromAdmin] Called", { adminReservation, treatmentId, lineUserId });
  const [year, month, day] = adminReservation.dateYmd.split("-").map(Number);
  const [hours, minutes] = adminReservation.time.split(":").map(Number);
  const startAt = new Date(year, month - 1, day, hours, minutes);

  const reservationData = {
    user_name: adminReservation.name,
    line_user_id: lineUserId,
    line_display_name: adminReservation.lineDisplayName || null,
    treatment_id: treatmentId,
    start_at: startAt.toISOString(),
    via: adminReservation.via || "admin"
  };
  console.log("[createReservationFromAdmin] Calling createReservation with:", reservationData);
  
  try {
    const result = await createReservation(reservationData);
    console.log("[createReservationFromAdmin] createReservation completed:", result);
    return result;
  } catch (err) {
    console.error("[createReservationFromAdmin] createReservation error:", err);
    throw err;
  }
}

/**
 * Update reservation (change): logical delete old + create new
 */
export async function changeReservation(
  oldReservationId: string,
  newReservation: AdminReservation,
  treatmentId: string,
  lineUserId: string
): Promise<Reservation> {
  // Get old reservation to get LINE user ID
  const oldReservation = await getReservationById(oldReservationId);
  if (!oldReservation) {
    throw new Error("Old reservation not found");
  }

  // Logical delete old reservation (without incrementing cancel count)
  try {
    await updateTable("reservations", {
      deleted_at: new Date().toISOString()
    }, { id: oldReservationId });
  } catch (error) {
    throw new Error(`Failed to delete old reservation: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  // Create new reservation
  const newRes = await createReservationFromAdmin(newReservation, treatmentId, lineUserId);

  // Increment change count (not cancel count)
  const { incrementChangeCount } = await import("./counters");
  await incrementChangeCount(oldReservation.line_user_id);

  return newRes;
}

/**
 * Update a reservation (logical delete + create new for changes)
 */
export async function updateReservation(
  id: string,
  updates: ReservationUpdate
): Promise<Reservation> {
  const { data, error } = await (supabase
    .from("reservations") as any)
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update reservation: ${error.message}`);
  }

  return data;
}

/**
 * Cancel a reservation (logical delete via Edge Function)
 */
export async function cancelReservation(id: string): Promise<void> {
  // Get reservation to get LINE user ID for counter
  const reservation = await getReservationById(id);
  if (!reservation) {
    throw new Error("Reservation not found");
  }

  try {
    await updateTable("reservations", {
      deleted_at: new Date().toISOString()
    }, { id });

    // Increment cancel count (import dynamically to avoid circular dependency)
    const { incrementCancelCount } = await import("./counters");
    await incrementCancelCount(reservation.line_user_id);
  } catch (error) {
    throw new Error(`Failed to cancel reservation: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Mark reservation as arrived and reset counters (via Edge Function)
 */
export async function markReservationArrived(reservationId: string): Promise<void> {
  try {
    await callRpc("mark_arrived_and_reset_counts", {
      p_reservation_id: reservationId
    });
  } catch (error) {
    throw new Error(`Failed to mark reservation as arrived: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get reservations with reserved dates for calendar display
 */
export async function getReservedDates(
  year: number,
  month: number
): Promise<Set<string>> {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const reservations = await getReservationsByDateRange(startDate, endDate);

  const dates = new Set<string>();
  for (const reservation of reservations) {
    const date = new Date(reservation.start_at);
    const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    dates.add(ymd);
  }

  return dates;
}

/**
 * Search LINE user IDs and related information from line_users table
 * Used for autocomplete/search in admin reservation creation
 */
export async function searchLineUsers(query: string): Promise<Array<{
  lineUserId: string;
  name: string;
  lineDisplayName?: string;
  lastReservationDate?: string;
}>> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    // Get all LINE users from line_users table
    const lineUsers = await selectFromTable<LineUser>("line_users", {
      where: {
        is_friend: true
      },
      order: { column: "created_at", ascending: false },
      limit: 1000
    });

    const queryLower = query.toLowerCase().trim();
    const matches: Array<{
      lineUserId: string;
      name: string;
      lineDisplayName?: string;
      lastReservationDate?: string;
    }> = [];

    // Search by name or line display name
    for (const lineUser of lineUsers) {
      const matchesQuery =
        lineUser.name?.toLowerCase().includes(queryLower) ||
        lineUser.line_display_name?.toLowerCase().includes(queryLower);

      if (matchesQuery) {
        // Get last reservation date if exists
        const reservations = await selectFromTable<Reservation>("reservations", {
          where: {
            line_user_id: lineUser.line_user_id,
            deleted_at: null
          },
          order: { column: "start_at", ascending: false },
          limit: 1
        });

        matches.push({
          lineUserId: lineUser.line_user_id,
          name: lineUser.name || "",
          lineDisplayName: lineUser.line_display_name || undefined,
          lastReservationDate: reservations.length > 0
            ? new Date(reservations[0].start_at).toISOString().split("T")[0]
            : undefined
        });
      }
    }

    // Return up to 10 matches, sorted by last reservation date (most recent first)
    return matches
      .sort((a, b) => {
        if (!a.lastReservationDate) return 1;
        if (!b.lastReservationDate) return -1;
        return b.lastReservationDate.localeCompare(a.lastReservationDate);
      })
      .slice(0, 10);
  } catch (error) {
    console.error("Failed to search LINE users:", error);
    return [];
  }
}

