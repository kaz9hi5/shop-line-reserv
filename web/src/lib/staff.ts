import type { Database } from "./database.types";
import { callRpc, deleteFromTable, insertIntoTable, selectFromTable, updateTable } from "./admin-db-proxy";
import { getClientIp } from "./ip-detection";

export type StaffRow = Database["public"]["Tables"]["staff"]["Row"];
export type StaffInsert = Database["public"]["Tables"]["staff"]["Insert"];
export type StaffUpdate = Database["public"]["Tables"]["staff"]["Update"];

export async function getActiveStaff(): Promise<StaffRow[]> {
  const rows = await selectFromTable<StaffRow>("staff", {
    where: { deleted_at: null },
    order: { column: "created_at", ascending: true }
  });
  return rows || [];
}

export async function createStaff(name: string): Promise<StaffRow> {
  const row = await insertIntoTable<StaffRow>("staff", {
    name,
    role: "staff"
  } satisfies StaffInsert);
  return row;
}

export async function updateStaffName(id: string, name: string): Promise<StaffRow> {
  const rows = await updateTable<StaffRow>("staff", { name } satisfies StaffUpdate, { id });
  if (!rows?.length) throw new Error("Failed to update staff");
  return rows[0];
}

/**
 * Logical delete staff.
 * Edge Function also performs cascading physical deletes for:
 * business_days / business_hours_overrides (staff_id match)
 */
export async function deleteStaff(id: string): Promise<void> {
  await deleteFromTable("staff", { id });
}

export async function verifyManagerName(name: string): Promise<boolean> {
  const ok = await callRpc<boolean>("verify_manager_name", { p_name: name });
  return ok === true;
}

export async function gateAddAllowedIp(params: {
  ip: string;
  managerName: string;
  deviceFingerprint: string;
}): Promise<boolean> {
  const ok = await callRpc<boolean>("gate_add_allowed_ip", {
    p_ip: params.ip,
    p_manager_name: params.managerName,
    p_device_fingerprint: params.deviceFingerprint
  });
  return ok === true;
}

/**
 * Get current user's staff ID
 * For manager: returns manager's staff ID from staff table
 * For staff: returns staff_id from admin_allowed_ips (if linked) or throws error
 */
export async function getCurrentStaffId(): Promise<string> {
  // First, get current role
  const { getCurrentRole } = await import("./admin-db-proxy");
  const role = await getCurrentRole();

  if (role === "unauthorized") {
    throw new Error("Unauthorized access");
  }

  if (role === "manager") {
    // For manager, get manager's staff ID from staff table
    const managers = await selectFromTable<StaffRow>("staff", {
      where: { role: "manager", deleted_at: null },
      limit: 1
    });
    if (!managers || managers.length === 0) {
      throw new Error("Manager staff record not found");
    }
    return managers[0].id;
  }

  // For staff, get staff_id from admin_allowed_ips using current IP
  const { getClientIp } = await import("./ip-detection");
  const currentIp = await getClientIp();
  
  type AdminAllowedIp = Database["public"]["Tables"]["admin_allowed_ips"]["Row"];
  const allowedIps = await selectFromTable<AdminAllowedIp>("admin_allowed_ips", {
    where: { ip: currentIp },
    limit: 1
  });
  
  if (!allowedIps || allowedIps.length === 0) {
    throw new Error("Current IP not found in allowed IPs list");
  }
  
  const allowedIp = allowedIps[0];
  
  // If staff_id is linked, use it
  if (allowedIp.staff_id) {
    return allowedIp.staff_id;
  }
  
  // If staff_id is not linked, get first staff record as fallback
  // Note: This is a fallback. Ideally, staff_id should be linked in admin_allowed_ips
  const staffRecords = await selectFromTable<StaffRow>("staff", {
    where: { role: "staff", deleted_at: null },
    order: { column: "created_at", ascending: true },
    limit: 1
  });
  
  if (!staffRecords || staffRecords.length === 0) {
    throw new Error("Staff record not found. Please link your IP to a staff member in IP management.");
  }
  
  return staffRecords[0].id;
}


