import { supabase } from "./supabase";
import type { Database } from "./database.types";
import { callRpc, selectFromTable, insertIntoTable, deleteFromTable } from "./admin-db-proxy";
import { generateDeviceFingerprint } from "./device-fingerprint";

type AdminAllowedIp = Database["public"]["Tables"]["admin_allowed_ips"]["Row"];

/**
 * Get allowed IPs (via Edge Function)
 */
export async function getAllowedIps(): Promise<AdminAllowedIp[]> {
  try {
    const data = await selectFromTable<AdminAllowedIp>("admin_allowed_ips", {
      order: { column: "created_at", ascending: false }
    });
    return data || [];
  } catch (error) {
    throw new Error(`Failed to fetch allowed IPs: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Add allowed IP (via Edge Function)
 */
export async function addAllowedIp(ip: string, deviceFingerprint?: string): Promise<AdminAllowedIp> {
  try {
    // Check if IP already exists
    const existing = await selectFromTable<AdminAllowedIp>("admin_allowed_ips", {
      where: { ip },
      limit: 1
    });

    if (existing && existing.length > 0) {
      // Already exists
      return existing[0];
    }

    // Create new
    const newRecord = await insertIntoTable<AdminAllowedIp>("admin_allowed_ips", {
      ip,
      device_fingerprint: deviceFingerprint || null,
    });

    return newRecord;
  } catch (error) {
    throw new Error(`Failed to add allowed IP: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Remove allowed IP (physical delete via Edge Function)
 */
export async function removeAllowedIp(ip: string): Promise<void> {
  try {
    await deleteFromTable("admin_allowed_ips", { ip });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    // ホワイトリストがnullになった場合（Unauthorizedエラー）は特別なエラーとして再スロー
    if (errorMsg.includes("Unauthorized")) {
      const unauthorizedError = new Error("Unauthorized");
      (unauthorizedError as any).isUnauthorized = true;
      throw unauthorizedError;
    }
    throw new Error(`Failed to remove allowed IP: ${errorMsg}`);
  }
}

/**
 * Check if IP is allowed (via Edge Function)
 */
export async function isIpAllowed(ip: string): Promise<boolean> {
  try {
    const ok = await callRpc<boolean>("is_admin_ip_allowed", {
      p_ip: ip,
      p_device_fingerprint: generateDeviceFingerprint()
    });
    return ok === true;
  } catch (error) {
    // If error occurs, assume not allowed
    return false;
  }
}
