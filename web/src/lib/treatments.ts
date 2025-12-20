import { supabase } from "./supabase";
import type { Database } from "./database.types";

type Treatment = Database["public"]["Tables"]["treatments"]["Row"];
type TreatmentInsert = Database["public"]["Tables"]["treatments"]["Insert"];
type TreatmentUpdate = Database["public"]["Tables"]["treatments"]["Update"];

/**
 * Get all active treatments
 */
export async function getTreatments(): Promise<Treatment[]> {
  const { data, error } = await supabase
    .from("treatments")
    .select("*")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch treatments: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single treatment by ID
 */
export async function getTreatmentById(id: string): Promise<Treatment | null> {
  const { data, error } = await supabase
    .from("treatments")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to fetch treatment: ${error.message}`);
  }

  return data;
}

/**
 * Create a new treatment
 */
export async function createTreatment(treatment: TreatmentInsert): Promise<Treatment> {
  const { data, error } = await supabase
    .from("treatments")
    .insert(treatment)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create treatment: ${error.message}`);
  }

  return data;
}

/**
 * Update a treatment
 */
export async function updateTreatment(
  id: string,
  updates: TreatmentUpdate
): Promise<Treatment> {
  const { data, error } = await supabase
    .from("treatments")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update treatment: ${error.message}`);
  }

  return data;
}

/**
 * Delete a treatment (logical delete)
 */
export async function deleteTreatment(id: string): Promise<void> {
  const { error } = await supabase
    .from("treatments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete treatment: ${error.message}`);
  }
}

/**
 * Format treatment description
 * Simple formatting: normalize line breaks, trim whitespace
 */
export function formatTreatmentDescription(description: string): string {
  return description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

