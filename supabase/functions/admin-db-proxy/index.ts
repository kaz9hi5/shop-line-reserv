// Deno types are available at runtime in Supabase Edge Functions
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

import { corsHeaders } from "../_shared/cors.ts";
// @ts-ignore: ESM module import is available at runtime in Deno
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Generate device fingerprint from User-Agent and other headers
 */
function generateDeviceFingerprint(req: Request): string {
  const userAgent = req.headers.get("user-agent") || "";
  const acceptLanguage = req.headers.get("accept-language") || "";
  const acceptEncoding = req.headers.get("accept-encoding") || "";
  
  // Simple fingerprint: combine User-Agent, Accept-Language, Accept-Encoding
  // In production, you might want to use a more sophisticated fingerprinting library
  const fingerprint = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;
  
  // Hash the fingerprint (simple hash for demo, use crypto.subtle in production)
  // For now, return a base64 encoded version
  return btoa(fingerprint).substring(0, 64);
}

/**
 * Get client IP from request headers
 */
function getClientIp(req: Request): string {
  // Check various headers for IP address
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  
  // Fallback: try to get from request URL or use a default
  return "unknown";
}

type RequestBody = {
  operation: "select" | "insert" | "update" | "delete" | "rpc";
  table?: string;
  function_name?: string;
  query?: {
    select?: string;
    where?: Record<string, any>;
    order?: { column: string; ascending: boolean };
    limit?: number;
  };
  data?: Record<string, any>;
  updates?: Record<string, any>;
  rpc_params?: Record<string, any>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const payload = (await req.json()) as RequestBody;
    const { operation, table, function_name, query, data, updates, rpc_params } = payload;

    // Get device information
    const deviceFingerprint = generateDeviceFingerprint(req);
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "";

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check device role from admin_allowed_ips table
    // Role is determined from staff.role when staff_id is linked
    const { data: allowedIp, error: ipError } = await supabase
      .from("admin_allowed_ips")
      .select("device_fingerprint, staff_id")
      // IMPORTANT: Access is IP-allowlist based (fingerprint is stored/updated but does not grant access).
      .eq("ip", clientIp)
      .maybeSingle();

    if (ipError) {
      console.error("Error checking allowed IP:", ipError);
    }

    // Role is sourced from staff.role when staff_id is linked
    let role: string | null = null;
    if (allowedIp?.staff_id) {
      // Get role from staff table
      const { data: staff, error: staffError } = await supabase
        .from("staff")
        .select("role")
        .eq("id", allowedIp.staff_id)
        .is("deleted_at", null)
        .maybeSingle();
      
      if (staffError) {
        console.error("Error checking staff role:", staffError);
      } else if (staff?.role) {
        role = staff.role;
      }
    }
    
    const isManager = role === "manager";
    const isStaff = role === "staff";
    const isUnauthorized = !isManager && !isStaff;

    // Set session variables using PostgreSQL session variables
    // Note: This requires a custom function in PostgreSQL to set session variables
    // For now, we'll pass role information in the response and handle RLS in the Edge Function

    // Execute database operation based on role permissions
    let result: any;
    let error: any = null;

    // Tables without deleted_at column (physical delete only)
    const tablesWithoutDeletedAt = [
      "app_settings",
      "admin_allowed_ips",
      "treatments",
      "business_days",
      "business_hours_overrides",
      "customer_action_counters"
    ];

    try {
      switch (operation) {
        case "select":
          if (!table) {
            throw new Error("table is required for select operation");
          }

          if (isUnauthorized) {
            throw new Error("Unauthorized");
          }
          
          // Check permissions: staff can only select from reservations, business_days, and business_hours_overrides
          if (isStaff && !["reservations", "business_days", "business_hours_overrides"].includes(table)) {
            throw new Error(`Staff can only select from reservations, business_days, and business_hours_overrides tables. Attempted to access: ${table}`);
          }

          // Manager-only tables
          if (!isManager && ["staff"].includes(table)) {
            throw new Error(`Only manager can access table: ${table}`);
          }
          
          let selectQuery = supabase.from(table).select(query?.select || "*");
          
          // Apply where conditions
          // Note: For tables without deleted_at, filter out deleted_at from where conditions
          const effectiveWhere: Record<string, any> = { ...(query?.where || {}) };

          if (Object.keys(effectiveWhere).length) {
            for (const [key, value] of Object.entries(effectiveWhere)) {
              // Skip deleted_at condition for tables that don't have this column
              if (key === "deleted_at" && tablesWithoutDeletedAt.includes(table)) {
                continue;
              }
              if (value === null) {
                selectQuery = selectQuery.is(key, null);
              } else if (Array.isArray(value)) {
                selectQuery = selectQuery.in(key, value);
              } else {
                selectQuery = selectQuery.eq(key, value);
              }
            }
          }
          
          // Apply order
          if (query?.order) {
            selectQuery = selectQuery.order(query.order.column, { 
              ascending: query.order.ascending 
            });
          }
          
          // Apply limit
          if (query?.limit) {
            selectQuery = selectQuery.limit(query.limit);
          }
          
          const { data: selectData, error: selectError } = await selectQuery;
          result = selectData;
          error = selectError;
          break;

        case "insert":
          if (!table || !data) {
            throw new Error("table and data are required for insert operation");
          }

          if (isUnauthorized) {
            throw new Error("Unauthorized");
          }
          
          // Check permissions: staff can insert into reservations, business_days, and business_hours_overrides
          if (isStaff && !["reservations", "business_days", "business_hours_overrides"].includes(table)) {
            throw new Error("Staff can only insert into reservations, business_days, and business_hours_overrides tables");
          }

          if (!isManager && ["staff"].includes(table)) {
            throw new Error(`Only manager can insert into table: ${table}`);
          }

          const insertDataPayload = { ...data };
          const { data: insertData, error: insertError } = await supabase
            .from(table)
            .insert(insertDataPayload)
            .select();
          result = insertData;
          error = insertError;
          break;

        case "update":
          if (!table || !updates) {
            throw new Error("table and updates are required for update operation");
          }

          if (isUnauthorized) {
            throw new Error("Unauthorized");
          }
          
          // Check permissions: staff can update reservations, business_days, and business_hours_overrides
          if (isStaff && !["reservations", "business_days", "business_hours_overrides"].includes(table)) {
            throw new Error("Staff can only update reservations, business_days, and business_hours_overrides tables");
          }

          if (!isManager && ["staff"].includes(table)) {
            throw new Error(`Only manager can update table: ${table}`);
          }
          
          // Remove deleted_at from updates if table doesn't have this column
          const filteredUpdates = { ...updates };
          if (tablesWithoutDeletedAt.includes(table) && "deleted_at" in filteredUpdates) {
            delete filteredUpdates.deleted_at;
          }
          
          let updateQuery = supabase.from(table).update(filteredUpdates);
          
          // Apply where conditions
          // Note: For tables without deleted_at, filter out deleted_at from where conditions
          const updateWhere: Record<string, any> = { ...(query?.where || {}) };

          if (Object.keys(updateWhere).length) {
            for (const [key, value] of Object.entries(updateWhere)) {
              // Skip deleted_at condition for tables that don't have this column
              if (key === "deleted_at" && tablesWithoutDeletedAt.includes(table)) {
                continue;
              }
              if (value === null) {
                updateQuery = updateQuery.is(key, null);
              } else if (Array.isArray(value)) {
                updateQuery = updateQuery.in(key, value);
              } else {
                updateQuery = updateQuery.eq(key, value);
              }
            }
          }
          
          const { data: updateData, error: updateError } = await updateQuery.select();
          result = updateData;
          error = updateError;
          break;

        case "delete":
          if (!table) {
            throw new Error("table is required for delete operation");
          }

          // admin_allowed_ips deletion is manager-only
          // Check this BEFORE isUnauthorized check, because the IP being deleted might not be in the allowlist
          if (table === "admin_allowed_ips") {
            // For admin_allowed_ips deletion, we need to check if the requester is a manager
            // by checking if their current IP/device is in the allowlist with manager role
            if (!isManager) {
              throw new Error("Only manager can delete admin_allowed_ips");
            }
            // Skip isUnauthorized check for admin_allowed_ips deletion
            // (the IP being deleted might not be in the allowlist, but the requester must be a manager)
          } else {
            // For other tables, check isUnauthorized first
            if (isUnauthorized) {
              throw new Error("Unauthorized");
            }
          }
          
          // Check permissions: staff can delete from reservations, business_days, and business_hours_overrides
          if (isStaff && !["reservations", "business_days", "business_hours_overrides"].includes(table)) {
            throw new Error("Staff can only delete from reservations, business_days, and business_hours_overrides tables");
          }
          
          // Check if table has deleted_at column (for logical delete)
          // Logical delete tables: reservations, staff
          const tablesWithLogicalDelete = ["reservations", "staff"];
          const useLogicalDelete = tablesWithLogicalDelete.includes(table);
          
          // For tables without deleted_at, filter out deleted_at from where conditions
          let filteredWhere = query?.where;
          if (!useLogicalDelete && query?.where && "deleted_at" in query.where) {
            filteredWhere = { ...query.where };
            delete filteredWhere.deleted_at;
          }

          // Special: deleting staff is manager-only and performs cascading cleanup
          if (table === "staff") {
            if (!isManager) {
              throw new Error("Only manager can delete staff");
            }
            const targetStaffId = (filteredWhere as any)?.id as string | undefined;
            if (!targetStaffId) {
              throw new Error("id is required for delete staff operation");
            }

            // Prevent deleting manager record
            const { data: staffRow, error: staffFetchError } = await supabase
              .from("staff")
              .select("id, role, deleted_at")
              .eq("id", targetStaffId)
              .maybeSingle();
            if (staffFetchError) throw staffFetchError;
            if (!staffRow) {
              // idempotent
              result = [];
              error = null;
              break;
            }
            if ((staffRow as any).role === "manager") {
              throw new Error("manager staff cannot be deleted");
            }

            // 1) Physically delete related rows in business tables
            const deletes = [
              supabase.from("business_days").delete().eq("staff_id", targetStaffId),
              supabase.from("business_hours_overrides").delete().eq("staff_id", targetStaffId)
            ];
            for (const d of deletes) {
              const { error: delErr } = await d;
              if (delErr) throw delErr;
            }

            // 2) Logical delete staff (set deleted_at)
            const { data: delData, error: delErr } = await supabase
              .from("staff")
              .update({ deleted_at: new Date().toISOString() })
              .eq("id", targetStaffId)
              .select();
            result = delData || [];
            error = delErr;
            break;
          }

          if (useLogicalDelete) {
            // For logical delete, use update instead
            let deleteQuery = supabase.from(table).update({ deleted_at: new Date().toISOString() });
            
            // Apply where conditions
            if (filteredWhere) {
              for (const [key, value] of Object.entries(filteredWhere)) {
                if (value === null) {
                  deleteQuery = deleteQuery.is(key, null);
                } else if (Array.isArray(value)) {
                  deleteQuery = deleteQuery.in(key, value);
                } else {
                  deleteQuery = deleteQuery.eq(key, value);
                }
              }
            }
            
            const { data: deleteData, error: deleteError } = await deleteQuery.select();
            result = deleteData;
            error = deleteError;
          } else {
            // For physical delete (business_days, business_hours_overrides)
            let deleteQuery = supabase.from(table).delete();
            
            // Apply where conditions (deleted_at is already filtered out above)
            if (filteredWhere) {
              for (const [key, value] of Object.entries(filteredWhere)) {
                if (value === null) {
                  deleteQuery = deleteQuery.is(key, null);
                } else if (Array.isArray(value)) {
                  deleteQuery = deleteQuery.in(key, value);
                } else {
                  deleteQuery = deleteQuery.eq(key, value);
                }
              }
            }
            
            const { data: deleteData, error: deleteError } = await deleteQuery.select();
            
            // For physical delete, if no rows were affected, it's not an error (idempotent)
            // Supabase returns an error if trying to delete non-existent rows, but we treat it as success
            if (deleteError) {
              // Check if error is about no rows being affected
              const errorMessage = deleteError.message || JSON.stringify(deleteError);
              if (errorMessage.includes("No rows") || errorMessage.includes("not found") || errorMessage.includes("PGRST116")) {
                // No rows to delete is fine - treat as success
                result = [];
                error = null;
              } else {
                result = deleteData;
                error = deleteError;
              }
            } else {
              result = deleteData || [];
              error = null;
            }
          }
          break;

        case "rpc":
          if (!function_name) {
            throw new Error("function_name is required for rpc operation");
          }

          // Security: restrict RPC calls for non-manager actors.
          // Gate needs these functions before allowlisting.
          if (!isManager) {
            const allowedRpcForNonManager = [
              "verify_manager_name",
              "is_admin_ip_allowed",
              "touch_admin_allowed_ip_fingerprint",
              "gate_add_allowed_ip"
            ];
            if (!allowedRpcForNonManager.includes(function_name)) {
              throw new Error(`Only manager can call RPC: ${function_name}`);
            }
          }
          
          const { data: rpcData, error: rpcError } = await supabase.rpc(
            function_name,
            rpc_params || {}
          );
          result = rpcData;
          error = rpcError;
          break;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (opError) {
      error = opError;
    }

    if (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error("Database operation error:", errorMessage);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: errorMessage,
          role: role || "unauthorized"
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "content-type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        data: result,
        role: role || "unauthorized"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" }
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    console.error("Error in admin-db-proxy:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" }
      }
    );
  }
});

