import { supabase } from "./supabase";
import type { Database } from "./database.types";

type AccessLog = Database["public"]["Tables"]["admin_access_logs"]["Row"];
type AccessLogInsert = Database["public"]["Tables"]["admin_access_logs"]["Insert"];
type AdminAllowedIp = Database["public"]["Tables"]["admin_allowed_ips"]["Row"];
type AdminAllowedIpInsert = Database["public"]["Tables"]["admin_allowed_ips"]["Insert"];

/**
 * Log admin access attempt
 */
export async function logAdminAccess(
  log: AccessLogInsert
): Promise<AccessLog> {
  const { data, error } = await supabase
    .from("admin_access_logs")
    .insert(log)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to log admin access: ${error.message}`);
  }

  return data;
}

/**
 * Get access logs with filters
 */
export async function getAccessLogs(
  options?: {
    startDate?: Date;
    endDate?: Date;
    ip?: string;
    result?: "allowed" | "denied";
    limit?: number;
  }
): Promise<AccessLog[]> {
  let query = supabase.from("admin_access_logs").select("*");

  if (options?.startDate) {
    query = query.gte("created_at", options.startDate.toISOString());
  }
  if (options?.endDate) {
    query = query.lte("created_at", options.endDate.toISOString());
  }
  if (options?.ip) {
    query = query.eq("ip", options.ip);
  }
  if (options?.result) {
    query = query.eq("result", options.result);
  }

  query = query.order("created_at", { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch access logs: ${error.message}`);
  }

  return data || [];
}

/**
 * Get allowed IPs
 */
export async function getAllowedIps(): Promise<AdminAllowedIp[]> {
  const { data, error } = await supabase
    .from("admin_allowed_ips")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch allowed IPs: ${error.message}`);
  }

  return data || [];
}

/**
 * Add allowed IP
 */
export async function addAllowedIp(ip: string): Promise<AdminAllowedIp> {
  // Check if IP already exists (even if deleted)
  const { data: existing } = await supabase
    .from("admin_allowed_ips")
    .select("*")
    .eq("ip", ip)
    .single();

  if (existing) {
    // If deleted, restore it
    if (existing.deleted_at) {
      const { data, error } = await supabase
        .from("admin_allowed_ips")
        .update({ deleted_at: null })
        .eq("ip", ip)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to restore allowed IP: ${error.message}`);
      }

      return data;
    }
    // Already exists and active
    return existing;
  }

  // Create new
  const { data, error } = await supabase
    .from("admin_allowed_ips")
    .insert({ ip })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add allowed IP: ${error.message}`);
  }

  return data;
}

/**
 * Remove allowed IP (logical delete)
 */
export async function removeAllowedIp(ip: string): Promise<void> {
  const { error } = await supabase
    .from("admin_allowed_ips")
    .update({ deleted_at: new Date().toISOString() })
    .eq("ip", ip);

  if (error) {
    throw new Error(`Failed to remove allowed IP: ${error.message}`);
  }
}

/**
 * Check if IP is allowed
 */
export async function isIpAllowed(ip: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("admin_allowed_ips")
    .select("*")
    .eq("ip", ip)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return false; // Not found = not allowed
    }
    throw new Error(`Failed to check IP: ${error.message}`);
  }

  return !!data;
}

/**
 * Get access log enabled setting
 */
export async function isAccessLogEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("admin_access_log_enabled")
    .eq("id", true)
    .single();

  if (error) {
    throw new Error(`Failed to fetch access log setting: ${error.message}`);
  }

  return data?.admin_access_log_enabled ?? true;
}

/**
 * Set access log enabled setting
 */
export async function setAccessLogEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .update({ admin_access_log_enabled: enabled })
    .eq("id", true);

  if (error) {
    throw new Error(`Failed to update access log setting: ${error.message}`);
  }
}

