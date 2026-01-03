type LineMessage = {
  type: "text";
  text: string;
} | {
  type: "template";
  altText: string;
  template: {
    type: "buttons";
    text: string;
    actions: Array<{
      type: "postback" | "uri";
      label: string;
      data?: string;
      uri?: string;
    }>;
  };
};

type LineSendMessageParams = {
  to: string; // LINE user ID
  messages: LineMessage[];
};

export async function sendLineMessage({ to, messages }: LineSendMessageParams) {
  const channelAccessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";

  if (!channelAccessToken) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN env var missing");
  }

  if (!to || !messages || messages.length === 0) {
    throw new Error("to and messages are required");
  }

  const url = "https://api.line.me/v2/bot/message/push";
  const body = {
    to,
    messages
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const contentType = res.headers.get("content-type") || "";
    const raw = await res.text().catch(() => "");
    let details: unknown = raw;
    if (contentType.includes("application/json")) {
      try {
        details = JSON.parse(raw);
      } catch {
        // keep raw
      }
    }
    // Include "to" so we can diagnose invalid user IDs quickly (not secret; but still treat as PII in logs).
    console.error("LINE API error", { status: res.status, statusText: res.statusText, to, details });
    throw new Error(`LINE API error: ${res.status} ${res.statusText} ${raw}`);
  }

  return await res.json();
}

