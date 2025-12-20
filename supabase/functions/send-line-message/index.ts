import { corsHeaders } from "../_shared/cors.ts";
import { sendLineMessage } from "../_shared/line.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  reservation_id?: string;
  to?: string; // LINE user ID
  messages?: Array<{
    type: "text";
    text: string;
  }>;
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

    const payload = (await req.json()) as Partial<RequestBody>;
    const reservationId = payload.reservation_id?.trim();
    const to = payload.to?.trim();
    const messages = payload.messages;

    // If reservation_id is provided, fetch reservation and build message
    if (reservationId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Fetch reservation
      const { data: reservation, error: reservationError } = await supabase
        .from("reservations")
        .select(`
          id,
          customer_name,
          line_user_id,
          start_at,
          treatment_name_snapshot,
          treatment_duration_minutes_snapshot,
          treatment_price_yen_snapshot
        `)
        .eq("id", reservationId)
        .is("deleted_at", null)
        .single();

      if (reservationError || !reservation) {
        throw new Error(`Reservation not found: ${reservationError?.message || "not found"}`);
      }

      // Build message
      const startDate = new Date(reservation.start_at);
      const dateStr = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月${startDate.getDate()}日`;
      const timeStr = `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`;

      const baseUrl = Deno.env.get("WEB_APP_URL") || "https://your-app.vercel.app";
      const cancelUrl = `${baseUrl}/reservations/${reservation.id}/cancel`;
      const changeUrl = `${baseUrl}/reservations/${reservation.id}/change`;

      const lineMessages = [
        {
          type: "text" as const,
          text: `【予約確定】\n${reservation.customer_name}様\n\n予約日時: ${dateStr} ${timeStr}\n施術内容: ${reservation.treatment_name_snapshot}\n施術時間: ${reservation.treatment_duration_minutes_snapshot}分\n価格: ¥${reservation.treatment_price_yen_snapshot.toLocaleString("ja-JP")}`
        },
        {
          type: "template" as const,
          altText: "予約の変更・キャンセル",
          template: {
            type: "buttons" as const,
            text: "予約の変更・キャンセルはこちらから",
            actions: [
              {
                type: "uri" as const,
                label: "予約を変更",
                uri: changeUrl
              },
              {
                type: "uri" as const,
                label: "予約をキャンセル",
                uri: cancelUrl
              }
            ]
          }
        }
      ];

      const result = await sendLineMessage({
        to: reservation.line_user_id,
        messages: lineMessages
      });

      return new Response(JSON.stringify({ ok: true, result }), {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    // Direct message sending (for custom messages)
    if (!to || !messages) {
      return new Response(JSON.stringify({ error: "to and messages are required when reservation_id is not provided" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const result = await sendLineMessage({ to, messages });

    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    console.error("Error in send-line-message:", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }
});

