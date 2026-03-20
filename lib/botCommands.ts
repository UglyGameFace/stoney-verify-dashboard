import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type BotCommandAction =
  | "create_ticket"
  | "close_ticket"
  | "delete_ticket"
  | "reopen_ticket"
  | "assign_ticket"
  | "sync_members"
  | "reconcile_departed_members"
  | "sync_role_members"
  | "sync_active_tickets"
  | "portal_ticket_reply";

export type BotCommandRow = {
  id: string;
  guild_id: string;
  action: BotCommandAction;
  payload: Record<string, Json>;
  status: "pending" | "processing" | "completed" | "failed";
  result: Record<string, Json>;
  error: string | null;
  requested_by: string | null;
  created_at: string;
  picked_up_at: string | null;
  completed_at: string | null;
};

let supabase: SupabaseClient | null = null;

function requireEnv(name: string, value: string | undefined): string {
  const out = (value || "").trim();
  if (!out) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return out;
}

function getGuildId(): string {
  return requireEnv(
    "DISCORD_GUILD_ID or GUILD_ID or NEXT_PUBLIC_DISCORD_GUILD_ID",
    process.env.DISCORD_GUILD_ID ||
      process.env.GUILD_ID ||
      process.env.NEXT_PUBLIC_DISCORD_GUILD_ID
  );
}

function getSupabase(): SupabaseClient {
  if (supabase) return supabase;

  const url = requireEnv(
    "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  );

  const serviceRoleKey = requireEnv(
    "SUPABASE_SERVICE_ROLE",
    process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  supabase = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabase;
}

async function insertCommand(
  action: BotCommandAction,
  payload: Record<string, Json>,
  requestedBy?: string | null
): Promise<BotCommandRow> {
  const supabase = getSupabase();
  const guildId = getGuildId();

  const { data, error } = await supabase
    .from("bot_commands")
    .insert({
      guild_id: guildId,
      action,
      payload,
      requested_by: requestedBy ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to insert bot command");
  }

  return data as BotCommandRow;
}

export async function queueCreateTicket(input: {
  userId: string;
  category?: string;
  priority?: string;
  openingMessage?: string;
  ghost?: boolean;
  allowDuplicate?: boolean;
  requestedBy?: string | null;
  parentCategoryId?: string | null;
  staffRoleIds?: string[] | null;
}) {
  return insertCommand(
    "create_ticket",
    {
      user_id: String(input.userId),
      category: input.category ?? "support",
      priority: input.priority ?? "medium",
      opening_message: input.openingMessage ?? "",
      ghost: Boolean(input.ghost),
      allow_duplicate: Boolean(input.allowDuplicate),
      parent_category_id: input.parentCategoryId ?? null,
      staff_role_ids: input.staffRoleIds ?? null,
    },
    input.requestedBy
  );
}

export async function queueCloseTicket(input: {
  channelId: string;
  reason?: string;
  staffId?: string | null;
  requestedBy?: string | null;
}) {
  return insertCommand(
    "close_ticket",
    {
      channel_id: String(input.channelId),
      reason: input.reason ?? "Resolved",
      staff_id: input.staffId ?? null,
    },
    input.requestedBy
  );
}

export async function queueDeleteTicket(input: {
  channelId: string;
  ghost?: boolean;
  forceTranscript?: boolean;
  reason?: string;
  staffId?: string | null;
  requestedBy?: string | null;
}) {
  return insertCommand(
    "delete_ticket",
    {
      channel_id: String(input.channelId),
      ghost: Boolean(input.ghost),
      force_transcript: Boolean(input.forceTranscript),
      reason: input.reason ?? "Deleted from dashboard",
      staff_id: input.staffId ?? null,
    },
    input.requestedBy
  );
}

export async function queueReopenTicket(input: {
  channelId: string;
  requestedBy?: string | null;
}) {
  return insertCommand(
    "reopen_ticket",
    {
      channel_id: String(input.channelId),
    },
    input.requestedBy
  );
}

export async function queueAssignTicket(input: {
  channelId: string;
  staffId: string;
  requestedBy?: string | null;
}) {
  return insertCommand(
    "assign_ticket",
    {
      channel_id: String(input.channelId),
      staff_id: String(input.staffId),
    },
    input.requestedBy
  );
}

export async function queueSyncMembers(input?: {
  requestedBy?: string | null;
}) {
  return insertCommand("sync_members", {}, input?.requestedBy);
}

export async function queueReconcileDepartedMembers(input?: {
  requestedBy?: string | null;
}) {
  return insertCommand("reconcile_departed_members", {}, input?.requestedBy);
}

export async function queueSyncRoleMembers(input: {
  roleId: string;
  requestedBy?: string | null;
}) {
  return insertCommand(
    "sync_role_members",
    {
      role_id: String(input.roleId),
    },
    input.requestedBy
  );
}

export async function queueSyncActiveTickets(input?: {
  requestedBy?: string | null;
  includeClosedVisibleChannels?: boolean;
  dryRun?: boolean;
}) {
  return insertCommand(
    "sync_active_tickets",
    {
      include_closed_visible_channels:
        input?.includeClosedVisibleChannels ?? true,
      dry_run: Boolean(input?.dryRun),
    },
    input?.requestedBy
  );
}

export async function queuePortalTicketReply(input: {
  ticketId: string;
  channelId: string;
  userId: string;
  username?: string | null;
  content: string;
  messageId?: string | null;
  requestedBy?: string | null;
}) {
  return insertCommand(
    "portal_ticket_reply",
    {
      ticket_id: String(input.ticketId),
      channel_id: String(input.channelId),
      user_id: String(input.userId),
      username: input.username ?? null,
      content: String(input.content),
      message_id: input.messageId ?? null,
    },
    input.requestedBy ?? input.userId
  );
}

export async function getBotCommand(
  commandId: string
): Promise<BotCommandRow | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("bot_commands")
    .select("*")
    .eq("id", commandId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as BotCommandRow | null) ?? null;
}
