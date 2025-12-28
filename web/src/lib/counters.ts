import { supabase } from "./supabase";
import type { Database } from "./database.types";
import { selectFromTable, insertIntoTable, updateTable } from "./admin-db-proxy";

type Counter = Database["public"]["Tables"]["customer_action_counters"]["Row"];
type CounterInsert = Database["public"]["Tables"]["customer_action_counters"]["Insert"];
type CounterUpdate = Database["public"]["Tables"]["customer_action_counters"]["Update"];

/**
 * Increment cancel count for a LINE user ID (via Edge Function)
 */
export async function incrementCancelCount(lineUserId: string): Promise<void> {
  try {
    // Get or create counter
    const existing = await selectFromTable<Counter>("customer_action_counters", {
      where: { line_user_id: lineUserId },
      limit: 1
    });

    if (existing && existing.length > 0) {
      // Update existing counter
      await updateTable("customer_action_counters", {
        cancel_count: existing[0].cancel_count + 1
      }, { line_user_id: lineUserId });
    } else {
      // Create new counter
      await insertIntoTable("customer_action_counters", {
        line_user_id: lineUserId,
        cancel_count: 1,
        change_count: 0
      });
    }
  } catch (error) {
    throw new Error(`Failed to increment cancel count: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Increment change count for a LINE user ID (via Edge Function)
 */
export async function incrementChangeCount(lineUserId: string): Promise<void> {
  try {
    // Get or create counter
    const existing = await selectFromTable<Counter>("customer_action_counters", {
      where: { line_user_id: lineUserId },
      limit: 1
    });

    if (existing && existing.length > 0) {
      // Update existing counter
      await updateTable("customer_action_counters", {
        change_count: existing[0].change_count + 1
      }, { line_user_id: lineUserId });
    } else {
      // Create new counter
      await insertIntoTable("customer_action_counters", {
        line_user_id: lineUserId,
        cancel_count: 0,
        change_count: 1
      });
    }
  } catch (error) {
    throw new Error(`Failed to increment change count: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get counter for a LINE user ID (via Edge Function)
 */
export async function getCounter(lineUserId: string): Promise<Counter | null> {
  try {
    const data = await selectFromTable<Counter>("customer_action_counters", {
      where: { line_user_id: lineUserId },
      limit: 1
    });
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    // If error occurs, assume not found
    return null;
  }
}

