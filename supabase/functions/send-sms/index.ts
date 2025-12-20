import { corsHeaders } from "../_shared/cors.ts";
import { sendTwilioSms } from "../_shared/twilio.ts";

type RequestBody = {
  to: string;
  body: string;
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
    const to = payload.to?.trim();
    const body = payload.body?.trim();

    if (!to || !body) {
      return new Response(JSON.stringify({ error: "to and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const result = await sendTwilioSms({ to, body });

    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }
});


