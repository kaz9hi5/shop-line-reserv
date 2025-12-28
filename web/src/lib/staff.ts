import type { Database } from "./database.types";
import { callRpc, deleteFromTable, insertIntoTable, selectFromTable, updateTable } from "./admin-db-proxy";

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


