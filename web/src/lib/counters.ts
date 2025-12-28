import { supabase } from "./supabase";
import type { Database } from "./database.types";

type Counter = Database["public"]["Tables"]["customer_action_counters"]["Row"];
type CounterInsert = Database["public"]["Tables"]["customer_action_counters"]["Insert"];
type CounterUpdate = Database["public"]["Tables"]["customer_action_counters"]["Update"];

/**
 * Increment cancel count for a LINE user ID
 */
export async function incrementCancelCount(lineUserId: string): Promise<void> {
  // Get or create counter
  const { data: existing } = await (supabase
    .from("customer_action_counters") as any)
    .select("*")
    .eq("line_user_id", lineUserId)
    .single();

  if (existing) {
    // Update existing counter
    const { error } = await (supabase
      .from("customer_action_counters") as any)
      .update({ cancel_count: (existing as Counter).cancel_count + 1 })
      .eq("line_user_id", lineUserId);

    if (error) {
      throw new Error(`Failed to increment cancel count: ${error.message}`);
    }
  } else {
    // Create new counter
    const { error } = await (supabase
      .from("customer_action_counters") as any)
      .insert({
        line_user_id: lineUserId,
        cancel_count: 1,
        change_count: 0
      });

    if (error) {
      throw new Error(`Failed to create cancel count: ${error.message}`);
    }
  }
}

/**
 * Increment change count for a LINE user ID
 */
export async function incrementChangeCount(lineUserId: string): Promise<void> {
  // Get or create counter
  const { data: existing } = await (supabase
    .from("customer_action_counters") as any)
    .select("*")
    .eq("line_user_id", lineUserId)
    .single();

  if (existing) {
    // Update existing counter
    const { error } = await (supabase
      .from("customer_action_counters") as any)
      .update({ change_count: (existing as Counter).change_count + 1 })
      .eq("line_user_id", lineUserId);

    if (error) {
      throw new Error(`Failed to increment change count: ${error.message}`);
    }
  } else {
    // Create new counter
    const { error } = await (supabase
      .from("customer_action_counters") as any)
      .insert({
        line_user_id: lineUserId,
        cancel_count: 0,
        change_count: 1
      });

    if (error) {
      throw new Error(`Failed to create change count: ${error.message}`);
    }
  }
}

/**
 * Get counter for a LINE user ID
 */
export async function getCounter(lineUserId: string): Promise<Counter | null> {
  const { data, error } = await (supabase
    .from("customer_action_counters") as any)
    .select("*")
    .eq("line_user_id", lineUserId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get counter: ${error.message}`);
  }

  return data;
}

