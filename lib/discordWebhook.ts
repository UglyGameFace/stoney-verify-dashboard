// lib/discordWebhook.ts
type WebhookPayload = {
  content?: string;
  embeds?: any[];
  components?: any[];
  username?: string;
  avatar_url?: string;
  allowed_mentions?: {
    parse?: ("users" | "roles" | "everyone")[];
    users?: string[];
    roles?: string[];
    replied_user?: boolean;
  };
};

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function postToDiscordWebhook(webhookUrl: string, payload: WebhookPayload) {
  const url = String(webhookUrl || "").trim();
  if (!url) {
    return { ok: false, status: 0, error: "missing_webhook_url" as const };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: text || `webhook_http_${res.status}`,
      json: safeJsonParse(text),
    };
  }

  // Discord returns message JSON for webhooks if ?wait=true, but many webhooks return empty body.
  const text = await res.text().catch(() => "");
  return { ok: true, status: res.status, text, json: safeJsonParse(text) };
}

export function buildDecisionEmbed(opts: {
  decision: "APPROVED" | "DENIED" | "RESUBMIT REQUESTED" | string;
  token: string;
  staffName: string;
  staffId: string;
  userId?: string | null;
  channelId?: string | null;
  guildId?: string | null;
}) {
  const decision = String(opts.decision || "").trim();
  const isApproved = decision.toUpperCase().startsWith("APPROVED");
  const isDenied = decision.toUpperCase().startsWith("DENIED");

  const title = isApproved ? "✅ Verification Approved" : isDenied ? "⛔ Verification Denied" : "🔁 Verification Update";

  const fields: any[] = [
    { name: "Decision", value: `\`${decision}\``, inline: true },
    { name: "By", value: `${opts.staffName} (\`${opts.staffId}\`)`, inline: true },
    { name: "Token", value: `\`${opts.token}\``, inline: false },
  ];

  if (opts.userId) fields.push({ name: "User", value: `<@${opts.userId}> (\`${opts.userId}\`)`, inline: false });
  if (opts.channelId) fields.push({ name: "Ticket", value: `<#${opts.channelId}> (\`${opts.channelId}\`)`, inline: false });
  if (opts.guildId) fields.push({ name: "Guild", value: `\`${opts.guildId}\``, inline: false });

  return {
    title,
    description:
      isApproved
        ? "Staff approved this verification. Roles/ticket actions will be applied automatically."
        : isDenied
        ? "Staff denied this verification. Ticket actions will be applied automatically."
        : "Staff updated this verification.",
    fields,
    timestamp: new Date().toISOString(),
  };
}
