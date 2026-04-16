import {
  queueAndWaitForBotCommand,
  type WaitForBotCommandOptions,
  type WaitForBotCommandResult,
} from "@/lib/waitForBotCommand";

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

export type DashboardQueueTicket = {
  id?: string | number | null;
  guild_id?: string | null;
  channel_id?: string | null;
  discord_thread_id?: string | null;
  channel_name?: string | null;
  ticket_number?: number | null;
  title?: string | null;
  category?: string | null;
  category_id?: string | null;
  status?: string | null;
  ticket_status?: string | null;
  priority?: string | null;
  user_id?: string | null;
  username?: string | null;
  claimed_by?: string | null;
  claimed_by_id?: string | number | null;
  assigned_to?: string | null;
  assigned_to_id?: string | number | null;
  assigned_to_name?: string | null;
  claimed_by_name?: string | null;
  is_unclaimed?: boolean | null;
  is_claimed?: boolean | null;
  is_ghost?: boolean | null;
  source?: string | null;
  transcript_url?: string | null;
  transcript_message_id?: string | null;
  transcript_channel_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  closed_at?: string | null;
  deleted_at?: string | null;
  [key: string]: unknown;
};

export type DashboardQueueResponse = {
  ok: boolean;
  queue?: DashboardQueueTicket[];
  tickets?: DashboardQueueTicket[];
  total?: number;
  unclaimed?: number;
  claimed?: number;
  staff_id?: string;
  staff_name?: string;
  error?: string;
};

type CreateTicketActionInput = {
  userId: string;
  category?: string;
  openingMessage?: string;
  priority?: string;
  parentCategoryId?: string | null;
  staffRoleIds?: string[] | null;
  allowDuplicate?: boolean;
  requestedBy?: string | null;
  staffId?: string | null;
};

type CloseTicketActionInput = {
  channelId: string;
  reason?: string;
  requestedBy?: string | null;
  staffId?: string | null;
};

type DeleteTicketActionInput = {
  channelId: string;
  ghost?: boolean;
  forceTranscript?: boolean;
  reason?: string;
  requestedBy?: string | null;
  staffId?: string | null;
};

type ReopenTicketActionInput = {
  channelId: string;
  requestedBy?: string | null;
  staffId?: string | null;
};

type AssignTicketActionInput = {
  channelId: string;
  staffId: string;
  requestedBy?: string | null;
};

type SyncMembersActionInput = {
  requestedBy?: string | null;
  staffId?: string | null;
};

type SyncRoleMembersActionInput = {
  roleId: string;
  requestedBy?: string | null;
  staffId?: string | null;
};

type ReconcileTicketsActionInput = {
  requestedBy?: string | null;
  staffId?: string | null;
  includeOpenWithMissingChannel?: boolean;
  includeTranscriptBackfill?: boolean;
  dryRun?: boolean;
};

type PurgeStaleTicketsActionInput = {
  requestedBy?: string | null;
  staffId?: string | null;
  dryRun?: boolean;
  olderThanMinutes?: number;
};

type SyncActiveTicketsActionInput = {
  requestedBy?: string | null;
  staffId?: string | null;
  dryRun?: boolean;
  includeClosedVisibleChannels?: boolean;
};

type SyncSingleTicketActionInput = {
  channelId: string;
  requestedBy?: string | null;
  staffId?: string | null;
  dryRun?: boolean;
};

function normalizeNullable(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
}

async function postJson<T>(url: string, body: JsonObject): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => null)) as T | null;

  if (!res.ok) {
    throw new Error(
      (data as { error?: string } | null)?.error ||
        `Request failed for ${url} (${res.status})`
    );
  }

  if (!data) {
    throw new Error(`Invalid JSON response from ${url}`);
  }

  return data;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
    cache: "no-store",
  });

  const data = (await res.json().catch(() => null)) as T | null;

  if (!res.ok) {
    throw new Error(
      (data as { error?: string } | null)?.error ||
        `Request failed for ${url} (${res.status})`
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

function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (!text) continue;
    search.set(key, text);
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

function normalizeQueueTicket(ticket: DashboardQueueTicket): DashboardQueueTicket {
  const claimedById =
    normalizeNullable(ticket?.claimed_by_id) ??
    normalizeNullable(ticket?.assigned_to_id) ??
    normalizeNullable(ticket?.assigned_to) ??
    normalizeNullable(ticket?.claimed_by);

  const status =
    normalizeString(ticket?.status || ticket?.ticket_status).toLowerCase();

  const isClaimed =
    normalizeBoolean(ticket?.is_claimed) ||
    status === "claimed" ||
    Boolean(claimedById);

  const isUnclaimed =
    normalizeBoolean(ticket?.is_unclaimed) ||
    (status === "open" && !claimedById);

  return {
    ...ticket,
    claimed_by_id: claimedById,
    assigned_to_id: claimedById,
    claimed_by:
      normalizeNullable(ticket?.claimed_by) ??
      normalizeNullable(ticket?.assigned_to_name) ??
      normalizeNullable(ticket?.assigned_to) ??
      null,
    assigned_to:
      normalizeNullable(ticket?.assigned_to) ??
      normalizeNullable(ticket?.claimed_by) ??
      null,
    status:
      status ||
      normalizeString(ticket?.status || ticket?.ticket_status) ||
      null,
    ticket_status:
      status ||
      normalizeString(ticket?.ticket_status || ticket?.status) ||
      null,
    is_claimed: isClaimed,
    is_unclaimed: isUnclaimed,
    priority: normalizeNullable(ticket?.priority) ?? "medium",
    channel_id:
      normalizeNullable(ticket?.channel_id) ??
      normalizeNullable(ticket?.discord_thread_id),
  };
}

function normalizeQueueResponse(
  payload: DashboardQueueResponse | null | undefined
): DashboardQueueResponse {
  const queue = Array.isArray(payload?.queue)
    ? payload.queue.map(normalizeQueueTicket)
    : undefined;

  const tickets = Array.isArray(payload?.tickets)
    ? payload.tickets.map(normalizeQueueTicket)
    : undefined;

  return {
    ok: payload?.ok === true,
    queue,
    tickets,
    total: normalizeNumber(payload?.total, 0),
    unclaimed: normalizeNumber(payload?.unclaimed, 0),
    claimed: normalizeNumber(payload?.claimed, 0),
    staff_id: normalizeNullable(payload?.staff_id) ?? undefined,
    staff_name: normalizeNullable(payload?.staff_name) ?? undefined,
    error: normalizeNullable(payload?.error) ?? undefined,
  };
}

export async function createTicketAction(
  input: CreateTicketActionInput,
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
  input: CloseTicketActionInput,
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
  input: DeleteTicketActionInput,
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
  input: ReopenTicketActionInput,
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
  input: AssignTicketActionInput,
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
  input?: SyncMembersActionInput,
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
  input?: SyncMembersActionInput,
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
  input: SyncRoleMembersActionInput,
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

export async function reconcileTicketsAction(
  input?: ReconcileTicketsActionInput
): Promise<{
  ok: boolean;
  scanned: number;
  hidden: number;
  updated: number;
  removed: number;
  tickets?: unknown[];
}> {
  return postJson("/api/tickets/reconcile", {
    includeOpenWithMissingChannel: Boolean(
      input?.includeOpenWithMissingChannel
    ),
    includeTranscriptBackfill: Boolean(
      input?.includeTranscriptBackfill
    ),
    dryRun: Boolean(input?.dryRun),
    ...withActor(input),
  });
}

export async function purgeStaleTicketsAction(
  input?: PurgeStaleTicketsActionInput
): Promise<{
  ok: boolean;
  dryRun: boolean;
  scanned: number;
  removed: number;
  candidates: unknown[];
}> {
  return postJson("/api/tickets/purge-stale", {
    dryRun: Boolean(input?.dryRun),
    olderThanMinutes:
      typeof input?.olderThanMinutes === "number"
        ? Math.max(1, Math.floor(input.olderThanMinutes))
        : 5,
    ...withActor(input),
  });
}

export async function syncActiveTicketsAction(
  input?: SyncActiveTicketsActionInput,
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAction({
    url: "/api/tickets/sync-active",
    body: {
      dryRun: Boolean(input?.dryRun),
      includeClosedVisibleChannels: Boolean(
        input?.includeClosedVisibleChannels ?? true
      ),
      ...withActor(input),
    },
    wait: longWaitOptions(options),
  });
}

export async function syncSingleTicketAction(
  input: SyncSingleTicketActionInput,
  options?: WaitForBotCommandOptions
): Promise<WaitForBotCommandResult> {
  return queueAction({
    url: "/api/tickets/sync-one",
    body: {
      channelId: String(input.channelId).trim(),
      dryRun: Boolean(input?.dryRun),
      ...withActor(input),
    },
    wait: mediumWaitOptions(options),
  });
}

export async function getTicketQueueAction(input: {
  guildId: string;
}): Promise<DashboardQueueResponse> {
  const payload = await getJson<DashboardQueueResponse>(
    `/api/tickets/queue${buildQuery({
      guildId: input.guildId,
    })}`
  );

  return normalizeQueueResponse(payload);
}

export async function getUnclaimedTicketsAction(input: {
  guildId: string;
}): Promise<DashboardQueueResponse> {
  const payload = await getJson<DashboardQueueResponse>(
    `/api/tickets/unclaimed${buildQuery({
      guildId: input.guildId,
    })}`
  );

  return normalizeQueueResponse(payload);
}

export async function getClaimedTicketsAction(input: {
  guildId: string;
}): Promise<DashboardQueueResponse> {
  const payload = await getJson<DashboardQueueResponse>(
    `/api/tickets/claimed${buildQuery({
      guildId: input.guildId,
    })}`
  );

  return normalizeQueueResponse(payload);
}

export async function getMyClaimedTicketsAction(input: {
  guildId: string;
  staffId: string;
}): Promise<DashboardQueueResponse> {
  const payload = await getJson<DashboardQueueResponse>(
    `/api/tickets/my-claimed${buildQuery({
      guildId: input.guildId,
      staffId: input.staffId,
    })}`
  );

  return normalizeQueueResponse(payload);
}

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
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error, "Clipboard copy failed."),
    };
  }
}
