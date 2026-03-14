import {
  queueAndWaitForBotCommand,
  type WaitForBotCommandOptions,
  type WaitForBotCommandResult,
} from "@/lib/waitForBotCommand";

type QueueResponse = {
  ok?: boolean;
  queued?: boolean;
  command?: { id?: string };
  error?: string;
};

type JsonObject = Record<string, unknown>;

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
  return queueAndWaitForBotCommand(
    postJson("/api/tickets/create", {
      userId: input.userId,
      category: input.category ?? "support",
      openingMessage: input.openingMessage ?? "",
      priority: input.priority ?? "medium",
      parentCategoryId: input.parentCategoryId ?? null,
      staffRoleIds: input.staffRoleIds ?? null,
      allowDuplicate: Boolean(input.allowDuplicate),
      requestedBy: input.requestedBy ?? null,
      staffId: input.staffId ?? null,
    }),
    defaultWaitOptions(options)
  );
}

export async function closeTicketAction(
  input: {
    channelId: string;
    reason?: string;
    staffId?: string | null;
    requestedBy?: string | null;
  },
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAndWaitForBotCommand(
    postJson("/api/tickets/close", {
      channelId: input.channelId,
      reason: input.reason ?? "Resolved",
      staffId: input.staffId ?? null,
      requestedBy: input.requestedBy ?? null,
    }),
    defaultWaitOptions(options)
  );
}

export async function deleteTicketAction(
  input: {
    channelId: string;
    ghost?: boolean;
    forceTranscript?: boolean;
    reason?: string;
    staffId?: string | null;
    requestedBy?: string | null;
  },
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAndWaitForBotCommand(
    postJson("/api/tickets/delete", {
      channelId: input.channelId,
      ghost: Boolean(input.ghost),
      forceTranscript: Boolean(input.forceTranscript),
      reason: input.reason ?? "Deleted from dashboard",
      staffId: input.staffId ?? null,
      requestedBy: input.requestedBy ?? null,
    }),
    defaultWaitOptions(options)
  );
}

export async function reopenTicketAction(
  input: {
    channelId: string;
    requestedBy?: string | null;
    staffId?: string | null;
  },
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAndWaitForBotCommand(
    postJson("/api/tickets/reopen", {
      channelId: input.channelId,
      requestedBy: input.requestedBy ?? input.staffId ?? null,
      staffId: input.staffId ?? null,
    }),
    defaultWaitOptions(options)
  );
}

export async function assignTicketAction(
  input: {
    channelId: string;
    staffId: string;
    requestedBy?: string | null;
  },
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAndWaitForBotCommand(
    postJson("/api/tickets/assign", {
      channelId: input.channelId,
      staffId: input.staffId,
      requestedBy: input.requestedBy ?? input.staffId,
    }),
    defaultWaitOptions(options)
  );
}

export async function syncMembersAction(
  input?: {
    requestedBy?: string | null;
    staffId?: string | null;
  },
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAndWaitForBotCommand(
    postJson("/api/members/sync", {
      requestedBy: input?.requestedBy ?? input?.staffId ?? null,
      staffId: input?.staffId ?? null,
    }),
    {
      timeoutMs: options?.timeoutMs ?? 180_000,
      intervalMs: options?.intervalMs ?? 2_000,
      signal: options?.signal,
    }
  );
}

export async function reconcileDepartedMembersAction(
  input?: {
    requestedBy?: string | null;
    staffId?: string | null;
  },
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAndWaitForBotCommand(
    postJson("/api/members/reconcile", {
      requestedBy: input?.requestedBy ?? input?.staffId ?? null,
      staffId: input?.staffId ?? null,
    }),
    {
      timeoutMs: options?.timeoutMs ?? 180_000,
      intervalMs: options?.intervalMs ?? 2_000,
      signal: options?.signal,
    }
  );
}

export async function syncRoleMembersAction(
  input: {
    roleId: string;
    requestedBy?: string | null;
    staffId?: string | null;
  },
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAndWaitForBotCommand(
    postJson("/api/members/role-sync", {
      roleId: input.roleId,
      requestedBy: input.requestedBy ?? input.staffId ?? null,
      staffId: input.staffId ?? null,
    }),
    {
      timeoutMs: options?.timeoutMs ?? 90_000,
      intervalMs: options?.intervalMs ?? 2_000,
      signal: options?.signal,
    }
  );
}
