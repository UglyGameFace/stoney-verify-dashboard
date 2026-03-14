import {
  queueAndWaitForBotCommand,
  type WaitForBotCommandOptions,
  type WaitForBotCommandResult,
} from "@/lib/waitForBotCommand";

type QueueResponse = {
  ok?: boolean;
  queued?: boolean;
  command?: {
    id?: string;
    status?: string;
    error?: string;
    result?: unknown;
  };
  error?: string;
};

type JsonObject = Record<string, unknown>;

type TicketActionBaseInput = {
  requestedBy?: string | null;
  staffId?: string | null;
};

type QueueAndWaitConfig = {
  url: string;
  body: JsonObject;
  wait?: WaitForBotCommandOptions;
};

function normalizeNullable(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

async function postJson<T extends QueueResponse>(
  url: string,
  body: JsonObject
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => null)) as T | null;

  if (!res.ok) {
    throw new Error(
      data?.error || `Request failed for ${url} (${res.status})`
    );
  }

  if (!data) {
    throw new Error(`Invalid JSON response from ${url}`);
  }

  return data;
}

function defaultWaitOptions(
  options?: WaitForBotCommandOptions
): WaitForBotCommandOptions {
  return {
    timeoutMs: options?.timeoutMs ?? 60_000,
    intervalMs: options?.intervalMs ?? 1_500,
    signal: options?.signal,
  };
}

function longWaitOptions(
  options?: WaitForBotCommandOptions
): WaitForBotCommandOptions {
  return {
    timeoutMs: options?.timeoutMs ?? 180_000,
    intervalMs: options?.intervalMs ?? 2_000,
    signal: options?.signal,
  };
}

function mediumWaitOptions(
  options?: WaitForBotCommandOptions
): WaitForBotCommandOptions {
  return {
    timeoutMs: options?.timeoutMs ?? 90_000,
    intervalMs: options?.intervalMs ?? 2_000,
    signal: options?.signal,
  };
}

async function queueAction(
  config: QueueAndWaitConfig
): Promise<WaitForBotCommandResult> {
  return queueAndWaitForBotCommand(
    postJson(config.url, config.body),
    config.wait ?? defaultWaitOptions()
  );
}

function withActor(input?: TicketActionBaseInput) {
  return {
    requestedBy:
      normalizeNullable(input?.requestedBy) ??
      normalizeNullable(input?.staffId),
    staffId: normalizeNullable(input?.staffId),
  };
}

export async function createTicketAction(
  input: {
    userId: string;
    category?: string;
    openingMessage?: string;
    priority?: string;
    parentCategoryId?: string | null;
    staffRoleIds?: string[] | null;
    allowDuplicate?: boolean;
    requestedBy?: string | null;
    staffId?: string | null;
  },
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAction({
    url: "/api/tickets/create",
    body: {
      userId: String(input.userId).trim(),
      category: input.category ?? "support",
      openingMessage: input.openingMessage ?? "",
      priority: input.priority ?? "medium",
      parentCategoryId: normalizeNullable(input.parentCategoryId),
      staffRoleIds: Array.isArray(input.staffRoleIds)
        ? input.staffRoleIds.map((id) => String(id).trim()).filter(Boolean)
        : null,
      allowDuplicate: Boolean(input.allowDuplicate),
      ...withActor(input),
    },
    wait: defaultWaitOptions(options),
  });
}

export async function closeTicketAction(
  input: {
    channelId: string;
    reason?: string;
    requestedBy?: string | null;
    staffId?: string | null;
  },
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAction({
    url: "/api/tickets/close",
    body: {
      channelId: String(input.channelId).trim(),
      reason: input.reason ?? "Resolved",
      ...withActor(input),
    },
    wait: defaultWaitOptions(options),
  });
}

export async function deleteTicketAction(
  input: {
    channelId: string;
    ghost?: boolean;
    forceTranscript?: boolean;
    reason?: string;
    requestedBy?: string | null;
    staffId?: string | null;
  },
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAction({
    url: "/api/tickets/delete",
    body: {
      channelId: String(input.channelId).trim(),
      ghost: Boolean(input.ghost),
      forceTranscript: Boolean(input.forceTranscript),
      reason: input.reason ?? "Deleted from dashboard",
      ...withActor(input),
    },
    wait: defaultWaitOptions(options),
  });
}

export async function reopenTicketAction(
  input: {
    channelId: string;
    requestedBy?: string | null;
    staffId?: string | null;
  },
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAction({
    url: "/api/tickets/reopen",
    body: {
      channelId: String(input.channelId).trim(),
      ...withActor(input),
    },
    wait: defaultWaitOptions(options),
  });
}

export async function assignTicketAction(
  input: {
    channelId: string;
    staffId: string;
    requestedBy?: string | null;
  },
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAction({
    url: "/api/tickets/assign",
    body: {
      channelId: String(input.channelId).trim(),
      staffId: String(input.staffId).trim(),
      requestedBy:
        normalizeNullable(input.requestedBy) ??
        normalizeNullable(input.staffId),
    },
    wait: defaultWaitOptions(options),
  });
}

export async function syncMembersAction(
  input?: {
    requestedBy?: string | null;
    staffId?: string | null;
  },
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAction({
    url: "/api/members/sync",
    body: {
      ...withActor(input),
    },
    wait: longWaitOptions(options),
  });
}

export async function reconcileDepartedMembersAction(
  input?: {
    requestedBy?: string | null;
    staffId?: string | null;
  },
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAction({
    url: "/api/members/reconcile",
    body: {
      ...withActor(input),
    },
    wait: longWaitOptions(options),
  });
}

export async function syncRoleMembersAction(
  input: {
    roleId: string;
    requestedBy?: string | null;
    staffId?: string | null;
  },
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAction({
    url: "/api/members/role-sync",
    body: {
      roleId: String(input.roleId).trim(),
      ...withActor(input),
    },
    wait: mediumWaitOptions(options),
  });
}

/**
 * Lightweight helpers for UI-only transcript handling.
 * These do not mutate server state directly; they help the dashboard
 * present transcript records consistently when the ticket row already
 * contains transcript metadata from Supabase.
 */

export function getTicketTranscriptState(ticket: {
  transcript_url?: string | null;
  transcript_message_id?: string | null;
  transcript_channel_id?: string | null;
  status?: string | null;
}) {
  const transcriptUrl = normalizeNullable(ticket.transcript_url);
  const transcriptMessageId = normalizeNullable(ticket.transcript_message_id);
  const transcriptChannelId = normalizeNullable(ticket.transcript_channel_id);
  const status = String(ticket.status ?? "").trim().toLowerCase();

  const hasTranscript =
    !!transcriptUrl || !!transcriptMessageId || !!transcriptChannelId;

  return {
    status,
    transcriptUrl,
    transcriptMessageId,
    transcriptChannelId,
    hasTranscript,
    transcriptState: hasTranscript
      ? "available"
      : status === "deleted" || status === "closed"
      ? "expected_missing"
      : "not_ready",
  } as const;
}

export async function copyTextToClipboard(
  value: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = String(value || "").trim();

  if (!text) {
    return {
      ok: false,
      error: "Nothing to copy.",
    };
  }

  try {
    await navigator.clipboard.writeText(text);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Clipboard copy failed.",
    };
  }
}
