import { corsHeaders } from "../_shared/cors.ts";

// LINE Webhook event types
type LineWebhookEvent = {
  type: "follow" | "unfollow" | "message" | "postback";
  source: {
    type: "user";
    userId: string;
  };
  timestamp: number;
  replyToken?: string;
};

type LineWebhookRequest = {
  events: LineWebhookEvent[];
};

// Verify LINE Webhook signature
async function verifySignature(
  body: string,
  signature: string | null
): Promise<boolean> {
  const channelSecret = Deno.env.get("LINE_CHANNEL_SECRET");
  if (!channelSecret || !signature) {
    return false;
  }

  try {
    // Import crypto for signature verification
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(channelSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    
    // Convert to base64
    const uint8Array = new Uint8Array(signatureBytes);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const expectedSignature = btoa(binary);

    return signature === expectedSignature;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

// Get LINE user profile
async function getLineUserProfile(userId: string): Promise<{
  displayName?: string;
  pictureUrl?: string;
} | null> {
  const channelAccessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!channelAccessToken) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN not set");
    return null;
  }

  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${channelAccessToken}`
      }
    });

    if (!res.ok) {
      console.error(`Failed to get LINE profile: ${res.status} ${res.statusText}`);
      return null;
    }

    const profile = await res.json();
    return {
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl
    };
  } catch (error) {
    console.error("Error getting LINE profile:", error);
    return null;
  }
}

// Save LINE user to database (UPSERT)
async function saveLineUser(
  userId: string,
  displayName?: string,
  pictureUrl?: string
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase credentials not set");
  }

  // Check if user exists
  const checkRes = await fetch(
    `${supabaseUrl}/rest/v1/line_users?line_user_id=eq.${encodeURIComponent(userId)}&select=line_user_id`,
    {
      headers: {
        "apikey": supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`
      }
    }
  );

  const userData = {
    line_user_id: userId,
    line_display_name: displayName || null,
    picture_url: pictureUrl || null,
    is_friend: true,
    unfriended_at: null
  };

  let res: Response;
  if (checkRes.ok) {
    const existing = await checkRes.json();
    if (existing && existing.length > 0) {
      // Update existing user
      res = await fetch(
        `${supabaseUrl}/rest/v1/line_users?line_user_id=eq.${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseServiceKey,
            "Authorization": `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify(userData)
        }
      );
    } else {
      // Insert new user
      res = await fetch(
        `${supabaseUrl}/rest/v1/line_users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseServiceKey,
            "Authorization": `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify(userData)
        }
      );
    }
  } else {
    // If check fails, try to insert
    res = await fetch(
      `${supabaseUrl}/rest/v1/line_users`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(userData)
      }
    );
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed to save LINE user: ${res.status} ${res.statusText}`, text);
    throw new Error(`Failed to save LINE user: ${res.status}`);
  }
}

// Update LINE user (unfriend)
async function updateLineUserUnfriend(userId: string): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase credentials not set");
  }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/line_users?line_user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        is_friend: false,
        unfriended_at: new Date().toISOString()
      })
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed to update LINE user: ${res.status} ${res.statusText}`, text);
    throw new Error(`Failed to update LINE user: ${res.status}`);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  try {
    // Get request body
    const body = await req.text();
    const signature = req.headers.get("x-line-signature");

    // LINE webhook verification requests don't have signature header
    // If signature is missing, treat as verification request and return 200
    if (!signature || signature.trim() === "") {
      console.log("LINE webhook verification request received (no signature header)");
      return new Response(
        JSON.stringify({ ok: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Check if events array is empty (another form of verification request)
    try {
      const webhook: LineWebhookRequest = JSON.parse(body);
      // If events array is empty or missing, it's a verification request
      if (!webhook.events || webhook.events.length === 0) {
        console.log("LINE webhook verification request received (empty events array)");
        return new Response(
          JSON.stringify({ ok: true }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    } catch (parseError) {
      // If body is not valid JSON, still verify signature if it exists
      // This shouldn't happen for LINE webhooks, but handle gracefully
      console.warn("Failed to parse webhook body:", parseError);
    }

    // For actual webhook events with signature, verify signature
    // At this point, signature should exist and events array should not be empty

    const isValid = await verifySignature(body, signature);
    if (!isValid) {
      console.error("Invalid LINE webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Parse webhook events
    const webhook: LineWebhookRequest = JSON.parse(body);

    // Process each event
    for (const event of webhook.events) {
      if (event.type === "follow") {
        // User added bot as friend
        const userId = event.source.userId;
        console.log(`Follow event received for user: ${userId}`);

        // Get user profile from LINE API
        const profile = await getLineUserProfile(userId);
        
        // Save to database
        await saveLineUser(
          userId,
          profile?.displayName,
          profile?.pictureUrl
        );

        console.log(`Saved LINE user: ${userId}`);
      } else if (event.type === "unfollow") {
        // User blocked/unfriended bot
        const userId = event.source.userId;
        console.log(`Unfollow event received for user: ${userId}`);

        // Update database
        await updateLineUserUnfriend(userId);

        console.log(`Updated LINE user as unfriended: ${userId}`);
      }
      // Ignore other event types (message, postback, etc.)
    }

    return new Response(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("LINE webhook error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

