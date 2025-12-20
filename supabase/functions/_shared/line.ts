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
    const text = await res.text().catch(() => "");
    throw new Error(`LINE API error: ${res.status} ${res.statusText} ${text}`);
  }

  return await res.json();
}

