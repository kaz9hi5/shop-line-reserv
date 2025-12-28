import { supabase } from "./supabase";
import type { Database } from "./database.types";
import { selectFromTable, insertIntoTable, updateTable, deleteFromTable } from "./admin-db-proxy";

type AppSettings = Database["public"]["Tables"]["app_settings"]["Row"];
type AppSettingsUpdate = Database["public"]["Tables"]["app_settings"]["Update"];
type BusinessDay = Database["public"]["Tables"]["business_days"]["Row"];
type BusinessDayInsert = Database["public"]["Tables"]["business_days"]["Insert"];
type BusinessDayUpdate = Database["public"]["Tables"]["business_days"]["Update"];
type BusinessHoursOverride = Database["public"]["Tables"]["business_hours_overrides"]["Row"];
type BusinessHoursOverrideInsert = Database["public"]["Tables"]["business_hours_overrides"]["Insert"];
type BusinessHoursOverrideUpdate = Database["public"]["Tables"]["business_hours_overrides"]["Update"];

/**
 * Get app settings (via Edge Function)
 */
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const data = await selectFromTable<AppSettings>("app_settings", {
      where: { id: true },
      limit: 1
    });
    
    if (!data || data.length === 0) {
      throw new Error("App settings not found");
    }

    return data[0];
  } catch (error) {
    throw new Error(`Failed to fetch app settings: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Update app settings (via Edge Function)
 */
export async function updateAppSettings(
  updates: AppSettingsUpdate
): Promise<AppSettings> {
  try {
    const data = await updateTable<AppSettings>("app_settings", updates, { id: true });
    return data[0];
  } catch (error) {
    throw new Error(`Failed to update app settings: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get business days for a date range (via Edge Function)
 */
export async function getBusinessDays(
  startDate: Date,
  endDate: Date
): Promise<BusinessDay[]> {
  try {
    const data = await selectFromTable<BusinessDay>("business_days", {
      order: { column: "day", ascending: true }
    });

    // Filter by date range (Edge Function doesn't support gte/lte yet)
    const start = startDate.toISOString().split("T")[0];
    const end = endDate.toISOString().split("T")[0];
    
    return (data || []).filter((day) => {
      const dayStr = day.day;
      return dayStr >= start && dayStr <= end;
    });
  } catch (error) {
    throw new Error(`Failed to fetch business days: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get business days for a week (Monday to Sunday)
 */
export async function getBusinessDaysForWeek(weekStart: Date): Promise<BusinessDay[]> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return getBusinessDays(weekStart, weekEnd);
}

/**
 * Upsert business day (insert or update via Edge Function)
 */
export async function upsertBusinessDay(
  day: string, // YYYY-MM-DD
  status: "open" | "holiday" | "closed"
): Promise<BusinessDay> {
  try {
    // Check if exists
    const existing = await selectFromTable<BusinessDay>("business_days", {
      where: { day },
      limit: 1
    });

    if (existing && existing.length > 0) {
      // Update existing
      const updated = await updateTable<BusinessDay>("business_days", { status }, { day });
      return updated[0];
    } else {
      // Insert new
      const inserted = await insertIntoTable<BusinessDay>("business_days", { day, status });
      return inserted;
    }
  } catch (error) {
    throw new Error(`Failed to upsert business day: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Delete business day (remove from table via Edge Function)
 * If the record doesn't exist, it's treated as success (idempotent operation)
 */
export async function deleteBusinessDay(day: string): Promise<void> {
  try {
    await deleteFromTable("business_days", { day });
  } catch (error) {
    // If the error indicates the record doesn't exist, treat it as success
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("No rows") || errorMessage.includes("not found") || errorMessage.includes("PGRST116")) {
      // Record doesn't exist - this is fine, deletion is idempotent
      return;
    }
    throw new Error(`Failed to delete business day: ${errorMessage}`);
  }
}

/**
 * Get business hours override for a date (via Edge Function)
 */
export async function getBusinessHoursOverride(
  day: string // YYYY-MM-DD
): Promise<BusinessHoursOverride | null> {
  try {
    const data = await selectFromTable<BusinessHoursOverride>("business_hours_overrides", {
      where: { day },
      limit: 1
    });
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    // If error occurs, assume not found
    return null;
  }
}

/**
 * Get business hours overrides for a date range (via Edge Function)
 */
export async function getBusinessHoursOverrides(
  startDate: Date,
  endDate: Date
): Promise<BusinessHoursOverride[]> {
  try {
    const data = await selectFromTable<BusinessHoursOverride>("business_hours_overrides", {
      order: { column: "day", ascending: true }
    });

    // Filter by date range (Edge Function doesn't support gte/lte yet)
    const start = startDate.toISOString().split("T")[0];
    const end = endDate.toISOString().split("T")[0];
    
    return (data || []).filter((override) => {
      const dayStr = override.day;
      return dayStr >= start && dayStr <= end;
    });
  } catch (error) {
    throw new Error(`Failed to fetch business hours overrides: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Upsert business hours override (via Edge Function)
 */
export async function upsertBusinessHoursOverride(
  override: BusinessHoursOverrideInsert
): Promise<BusinessHoursOverride> {
  try {
    // Check if exists
    const existing = await selectFromTable<BusinessHoursOverride>("business_hours_overrides", {
      where: { day: override.day },
      limit: 1
    });

    if (existing && existing.length > 0) {
      // Update existing
      const updated = await updateTable<BusinessHoursOverride>("business_hours_overrides", override, { day: override.day });
      return updated[0];
    } else {
      // Insert new
      const inserted = await insertIntoTable<BusinessHoursOverride>("business_hours_overrides", override);
      return inserted;
    }
  } catch (error) {
    throw new Error(`Failed to upsert business hours override: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Delete business hours override (via Edge Function)
 * If the record doesn't exist, it's treated as success (idempotent operation)
 */
export async function deleteBusinessHoursOverride(day: string): Promise<void> {
  try {
    await deleteFromTable("business_hours_overrides", { day });
  } catch (error) {
    // If error is about no rows being affected, treat as success (idempotent)
    const errorMsg = error instanceof Error ? error.message.toLowerCase() : "";
    if (errorMsg.includes("no rows") || errorMsg.includes("not found") || errorMsg.includes("pgrst116")) {
      // No rows to delete is fine - treat as success
      return;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("No rows") || errorMessage.includes("not found") || errorMessage.includes("PGRST116")) {
      // Record doesn't exist - this is fine, deletion is idempotent
      return;
    }
    throw new Error(`Failed to delete business hours override: ${errorMessage}`);
  }
}

