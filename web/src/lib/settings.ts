import { supabase } from "./supabase";
import type { Database } from "./database.types";

type AppSettings = Database["public"]["Tables"]["app_settings"]["Row"];
type AppSettingsUpdate = Database["public"]["Tables"]["app_settings"]["Update"];
type BusinessDay = Database["public"]["Tables"]["business_days"]["Row"];
type BusinessDayInsert = Database["public"]["Tables"]["business_days"]["Insert"];
type BusinessDayUpdate = Database["public"]["Tables"]["business_days"]["Update"];
type BusinessHoursOverride = Database["public"]["Tables"]["business_hours_overrides"]["Row"];
type BusinessHoursOverrideInsert = Database["public"]["Tables"]["business_hours_overrides"]["Insert"];
type BusinessHoursOverrideUpdate = Database["public"]["Tables"]["business_hours_overrides"]["Update"];

/**
 * Get app settings
 */
export async function getAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", true)
    .single();

  if (error) {
    throw new Error(`Failed to fetch app settings: ${error.message}`);
  }

  if (!data) {
    throw new Error("App settings not found");
  }

  return data;
}

/**
 * Update app settings
 */
export async function updateAppSettings(
  updates: AppSettingsUpdate
): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .update(updates)
    .eq("id", true)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update app settings: ${error.message}`);
  }

  return data;
}

/**
 * Get business days for a date range
 */
export async function getBusinessDays(
  startDate: Date,
  endDate: Date
): Promise<BusinessDay[]> {
  const start = startDate.toISOString().split("T")[0];
  const end = endDate.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("business_days")
    .select("*")
    .gte("day", start)
    .lte("day", end)
    .order("day", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch business days: ${error.message}`);
  }

  return data || [];
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
 * Upsert business day (insert or update)
 */
export async function upsertBusinessDay(
  day: string, // YYYY-MM-DD
  status: "open" | "holiday" | "closed"
): Promise<BusinessDay> {
  const { data, error } = await supabase
    .from("business_days")
    .upsert(
      {
        day,
        status
      },
      {
        onConflict: "day"
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert business day: ${error.message}`);
  }

  return data;
}

/**
 * Delete business day (remove from table)
 */
export async function deleteBusinessDay(day: string): Promise<void> {
  const { error } = await supabase.from("business_days").delete().eq("day", day);

  if (error) {
    throw new Error(`Failed to delete business day: ${error.message}`);
  }
}

/**
 * Get business hours override for a date
 */
export async function getBusinessHoursOverride(
  day: string // YYYY-MM-DD
): Promise<BusinessHoursOverride | null> {
  const { data, error } = await supabase
    .from("business_hours_overrides")
    .select("*")
    .eq("day", day)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to fetch business hours override: ${error.message}`);
  }

  return data;
}

/**
 * Get business hours overrides for a date range
 */
export async function getBusinessHoursOverrides(
  startDate: Date,
  endDate: Date
): Promise<BusinessHoursOverride[]> {
  const start = startDate.toISOString().split("T")[0];
  const end = endDate.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("business_hours_overrides")
    .select("*")
    .gte("day", start)
    .lte("day", end)
    .order("day", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch business hours overrides: ${error.message}`);
  }

  return data || [];
}

/**
 * Upsert business hours override
 */
export async function upsertBusinessHoursOverride(
  override: BusinessHoursOverrideInsert
): Promise<BusinessHoursOverride> {
  const { data, error } = await supabase
    .from("business_hours_overrides")
    .upsert(override, {
      onConflict: "day"
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert business hours override: ${error.message}`);
  }

  return data;
}

/**
 * Delete business hours override
 */
export async function deleteBusinessHoursOverride(day: string): Promise<void> {
  const { error } = await supabase
    .from("business_hours_overrides")
    .delete()
    .eq("day", day);

  if (error) {
    throw new Error(`Failed to delete business hours override: ${error.message}`);
  }
}

