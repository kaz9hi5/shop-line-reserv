import { supabase } from "./supabase";
import type { Database } from "./database.types";
import { selectFromTable, insertIntoTable, updateTable, deleteFromTable } from "./admin-db-proxy";

type Treatment = Database["public"]["Tables"]["treatments"]["Row"];
type TreatmentInsert = Database["public"]["Tables"]["treatments"]["Insert"];
type TreatmentUpdate = Database["public"]["Tables"]["treatments"]["Update"];

/**
 * Get all active treatments (via Edge Function)
 */
export async function getTreatments(): Promise<Treatment[]> {
  try {
    const data = await selectFromTable<Treatment>("treatments", {
      order: { column: "sort_order", ascending: true }
    });

    // Filter and sort by name (Edge Function doesn't support multiple order by yet)
    return (data || []).sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    throw new Error(`Failed to fetch treatments: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get a single treatment by ID (via Edge Function)
 */
export async function getTreatmentById(id: string): Promise<Treatment | null> {
  try {
    const data = await selectFromTable<Treatment>("treatments", {
      where: { id },
      limit: 1
    });
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    // If error occurs, assume not found
    return null;
  }
}

/**
 * Create a new treatment (via Edge Function)
 */
export async function createTreatment(treatment: TreatmentInsert): Promise<Treatment> {
  try {
    const data = await insertIntoTable<Treatment>("treatments", treatment);
    return data;
  } catch (error) {
    throw new Error(`Failed to create treatment: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Update a treatment (via Edge Function)
 */
export async function updateTreatment(
  id: string,
  updates: TreatmentUpdate
): Promise<Treatment> {
  try {
    const data = await updateTable<Treatment>("treatments", updates, { id });
    return data[0];
  } catch (error) {
    throw new Error(`Failed to update treatment: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Delete a treatment (logical delete via Edge Function)
 */
export async function deleteTreatment(id: string): Promise<void> {
  try {
    await deleteFromTable("treatments", { id });
  } catch (error) {
    throw new Error(`Failed to delete treatment: ${error instanceof Error ? error.message : "Unknown error"}`);
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

