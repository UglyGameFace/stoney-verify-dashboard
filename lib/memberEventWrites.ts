import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type MemberEventInput = {
  guildId: string;
  userId: string;
  actorId?: string | null;
  actorName?: string | null;
  eventType: string;
  title?: string | null;
  reason?: string | null;
  metadata?: Record<string, Json> | null;
};

type MemberEntryPatchInput = {
  guildId: string;
  userId: string;
  invitedBy?: string | null;
  invitedByName?: string | null;
  inviteCode?: string | null;
  vouchedBy?: string | null;
  vouchedByName?: string | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  verificationTicketId?: string | null;
  sourceTicketId?: string | null;
  entryMethod?: string | null;
  verificationSource?: string | null;
  entryReason?: string | null;
  approvalReason?: string | null;
};

type MemberJoinPatchInput = {
  guildId: string;
  userId: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  invitedBy?: string | null;
  invitedByName?: string | null;
  inviteCode?: string | null;
  entryMethod?: string | null;
  verificationSource?: string | null;
  vouchedBy?: string | null;
  vouchedByName?: string | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  sourceTicketId?: string | null;
  joinNote?: string | null;
};

let serviceClient: SupabaseClient | null = null;

function requireEnv(name: string, value: string | undefined): string {
  const out = String(value || "").trim();
  if (!out) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return out;
}

function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;

  const url = requireEnv(
    "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  );

  const key = requireEnv(
    "SUPABASE_SERVICE_ROLE or SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  serviceClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serviceClient;
}

function normalizeString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function cleanPatch<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Partial<T> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      (out as Record<string, unknown>)[key] = value;
    }
  }

  return out;
}

export async function insertMemberEvent(
  input: MemberEventInput,
  supabase?: SupabaseClient
) {
  const client = supabase || getServiceClient();

  const payload = {
    guild_id: String(input.guildId).trim(),
    user_id: String(input.userId).trim(),
    actor_id: normalizeString(input.actorId),
    actor_name: normalizeString(input.actorName),
    event_type: String(input.eventType || "").trim(),
    title: normalizeString(input.title),
    reason: normalizeString(input.reason),
    metadata: input.metadata || {},
  };

  if (!payload.guild_id || !payload.user_id || !payload.event_type) {
    throw new Error("insertMemberEvent requires guildId, userId, and eventType.");
  }

  const { error } = await client.from("member_events").insert(payload);

  if (error) {
    throw new Error(error.message || "Failed to insert member event.");
  }
}

export async function patchGuildMemberEntryFields(
  input: MemberEntryPatchInput,
  supabase?: SupabaseClient
) {
  const client = supabase || getServiceClient();
  const now = new Date().toISOString();

  const patch = cleanPatch({
    invited_by: normalizeString(input.invitedBy),
    invited_by_name: normalizeString(input.invitedByName),
    invite_code: normalizeString(input.inviteCode),
    vouched_by: normalizeString(input.vouchedBy),
    vouched_by_name: normalizeString(input.vouchedByName),
    approved_by: normalizeString(input.approvedBy),
    approved_by_name: normalizeString(input.approvedByName),
    verification_ticket_id: normalizeString(input.verificationTicketId),
    source_ticket_id: normalizeString(input.sourceTicketId),
    entry_method: normalizeString(input.entryMethod),
    verification_source: normalizeString(input.verificationSource),
    entry_reason: normalizeString(input.entryReason),
    approval_reason: normalizeString(input.approvalReason),
    updated_at: now,
  });

  if (!String(input.guildId || "").trim() || !String(input.userId || "").trim()) {
    throw new Error("patchGuildMemberEntryFields requires guildId and userId.");
  }

  if (!Object.keys(patch).length) {
    return;
  }

  const { error } = await client
    .from("guild_members")
    .update(patch)
    .eq("guild_id", String(input.guildId).trim())
    .eq("user_id", String(input.userId).trim());

  if (error) {
    throw new Error(error.message || "Failed to patch guild_members entry fields.");
  }
}

export async function patchLatestMemberJoinContext(
  input: MemberJoinPatchInput,
  supabase?: SupabaseClient
) {
  const client = supabase || getServiceClient();

  const guildId = String(input.guildId || "").trim();
  const userId = String(input.userId || "").trim();

  if (!guildId || !userId) {
    throw new Error("patchLatestMemberJoinContext requires guildId and userId.");
  }

  const { data: latestJoin, error: readError } = await client
    .from("member_joins")
    .select("id")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message || "Failed to read latest member join row.");
  }

  if (!latestJoin?.id) {
    return;
  }

  const patch = cleanPatch({
    username: normalizeString(input.username),
    display_name: normalizeString(input.displayName),
    avatar_url: normalizeString(input.avatarUrl),
    invited_by: normalizeString(input.invitedBy),
    invited_by_name: normalizeString(input.invitedByName),
    invite_code: normalizeString(input.inviteCode),
    entry_method: normalizeString(input.entryMethod),
    verification_source: normalizeString(input.verificationSource),
    vouched_by: normalizeString(input.vouchedBy),
    vouched_by_name: normalizeString(input.vouchedByName),
    approved_by: normalizeString(input.approvedBy),
    approved_by_name: normalizeString(input.approvedByName),
    source_ticket_id: normalizeString(input.sourceTicketId),
    join_note: normalizeString(input.joinNote),
  });

  if (!Object.keys(patch).length) {
    return;
  }

  const { error: updateError } = await client
    .from("member_joins")
    .update(patch)
    .eq("id", latestJoin.id);

  if (updateError) {
    throw new Error(updateError.message || "Failed to patch member_joins context.");
  }
}
