import { supabase } from "./supabase";

type DbOperation = "select" | "insert" | "update" | "delete" | "rpc";

type DbProxyRequest = {
  operation: DbOperation;
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

type DbProxyResponse<T = any> = {
  ok: boolean;
  data?: T;
  error?: string;
  role?: "manager" | "staff" | "unauthorized";
};

/**
 * Call admin-db-proxy Edge Function to execute database operations
 * This function handles device fingerprinting and role-based access control
 */
async function callAdminDbProxy<T = any>(request: DbProxyRequest): Promise<DbProxyResponse<T>> {
  try {
    const { data, error } = await supabase.functions.invoke("admin-db-proxy", {
      body: request
    });

    // If there's an error from the invoke call itself (network error, etc.)
    if (error) {
      return {
        ok: false,
        error: error.message || "Failed to call admin-db-proxy",
        role: "unauthorized"
      };
    }

    // Check if the response indicates an error (even if HTTP status was 2xx)
    if (data && typeof data === 'object' && 'ok' in data && !data.ok) {
      return {
        ok: false,
        error: data.error || "Edge Function returned an error",
        role: data.role || "unauthorized"
      };
    }

    return data as DbProxyResponse<T>;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error occurred",
      role: "unauthorized"
    };
  }
}

/**
 * Select data from a table
 */
export async function selectFromTable<T = any>(
  table: string,
  options?: {
    select?: string;
    where?: Record<string, any>;
    order?: { column: string; ascending: boolean };
    limit?: number;
  }
): Promise<T[]> {
  const response = await callAdminDbProxy<T[]>({
    operation: "select",
    table,
    query: options
  });

  if (!response.ok || !response.data) {
    throw new Error(response.error || "Failed to select data");
  }

  return response.data;
}

/**
 * Insert data into a table
 */
export async function insertIntoTable<T = any>(
  table: string,
  data: Record<string, any>
): Promise<T> {
  const response = await callAdminDbProxy<T>({
    operation: "insert",
    table,
    data
  });

  if (!response.ok || !response.data) {
    throw new Error(response.error || "Failed to insert data");
  }

  // If array is returned, return first item
  if (Array.isArray(response.data)) {
    return response.data[0];
  }

  return response.data;
}

/**
 * Update data in a table
 */
export async function updateTable<T = any>(
  table: string,
  updates: Record<string, any>,
  where?: Record<string, any>
): Promise<T[]> {
  const response = await callAdminDbProxy<T[]>({
    operation: "update",
    table,
    updates,
    query: where ? { where } : undefined
  });

  if (!response.ok || !response.data) {
    throw new Error(response.error || "Failed to update data");
  }

  return response.data;
}

/**
 * Delete data from a table (logical delete)
 */
export async function deleteFromTable<T = any>(
  table: string,
  where: Record<string, any>
): Promise<T[]> {
  const response = await callAdminDbProxy<T[]>({
    operation: "delete",
    table,
    query: { where }
  });

  // For physical delete operations (business_days, business_hours_overrides),
  // if the record doesn't exist, it's treated as success (idempotent)
  // Edge Function should handle this, but we also handle it here for safety
  if (!response.ok) {
    // Check if error is about no rows being affected (idempotent operation)
    const errorMsg = response.error?.toLowerCase() || "";
    if (errorMsg.includes("no rows") || errorMsg.includes("not found") || errorMsg.includes("pgrst116")) {
      // No rows to delete is fine - treat as success
      return [];
    }
    throw new Error(response.error || "Failed to delete data");
  }

  return response.data || [];
}

/**
 * Call a PostgreSQL RPC function
 */
export async function callRpc<T = any>(
  functionName: string,
  params?: Record<string, any>
): Promise<T> {
  const response = await callAdminDbProxy<T>({
    operation: "rpc",
    function_name: functionName,
    rpc_params: params
  });

  if (!response.ok || response.data === undefined) {
    throw new Error(response.error || "Failed to call RPC function");
  }

  return response.data;
}

/**
 * Get current user role from the proxy
 */
export async function getCurrentRole(): Promise<"manager" | "staff" | "unauthorized"> {
  // Use a table that staff are always allowed to select from so this works for both roles.
  const response = await callAdminDbProxy({
    operation: "select",
    table: "reservations",
    query: { limit: 1 }
  });

  return response.role || "unauthorized";
}

