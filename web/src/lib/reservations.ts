import { supabase } from "./supabase";
import type { Database } from "./database.types";
import type { AdminReservation } from "@/components/admin/reservationTypes";

type Reservation = Database["public"]["Tables"]["reservations"]["Row"];
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
    name: reservation.customer_name,
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
 * Get reservations for a specific date range
 */
export async function getReservationsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<Reservation[]> {
  const start = startDate.toISOString();
  const end = endDate.toISOString();

  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .gte("start_at", start)
    .lt("start_at", end)
    .is("deleted_at", null)
    .order("start_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch reservations: ${error.message}`);
  }

  return data || [];
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
 * Get a single reservation by ID
 */
export async function getReservationById(id: string): Promise<Reservation | null> {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // Not found
      return null;
    }
    throw new Error(`Failed to fetch reservation: ${error.message}`);
  }

  return data;
}

/**
 * Create a new reservation
 */
export async function createReservation(
  reservation: ReservationInsert
): Promise<Reservation> {
  const { data, error } = await supabase
    .from("reservations")
    .insert(reservation)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create reservation: ${error.message}`);
  }

  return data;
}

/**
 * Create reservation from AdminReservation data
 */
export async function createReservationFromAdmin(
  adminReservation: AdminReservation,
  treatmentId: string,
  lineUserId: string
): Promise<Reservation> {
  const [year, month, day] = adminReservation.dateYmd.split("-").map(Number);
  const [hours, minutes] = adminReservation.time.split(":").map(Number);
  const startAt = new Date(year, month - 1, day, hours, minutes);

  return createReservation({
    customer_name: adminReservation.name,
    line_user_id: lineUserId,
    line_display_name: adminReservation.lineDisplayName || null,
    treatment_id: treatmentId,
    start_at: startAt.toISOString(),
    via: adminReservation.via || "admin"
  });
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
  const { error: deleteError } = await supabase
    .from("reservations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", oldReservationId);

  if (deleteError) {
    throw new Error(`Failed to delete old reservation: ${deleteError.message}`);
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
  const { data, error } = await supabase
    .from("reservations")
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
 * Cancel a reservation (logical delete)
 */
export async function cancelReservation(id: string): Promise<void> {
  // Get reservation to get LINE user ID for counter
  const reservation = await getReservationById(id);
  if (!reservation) {
    throw new Error("Reservation not found");
  }

  const { error } = await supabase
    .from("reservations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to cancel reservation: ${error.message}`);
  }

  // Increment cancel count (import dynamically to avoid circular dependency)
  const { incrementCancelCount } = await import("./counters");
  await incrementCancelCount(reservation.line_user_id);
}

/**
 * Mark reservation as arrived and reset counters
 */
export async function markReservationArrived(reservationId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_arrived_and_reset_counts", {
    p_reservation_id: reservationId
  });

  if (error) {
    throw new Error(`Failed to mark reservation as arrived: ${error.message}`);
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

