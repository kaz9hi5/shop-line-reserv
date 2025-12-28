import { supabase } from "./supabase";
import type { Database } from "./database.types";
import type { Reservation } from "./reservations";
import { selectFromTable } from "./admin-db-proxy";

type AppSettings = Database["public"]["Tables"]["app_settings"]["Row"];
type BusinessHoursOverride = Database["public"]["Tables"]["business_hours_overrides"]["Row"];

interface BusinessHours {
  openTime: string; // HH:mm
  closeTime: string; // HH:mm
  lunchEnabled: boolean;
  lunchStart?: string; // HH:mm
  lunchEnd?: string; // HH:mm
}

/**
 * Get app settings (via Edge Function)
 */
async function getAppSettings(): Promise<AppSettings> {
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
 * Get business hours for a specific date
 */
export async function getBusinessHoursForDate(date: Date): Promise<BusinessHours> {
  const settings = await getAppSettings();
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

  // Check for override (via Edge Function)
  const overrideData = await selectFromTable<BusinessHoursOverride>("business_hours_overrides", {
    where: { day: dateStr },
    limit: 1
  });
  const override = overrideData && overrideData.length > 0 ? overrideData[0] : null;

  if (override) {
    const overrideTyped = override as BusinessHoursOverride;
    return {
      openTime: overrideTyped.open_time,
      closeTime: overrideTyped.close_time,
      lunchEnabled: overrideTyped.lunch_enabled,
      lunchStart: overrideTyped.lunch_start || undefined,
      lunchEnd: overrideTyped.lunch_end || undefined
    };
  }

  // Use default
  return {
    openTime: settings.default_open_time,
    closeTime: settings.default_close_time,
    lunchEnabled: settings.default_lunch_enabled,
    lunchStart: settings.default_lunch_start || undefined,
    lunchEnd: settings.default_lunch_end || undefined
  };
}

/**
 * Parse time string (HH:mm) to minutes from midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Format minutes from midnight to time string (HH:mm)
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * Check if a time slot is within business hours and not during lunch break
 */
function isTimeSlotAvailable(
  timeMinutes: number,
  businessHours: BusinessHours
): boolean {
  const openMinutes = timeToMinutes(businessHours.openTime);
  const closeMinutes = timeToMinutes(businessHours.closeTime);

  // Check if within business hours
  if (timeMinutes < openMinutes || timeMinutes >= closeMinutes) {
    return false;
  }

  // Check if during lunch break
  if (businessHours.lunchEnabled && businessHours.lunchStart && businessHours.lunchEnd) {
    const lunchStartMinutes = timeToMinutes(businessHours.lunchStart);
    const lunchEndMinutes = timeToMinutes(businessHours.lunchEnd);
    if (timeMinutes >= lunchStartMinutes && timeMinutes < lunchEndMinutes) {
      return false;
    }
  }

  return true;
}

/**
 * Get available time slots for a date
 * Returns time slots that are:
 * - Within business hours
 * - Not during lunch break
 * - Not overlapping with existing reservations
 */
export async function getAvailableTimeSlots(
  date: Date,
  treatmentDurationMinutes: number,
  existingReservations: Reservation[]
): Promise<string[]> {
  const businessHours = await getBusinessHoursForDate(date);
  const openMinutes = timeToMinutes(businessHours.openTime);
  const closeMinutes = timeToMinutes(businessHours.closeTime);

  const availableSlots: string[] = [];
  const intervalMinutes = 15; // Check every 15 minutes

  // Build reservation time ranges
  const reservationRanges = existingReservations.map((r) => {
    const start = new Date(r.start_at);
    const end = new Date(r.end_at);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    return { start: startMinutes, end: endMinutes };
  });

  // Check each time slot
  for (let minutes = openMinutes; minutes < closeMinutes; minutes += intervalMinutes) {
    // Check if slot start is available
    if (!isTimeSlotAvailable(minutes, businessHours)) {
      continue;
    }

    // Calculate slot end time
    const slotEndMinutes = minutes + treatmentDurationMinutes;

    // Check if slot end is within business hours and not during lunch
    if (!isTimeSlotAvailable(slotEndMinutes - 1, businessHours)) {
      continue;
    }

    // Check if slot overlaps with any existing reservation
    const overlaps = reservationRanges.some((range) => {
      return (
        (minutes >= range.start && minutes < range.end) ||
        (slotEndMinutes > range.start && slotEndMinutes <= range.end) ||
        (minutes < range.start && slotEndMinutes > range.end)
      );
    });

    if (!overlaps) {
      availableSlots.push(minutesToTime(minutes));
    }
  }

  return availableSlots;
}

/**
 * Calculate next available time after a reservation
 * Based on: reservation start time + treatment duration
 */
export function calculateNextAvailableTime(
  reservationStartTime: string, // HH:mm
  treatmentDurationMinutes: number
): string {
  const startMinutes = timeToMinutes(reservationStartTime);
  const nextMinutes = startMinutes + treatmentDurationMinutes;
  return minutesToTime(nextMinutes);
}

