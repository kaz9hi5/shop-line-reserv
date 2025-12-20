import { supabase } from "./supabase";

/**
 * Call send-line-message Edge Function to resend LINE message
 */
export async function resendLineMessage(reservationId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("send-line-message", {
    body: {
      reservation_id: reservationId
    }
  });

  if (error) {
    throw new Error(`Failed to resend LINE message: ${error.message}`);
  }
}

/**
 * @deprecated Use resendLineMessage instead
 */
export async function resendSms(reservationId: string): Promise<void> {
  return resendLineMessage(reservationId);
}

