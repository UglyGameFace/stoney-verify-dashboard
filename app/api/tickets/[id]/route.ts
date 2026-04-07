import { createServerSupabase } from "@/lib/supabase-server";
import {
  requireStaffSessionForRoute,
  applyAuthCookies,
} from "@/lib/auth-server";
import { env } from "@/lib/env";
import { enrichTicketWithMatchedCategory } from "@/lib/ticketCategoryMatching";
import {
  insertMemberEvent,
  patchGuildMemberEntryFields,
  patchLatestMemberJoinContext,
} from "@/lib/memberEventWrites";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type JsonRecord = Record<string, unknown>;
type RefreshedTokens = unknown;

type RouteContext = {
  params: {
    id?: string;
  };
};

type SessionLike = {
  user?: {
    discord_id?: string | null;
    id?: string | null;
    user_id?: string | null;
    username?: string | null;
    name?: string | null;
  } | null;
  discordUser?: {
    id?: string | null;
    username?: string | null;
  } | null;
};

type TicketRow = {
  id?: string | null;
  guild_id?: string | null;
  user_id?: string | null;
  username?: string | null;
  title?: string | null;
  category?: string | null;
  category_id?: string | null;
  category_override?: boolean | null;
  category_set_by?: string | null;
  category_set_at?: string | null;
  status?: string | null;
  priority?: string | null;
  claimed_by?: string | null;
  assigned_to?: string | null;
  closed_by?: string | null;
  closed_reason?: string | null;
  closed_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  initial_message?: string | null;
  channel_id?: string | null;
  discord_thread_id?: string | null;
  channel_name?: string | null;
  transcript_url?: string | null;
  transcript_message_id?: string | null;
  transcript_channel_id?: string | null;
  source?: string | null;
  is_ghost?: boolean | null;
  matched_category_id?: string | null;
  matched_category_name?: string | null;
  matched_category_slug?: string | null;
  matched_intake_type?: string | null;
  matched_category_reason?: string | null;
  matched_category_score?: number | null;
  ticket_number?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
  sla_deadline?: string | null;
};

type GuildMemberRow = {
  guild_id?: string | null;
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  nickname?: string | null;
  avatar_url?: string | null;
  role_ids?: string[] | null;
  role_names?: string[] | null;
  roles?: JsonRecord[] | null;
  in_guild?: boolean | null;
  has_unverified?: boolean | null;
  has_verified_role?: boolean | null;
  has_staff_role?: boolean | null;
  has_secondary_verified_role?: boolean | null;
  has_cosmetic_only?: boolean | null;
  role_state?: string | null;
  role_state_reason?: string | null;
  is_bot?: boolean | null;
  entry_method?: string | null;
  verification_source?: string | null;
  entry_reason?: string | null;
  approval_reason?: string | null;
  invited_by?: string | null;
  invited_by_name?: string | null;
  invite_code?: string | null;
  vouched_by?: string | null;
  vouched_by_name?: string | null;
  approved_by?: string | null;
  approved_by_name?: string | null;
  verification_ticket_id?: string | null;
  source_ticket_id?: string | null;

  risk_score?: number | null;
  risk_level?: string | null;
  risk_reasons?: string[] | null;
  fingerprint?: string | null;
  alt_cluster_key?: string | null;
  alt_cluster_size?: number | null;
  burst_join_count?: number | null;
  same_fingerprint_count?: number | null;
  similar_name_count?: number | null;
  same_age_bucket_count?: number | null;
  suspicious_name_pattern?: boolean | null;
  repeated_char_pattern?: boolean | null;
  default_avatar?: boolean | null;
  account_age_days?: number | null;
  age_bucket?: string | null;
  digit_ratio?: number | null;
  underscore_ratio?: number | null;
  cluster_members?: JsonRecord[] | null;
  suspicion_flags?: string[] | null;
  risk_last_evaluated_at?: string | null;
  last_join_risk_score?: number | null;
  last_join_risk_level?: string | null;
  last_join_fingerprint?: string | null;
  alt_notes?: string | null;
};

type TicketCategoryRow = {
  id?: string | null;
  guild_id?: string | null;
  name?: string | null;
  slug?: string | null;
  color?: string | null;
  description?: string | null;
  intake_type?: string | null;
  match_keywords?: string[] | null;
  button_label?: string | null;
  sort_order?: number | null;
  is_default?: boolean | null;
};

type TicketNoteRow = {
  id?: string | null;
  ticket_id?: string | null;
  staff_id?: string | null;
  staff_name?: string | null;
  content?: string | null;
  created_at?: string | null;
};

type TicketMessageRow = {
  id?: string | null;
  ticket_id?: string | null;
  author_id?: string | null;
  author_name?: string | null;
  content?: string | null;
  message_type?: string | null;
  created_at?: string | null;
  attachments?: JsonRecord[] | null;
  source?: string | null;
};

type VerificationFlagRow = {
  id?: string | null;
  user_id?: string | null;
  score?: number | null;
  flagged?: boolean | null;
  reasons?: string[] | null;
  created_at?: string | null;
};

type VerificationTokenRow = {
  token?: string | null;
  requester_id?: string | null;
  user_id?: string | null;
  approved_user_id?: string | null;
  status?: string | null;
  decision?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  submitted_at?: string | null;
  decided_at?: string | null;
  expires_at?: string | null;
  role_sync_ok?: boolean | null;
  role_sync_reason?: string | null;
  ai_status?: string | null;
  decided_by?: string | null;
  decided_by_display_name?: string | null;
  decided_by_username?: string | null;
};

type VcSessionRow = {
  token?: string | null;
  guild_id?: string | number | null;
  ticket_channel_id?: string | number | null;
  requester_id?: string | number | null;
  owner_id?: string | number | null;
  vc_channel_id?: string | number | null;
  queue_channel_id?: string | number | null;
  accepted_by?: string | number | null;
  canceled_by?: string | number | null;
  status?: string | null;
  created_at?: string | null;
  accepted_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  canceled_at?: string | null;
  revoke_at?: string | null;
  access_minutes?: number | null;
  meta?: JsonRecord | null;
};

type WarnRow = {
  id?: string | null;
  user_id?: string | null;
  reason?: string | null;
  created_at?: string | null;
};

type MemberEventRow = {
  id?: string | null;
  user_id?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  event_type?: string | null;
  title?: string | null;
  reason?: string | null;
  metadata?: JsonRecord | null;
  created_at?: string | null;
};

type MemberJoinRow = {
  id?: string | null;
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  joined_at?: string | null;
  entry_method?: string | null;
  verification_source?: string | null;
  invite_code?: string | null;
  invited_by?: string | null;
  invited_by_name?: string | null;
  vouched_by?: string | null;
  vouched_by_name?: string | null;
  approved_by?: string | null;
  approved_by_name?: string | null;
  join_note?: string | null;
  source_ticket_id?: string | null;

  risk_score?: number | null;
  risk_level?: string | null;
  risk_reasons?: string[] | null;
  fingerprint?: string | null;
  alt_cluster_key?: string | null;
  alt_cluster_size?: number | null;
  burst_join_count?: number | null;
  same_fingerprint_count?: number | null;
  similar_name_count?: number | null;
  same_age_bucket_count?: number | null;
  suspicious_name_pattern?: boolean | null;
  repeated_char_pattern?: boolean | null;
  default_avatar?: boolean | null;
  account_age_days?: number | null;
  age_bucket?: string | null;
  digit_ratio?: number | null;
  underscore_ratio?: number | null;
  cluster_members?: JsonRecord[] | null;
  suspicion_flags?: string[] | null;
  risk_evaluated_at?: string | null;
  join_fingerprint?: string | null;
};

type ActivityFeedRow = {
  id?: string | null;
  created_at?: string | null;
  title?: string | null;
  description?: string | null;
  reason?: string | null;
  event_family?: string | null;
  event_type?: string | null;
  source?: string | null;
  actor_user_id?: string | null;
  actor_name?: string | null;
  target_user_id?: string | null;
  target_name?: string | null;
  channel_id?: string | null;
  channel_name?: string | null;
  ticket_id?: string | null;
  metadata?: JsonRecord | null;
};

type AltRiskSourceRow = {
  risk_score?: number | null;
  risk_level?: string | null;
  risk_reasons?: string[] | null;
  fingerprint?: string | null;
  alt_cluster_key?: string | null;
  alt_cluster_size?: number | null;
  burst_join_count?: number | null;
  same_fingerprint_count?: number | null;
  similar_name_count?: number | null;
  same_age_bucket_count?: number | null;
  suspicious_name_pattern?: boolean | null;
  repeated_char_pattern?: boolean | null;
  default_avatar?: boolean | null;
  account_age_days?: number | null;
  age_bucket?: string | null;
  digit_ratio?: number | null;
  underscore_ratio?: number | null;
  cluster_members?: JsonRecord[] | null;
  suspicion_flags?: string[] | null;
  risk_last_evaluated_at?: string | null;
  risk_evaluated_at?: string | null;
  last_join_risk_score?: number | null;
  last_join_risk_level?: string | null;
  last_join_fingerprint?: string | null;
  join_fingerprint?: string | null;
  alt_notes?: string | null;
};

type CategoryPatchAction = "update-category" | "clear-category-override";
type ContextPatchAction = "link-verification-context";
type PatchAction = CategoryPatchAction | ContextPatchAction;

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeLower(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const clean = normalizeString(value).toLowerCase();
  return clean === "true" || clean === "1" || clean === "yes" || clean === "on";
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeObject<T extends object = JsonRecord>(value: unknown): T {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : ({} as T);
}

function normalizeStringArray(value: unknown): string[] {
  return safeArray(value)
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function normalizeJsonRecordArray(value: unknown): JsonRecord[] {
  return safeArray<JsonRecord>(value).filter(
    (item) => Boolean(item) && typeof item === "object" && !Array.isArray(item)
  );
}

function parseDateMs(value: unknown): number {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }

  if (typeof value === "string" || typeof value === "number") {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }

  return 0;
}

function newestTimestamp(...values: unknown[]): number {
  return Math.max(...values.map(parseDateMs), 0);
}

function truncateText(value: unknown, max = 220): string {
  const text = normalizeString(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function buildJsonResponse(
  payload: Record<string, unknown>,
  status = 200,
  refreshedTokens: RefreshedTokens | null = null
): Response {
  const response = new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });

  applyAuthCookies(response, refreshedTokens);
  return response;
}

function buildErrorResponse(
  message: string,
  status = 500,
  refreshedTokens: RefreshedTokens | null = null
): Response {
  return buildJsonResponse({ error: message }, status, refreshedTokens);
}

function mapTicket(row: TicketRow): TicketRow {
  return {
    ...row,
    priority: row?.priority || "medium",
    channel_id: row?.channel_id || row?.discord_thread_id || null,
    channel_name: row?.channel_name || null,
    source: row?.source || "discord",
    is_ghost: Boolean(row?.is_ghost),
  };
}

function mapGuildMember(row: GuildMemberRow | null): GuildMemberRow | null {
  if (!row) return null;

  return {
    ...row,
    user_id: normalizeString(row?.user_id),
    username: row?.username || "",
    display_name: row?.display_name || "",
    nickname: row?.nickname || "",
    avatar_url: row?.avatar_url || null,
    role_ids: Array.isArray(row?.role_ids) ? row.role_ids : [],
    role_names: Array.isArray(row?.role_names) ? row.role_names : [],
    roles: Array.isArray(row?.roles) ? row.roles : [],
    in_guild: row?.in_guild !== false,
    has_unverified: Boolean(row?.has_unverified),
    has_verified_role: Boolean(row?.has_verified_role),
    has_staff_role: Boolean(row?.has_staff_role),
    has_secondary_verified_role: Boolean(row?.has_secondary_verified_role),
    has_cosmetic_only: Boolean(row?.has_cosmetic_only),
    role_state: row?.role_state || "unknown",
    role_state_reason: row?.role_state_reason || "",
    is_bot: Boolean(row?.is_bot),

    risk_score: normalizeNumber(row?.risk_score, 0),
    risk_level: normalizeLower(row?.risk_level) || null,
    risk_reasons: normalizeStringArray(row?.risk_reasons),
    fingerprint: normalizeString(row?.fingerprint) || null,
    alt_cluster_key: normalizeString(row?.alt_cluster_key) || null,
    alt_cluster_size: normalizeNumber(row?.alt_cluster_size, 0),
    burst_join_count: normalizeNumber(row?.burst_join_count, 0),
    same_fingerprint_count: normalizeNumber(row?.same_fingerprint_count, 0),
    similar_name_count: normalizeNumber(row?.similar_name_count, 0),
    same_age_bucket_count: normalizeNumber(row?.same_age_bucket_count, 0),
    suspicious_name_pattern: Boolean(row?.suspicious_name_pattern),
    repeated_char_pattern: Boolean(row?.repeated_char_pattern),
    default_avatar: Boolean(row?.default_avatar),
    account_age_days:
      row?.account_age_days === null || row?.account_age_days === undefined
        ? null
        : normalizeNumber(row?.account_age_days, 0),
    age_bucket: normalizeString(row?.age_bucket) || null,
    digit_ratio: normalizeNumber(row?.digit_ratio, 0),
    underscore_ratio: normalizeNumber(row?.underscore_ratio, 0),
    cluster_members: normalizeJsonRecordArray(row?.cluster_members),
    suspicion_flags: normalizeStringArray(row?.suspicion_flags),
    risk_last_evaluated_at: row?.risk_last_evaluated_at || null,
    last_join_risk_score: normalizeNumber(row?.last_join_risk_score, 0),
    last_join_risk_level: normalizeLower(row?.last_join_risk_level) || null,
    last_join_fingerprint: normalizeString(row?.last_join_fingerprint) || null,
    alt_notes: normalizeString(row?.alt_notes) || null,
  };
}

function mapTicketNote(row: TicketNoteRow): TicketNoteRow {
  return {
    ...row,
    ticket_id: normalizeString(row?.ticket_id),
    staff_id: normalizeString(row?.staff_id),
    staff_name: row?.staff_name || "",
    content: row?.content || "",
    created_at: row?.created_at || null,
  };
}

function mapTicketMessage(row: TicketMessageRow): TicketMessageRow {
  return {
    ...row,
    ticket_id: normalizeString(row?.ticket_id),
    author_id: normalizeString(row?.author_id),
    author_name: row?.author_name || "",
    content: row?.content || "",
    message_type: normalizeLower(row?.message_type || "staff") || "staff",
    created_at: row?.created_at || null,
    attachments: safeArray<JsonRecord>(row?.attachments),
    source: row?.source || null,
  };
}

function mapVerificationFlag(row: VerificationFlagRow): VerificationFlagRow {
  return {
    ...row,
    user_id: normalizeString(row?.user_id),
    score: normalizeNumber(row?.score, 0),
    flagged: Boolean(row?.flagged),
    reasons: Array.isArray(row?.reasons) ? row.reasons : [],
    created_at: row?.created_at || null,
  };
}

function mapVerificationToken(row: VerificationTokenRow): VerificationTokenRow {
  return {
    ...row,
    requester_id: normalizeString(row?.requester_id),
    user_id: normalizeString(row?.user_id),
    approved_user_id: normalizeString(row?.approved_user_id),
    status: normalizeLower(row?.status || "pending") || "pending",
    decision: normalizeString(row?.decision || "PENDING").toUpperCase() || "PENDING",
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
    submitted_at: row?.submitted_at || null,
    decided_at: row?.decided_at || null,
    expires_at: row?.expires_at || null,
    role_sync_ok: Boolean(row?.role_sync_ok),
    role_sync_reason: row?.role_sync_reason || null,
    ai_status: row?.ai_status || null,
  };
}

function mapVcSession(row: VcSessionRow): VcSessionRow {
  return {
    ...row,
    token: row?.token || null,
    guild_id: normalizeString(row?.guild_id),
    ticket_channel_id: normalizeString(row?.ticket_channel_id),
    requester_id: normalizeString(row?.requester_id),
    owner_id: normalizeString(row?.owner_id),
    vc_channel_id: normalizeString(row?.vc_channel_id),
    queue_channel_id: normalizeString(row?.queue_channel_id),
    accepted_by: normalizeString(row?.accepted_by),
    canceled_by: normalizeString(row?.canceled_by),
    status: normalizeString(row?.status || "PENDING").toUpperCase() || "PENDING",
    created_at: row?.created_at || null,
    accepted_at: row?.accepted_at || null,
    started_at: row?.started_at || null,
    completed_at: row?.completed_at || null,
    canceled_at: row?.canceled_at || null,
    revoke_at: row?.revoke_at || null,
    access_minutes: normalizeNumber(row?.access_minutes, 0),
    meta: safeObject(row?.meta),
  };
}

function mapWarn(row: WarnRow): WarnRow {
  return {
    ...row,
    user_id: normalizeString(row?.user_id),
    reason: row?.reason || "",
    created_at: row?.created_at || null,
  };
}

function mapMemberEvent(row: MemberEventRow): MemberEventRow {
  return {
    ...row,
    user_id: normalizeString(row?.user_id),
    actor_id: normalizeString(row?.actor_id),
    actor_name: row?.actor_name || "",
    event_type: normalizeLower(row?.event_type),
    title: row?.title || "",
    reason: row?.reason || "",
    metadata: safeObject(row?.metadata),
    created_at: row?.created_at || null,
  };
}

function mapJoin(row: MemberJoinRow): MemberJoinRow {
  return {
    ...row,
    user_id: normalizeString(row?.user_id),
    username: row?.username || "",
    display_name: row?.display_name || "",
    avatar_url: row?.avatar_url || null,
    joined_at: row?.joined_at || null,
    entry_method: row?.entry_method || null,
    verification_source: row?.verification_source || null,
    invite_code: row?.invite_code || null,
    invited_by: row?.invited_by || null,
    invited_by_name: row?.invited_by_name || null,
    vouched_by: row?.vouched_by || null,
    vouched_by_name: row?.vouched_by_name || null,
    approved_by: row?.approved_by || null,
    approved_by_name: row?.approved_by_name || null,
    join_note: row?.join_note || null,
    source_ticket_id: row?.source_ticket_id || null,

    risk_score: normalizeNumber(row?.risk_score, 0),
    risk_level: normalizeLower(row?.risk_level) || null,
    risk_reasons: normalizeStringArray(row?.risk_reasons),
    fingerprint: normalizeString(row?.fingerprint) || null,
    alt_cluster_key: normalizeString(row?.alt_cluster_key) || null,
    alt_cluster_size: normalizeNumber(row?.alt_cluster_size, 0),
    burst_join_count: normalizeNumber(row?.burst_join_count, 0),
    same_fingerprint_count: normalizeNumber(row?.same_fingerprint_count, 0),
    similar_name_count: normalizeNumber(row?.similar_name_count, 0),
    same_age_bucket_count: normalizeNumber(row?.same_age_bucket_count, 0),
    suspicious_name_pattern: Boolean(row?.suspicious_name_pattern),
    repeated_char_pattern: Boolean(row?.repeated_char_pattern),
    default_avatar: Boolean(row?.default_avatar),
    account_age_days:
      row?.account_age_days === null || row?.account_age_days === undefined
        ? null
        : normalizeNumber(row?.account_age_days, 0),
    age_bucket: normalizeString(row?.age_bucket) || null,
    digit_ratio: normalizeNumber(row?.digit_ratio, 0),
    underscore_ratio: normalizeNumber(row?.underscore_ratio, 0),
    cluster_members: normalizeJsonRecordArray(row?.cluster_members),
    suspicion_flags: normalizeStringArray(row?.suspicion_flags),
    risk_evaluated_at: row?.risk_evaluated_at || null,
    join_fingerprint: normalizeString(row?.join_fingerprint) || null,
  };
}

function mapActivityRow(row: ActivityFeedRow): ActivityFeedRow {
  const meta = safeObject(row?.metadata);

  return {
    id: row?.id || null,
    created_at: row?.created_at || null,
    title: row?.title || row?.event_type || "Activity",
    description: row?.description || row?.reason || "",
    reason: row?.reason || "",
    event_family: row?.event_family || "activity",
    event_type: row?.event_type || "activity",
    source: row?.source || "system",
    actor_user_id: normalizeString(row?.actor_user_id),
    actor_name: row?.actor_name || "",
    target_user_id: normalizeString(row?.target_user_id),
    target_name: row?.target_name || "",
    channel_id: row?.channel_id || normalizeString((meta as JsonRecord)?.channel_id) || null,
    channel_name: row?.channel_name || normalizeString((meta as JsonRecord)?.channel_name) || null,
    ticket_id: row?.ticket_id || normalizeString((meta as JsonRecord)?.ticket_id) || null,
    metadata: meta,
  };
}

function getActorIdentity(session: SessionLike | null | undefined) {
  return {
    actorId:
      session?.user?.discord_id ||
      session?.user?.id ||
      session?.user?.user_id ||
      session?.discordUser?.id ||
      null,
    actorName:
      session?.user?.username ||
      session?.user?.name ||
      session?.discordUser?.username ||
      "Dashboard Staff",
  };
}

function hasAltRiskData(row: AltRiskSourceRow | null | undefined): boolean {
  if (!row) return false;

  if (normalizeString(row?.risk_level)) return true;
  if (normalizeString(row?.fingerprint)) return true;
  if (normalizeString(row?.alt_cluster_key)) return true;
  if (normalizeString(row?.last_join_fingerprint)) return true;
  if (normalizeString(row?.join_fingerprint)) return true;
  if (normalizeNumber(row?.risk_score, -1) >= 0) return true;
  if (normalizeNumber(row?.alt_cluster_size, 0) > 0) return true;
  if (normalizeStringArray(row?.risk_reasons).length > 0) return true;

  return false;
}

function formatAltRiskLabel(level: unknown): string {
  const clean = normalizeLower(level);

  if (clean === "critical") return "Critical Alt Risk";
  if (clean === "high") return "High Alt Risk";
  if (clean === "medium") return "Medium Alt Risk";
  if (clean === "low") return "Low Alt Risk";
  return "Unknown Alt Risk";
}

function buildAltRiskSnapshot(
  member: GuildMemberRow | null,
  latestJoin: MemberJoinRow | null
) {
  const source = hasAltRiskData(member)
    ? member
    : hasAltRiskData(latestJoin)
      ? latestJoin
      : null;

  const sourceLabel = hasAltRiskData(member)
    ? "guild_member"
    : hasAltRiskData(latestJoin)
      ? "member_join"
      : "none";

  return {
    source: sourceLabel,
    score: normalizeNumber(
      source?.risk_score,
      normalizeNumber(source?.last_join_risk_score, 0)
    ),
    level:
      normalizeLower(source?.risk_level || source?.last_join_risk_level) || "low",
    reasons: normalizeStringArray(source?.risk_reasons),
    fingerprint:
      normalizeString(
        source?.fingerprint ||
          source?.last_join_fingerprint ||
          source?.join_fingerprint
      ) || null,
    altClusterKey: normalizeString(source?.alt_cluster_key) || null,
    altClusterSize: normalizeNumber(source?.alt_cluster_size, 0),
    burstJoinCount: normalizeNumber(source?.burst_join_count, 0),
    sameFingerprintCount: normalizeNumber(source?.same_fingerprint_count, 0),
    similarNameCount: normalizeNumber(source?.similar_name_count, 0),
    sameAgeBucketCount: normalizeNumber(source?.same_age_bucket_count, 0),
    suspiciousNamePattern: Boolean(source?.suspicious_name_pattern),
    repeatedCharPattern: Boolean(source?.repeated_char_pattern),
    defaultAvatar: Boolean(source?.default_avatar),
    accountAgeDays:
      source?.account_age_days === null || source?.account_age_days === undefined
        ? null
        : normalizeNumber(source?.account_age_days, 0),
    ageBucket: normalizeString(source?.age_bucket) || null,
    digitRatio: normalizeNumber(source?.digit_ratio, 0),
    underscoreRatio: normalizeNumber(source?.underscore_ratio, 0),
    clusterMembers: normalizeJsonRecordArray(source?.cluster_members),
    suspicionFlags: normalizeStringArray(source?.suspicion_flags),
    riskEvaluatedAt:
      normalizeString(source?.risk_last_evaluated_at || source?.risk_evaluated_at) ||
      null,
    lastJoinRiskScore: normalizeNumber(
      source?.last_join_risk_score,
      normalizeNumber(source?.risk_score, 0)
    ),
    lastJoinRiskLevel:
      normalizeLower(source?.last_join_risk_level || source?.risk_level) || "low",
    lastJoinFingerprint:
      normalizeString(
        source?.last_join_fingerprint ||
          source?.join_fingerprint ||
          source?.fingerprint
      ) || null,
    altNotes: normalizeString(source?.alt_notes) || null,
  };
}

function indexCategories(rows: TicketCategoryRow[]) {
  const byId = new Map<string, TicketCategoryRow>();
  const bySlug = new Map<string, TicketCategoryRow>();
  const byName = new Map<string, TicketCategoryRow>();

  for (const row of safeArray<TicketCategoryRow>(rows)) {
    const id = normalizeString(row?.id);
    const slug = normalizeLower(row?.slug);
    const name = normalizeLower(row?.name);
    if (id) byId.set(id, row);
    if (slug) bySlug.set(slug, row);
    if (name) byName.set(name, row);
  }

  return { byId, bySlug, byName };
}

function getTicketCategoryRow(
  ticket: TicketRow,
  categoryIndex: ReturnType<typeof indexCategories>
): TicketCategoryRow | null {
  const idCandidates = [ticket?.category_id, ticket?.matched_category_id]
    .map(normalizeString)
    .filter(Boolean);

  for (const id of idCandidates) {
    if (categoryIndex.byId.has(id)) return categoryIndex.byId.get(id) || null;
  }

  const slugCandidates = [
    ticket?.matched_category_slug,
    ticket?.category,
    ticket?.matched_intake_type,
  ]
    .map(normalizeLower)
    .filter(Boolean);

  for (const slug of slugCandidates) {
    if (categoryIndex.bySlug.has(slug)) return categoryIndex.bySlug.get(slug) || null;
  }

  return null;
}

function findCategoryFromPatch(
  patch: {
    category_id?: string | null;
    category?: string | null;
  },
  categoryIndex: ReturnType<typeof indexCategories>
): TicketCategoryRow | null {
  const categoryId = normalizeString(patch?.category_id);
  if (categoryId && categoryIndex.byId.has(categoryId)) {
    return categoryIndex.byId.get(categoryId) || null;
  }

  const categoryKey = normalizeLower(patch?.category);
  if (!categoryKey) return null;

  return (
    categoryIndex.bySlug.get(categoryKey) ||
    categoryIndex.byName.get(categoryKey) ||
    null
  );
}

function deriveVerificationLabel(args: {
  member: GuildMemberRow | null;
  latestToken: VerificationTokenRow | null;
  latestVc: VcSessionRow | null;
  flaggedCount: number;
  ticket: TicketRow;
}): string {
  const { member, latestToken, latestVc, flaggedCount, ticket } = args;
  const tokenStatus = normalizeLower(latestToken?.status);
  const tokenDecision = normalizeString(latestToken?.decision).toUpperCase();
  const vcStatus = normalizeString(latestVc?.status).toUpperCase();

  if (member?.has_staff_role) return "Staff";
  if (
    member?.has_verified_role ||
    member?.has_secondary_verified_role ||
    tokenStatus === "approved" ||
    tokenDecision === "APPROVED"
  ) {
    return "Verified";
  }

  if (tokenStatus === "denied" || tokenDecision === "DENIED") {
    return "Denied";
  }

  if (flaggedCount > 0) {
    return "Needs Review";
  }

  if (
    ["PENDING", "ACCEPTED", "STAFF_ACCEPTED", "READY", "IN_VC", "STARTED"].includes(
      vcStatus
    )
  ) {
    return "VC In Progress";
  }

  if (
    tokenStatus === "pending" ||
    tokenStatus === "submitted" ||
    tokenStatus === "resubmit" ||
    member?.has_unverified ||
    normalizeLower(ticket?.matched_intake_type) === "verification"
  ) {
    return "Pending";
  }

  return "Unknown";
}

function deriveSlaState(ticket: TicketRow) {
  const status = normalizeLower(ticket?.status);
  const deadlineMs = parseDateMs(ticket?.sla_deadline);

  if (status === "closed" || status === "deleted") {
    return {
      sla_status: "closed",
      overdue: false,
      minutes_overdue: 0,
      minutes_until_deadline: 0,
    };
  }

  if (!deadlineMs) {
    return {
      sla_status: "no_deadline",
      overdue: false,
      minutes_overdue: 0,
      minutes_until_deadline: 0,
    };
  }

  const diffMinutes = Math.floor((deadlineMs - Date.now()) / 60000);

  if (diffMinutes < 0) {
    return {
      sla_status: "overdue",
      overdue: true,
      minutes_overdue: Math.abs(diffMinutes),
      minutes_until_deadline: 0,
    };
  }

  return {
    sla_status: "counting_down",
    overdue: false,
    minutes_overdue: 0,
    minutes_until_deadline: diffMinutes,
  };
}

function deriveRiskLevel(args: {
  ticket: TicketRow;
  member: GuildMemberRow | null;
  flaggedCount: number;
  warnCount: number;
  maxFlagScore: number;
  noteCount: number;
  slaState: {
    overdue: boolean;
  };
}): string {
  const { ticket, member, flaggedCount, warnCount, maxFlagScore, noteCount, slaState } = args;
  const priority = normalizeLower(ticket?.priority);

  if (
    slaState?.overdue ||
    flaggedCount > 0 ||
    maxFlagScore >= 5 ||
    warnCount >= 3 ||
    priority === "urgent"
  ) {
    return "high";
  }

  if (
    priority === "high" ||
    warnCount >= 1 ||
    maxFlagScore >= 2 ||
    (member?.has_unverified && normalizeLower(ticket?.matched_intake_type) === "verification") ||
    noteCount === 0
  ) {
    return "medium";
  }

  return "low";
}

function deriveRecommendedActions(args: {
  ticket: TicketRow;
  member: GuildMemberRow | null;
  flaggedCount: number;
  latestVc: VcSessionRow | null;
  noteCount: number;
  slaState: {
    overdue: boolean;
  };
}): string[] {
  const { ticket, member, flaggedCount, latestVc, noteCount, slaState } = args;
  const actions: string[] = [];

  if (!normalizeString(ticket?.claimed_by) && !normalizeString(ticket?.assigned_to)) {
    actions.push("Claim this ticket.");
  }

  if (slaState?.overdue) {
    actions.push("Respond now — this ticket is overdue.");
  }

  if (flaggedCount > 0) {
    actions.push("Review verification flags before resolving.");
  }

  const vcStatus = normalizeString(latestVc?.status).toUpperCase();
  if (["PENDING", "ACCEPTED", "STAFF_ACCEPTED", "READY", "IN_VC", "STARTED"].includes(vcStatus)) {
    actions.push("Check VC verification status before deciding.");
  }

  if (noteCount === 0) {
    actions.push("Add an internal note for staff continuity.");
  }

  if (normalizeLower(ticket?.matched_intake_type) === "verification" && member?.has_unverified) {
    actions.push("Confirm verification path and final role state.");
  }

  return [...new Set(actions)].slice(0, 6);
}

function latestBy<T extends Record<string, unknown>>(
  rows: T[],
  ...fields: string[]
): T | null {
  return [...safeArray<T>(rows)].sort((a, b) => {
    const aTs = newestTimestamp(...fields.map((field) => a?.[field]));
    const bTs = newestTimestamp(...fields.map((field) => b?.[field]));
    return bTs - aTs;
  })[0] || null;
}

function buildTimeline(args: {
  activityRows: ActivityFeedRow[];
  memberEvents: MemberEventRow[];
  verificationFlags: VerificationFlagRow[];
  verificationTokens: VerificationTokenRow[];
  vcSessions: VcSessionRow[];
  notes: TicketNoteRow[];
}) {
  const {
    activityRows,
    memberEvents,
    verificationFlags,
    verificationTokens,
    vcSessions,
    notes,
  } = args;

  const items: Array<Record<string, unknown>> = [];

  for (const row of safeArray<ActivityFeedRow>(activityRows)) {
    items.push({
      id: `activity:${row.id || row.created_at}`,
      type: row.event_type || "activity",
      title: row.title || "Activity",
      description: row.description || "",
      created_at: row.created_at || null,
      actor_name: row.actor_name || "System",
      actor_id: row.actor_user_id || null,
      source: row.source || "activity_feed_events",
      raw: row,
    });
  }

  for (const row of safeArray<MemberEventRow>(memberEvents)) {
    items.push({
      id: `member_event:${row.id || row.created_at}`,
      type: row.event_type || "member_event",
      title: row.title || "Member Event",
      description: row.reason || "",
      created_at: row.created_at || null,
      actor_name: row.actor_name || "System",
      actor_id: row.actor_id || null,
      source: "member_events",
      raw: row,
    });
  }

  for (const row of safeArray<VerificationFlagRow>(verificationFlags)) {
    items.push({
      id: `flag:${row.id || row.created_at}`,
      type: "verification_flag",
      title: row.flagged ? "Verification Flag Raised" : "Verification Reviewed",
      description: Array.isArray(row.reasons) ? row.reasons.join(" • ") : "",
      created_at: row.created_at || null,
      actor_name: "System",
      actor_id: null,
      source: "verification_flags",
      raw: row,
    });
  }

  for (const row of safeArray<VerificationTokenRow>(verificationTokens)) {
    const decision = normalizeString(row?.decision || row?.status).toUpperCase();

    items.push({
      id: `token:${row.token || row.created_at}`,
      type: "verification_token",
      title:
        decision === "APPROVED"
          ? "Verification Approved"
          : decision === "DENIED"
            ? "Verification Denied"
            : "Verification Token Updated",
      description: `Status: ${row.status || "pending"}${
        decision ? ` • Decision: ${decision}` : ""
      }`,
      created_at:
        row.decided_at ||
        row.submitted_at ||
        row.updated_at ||
        row.created_at ||
        null,
      actor_name:
        row.decided_by_display_name || row.decided_by_username || "System",
      actor_id: row.decided_by || null,
      source: "verification_tokens",
      raw: row,
    });
  }

  for (const row of safeArray<VcSessionRow>(vcSessions)) {
    items.push({
      id: `vc:${row.token || row.created_at}`,
      type: "vc_session",
      title: "VC Verification Session",
      description: `Status: ${row.status || "PENDING"}`,
      created_at:
        row.completed_at ||
        row.started_at ||
        row.accepted_at ||
        row.canceled_at ||
        row.created_at ||
        null,
      actor_name: row.accepted_by || row.canceled_by || "System",
      actor_id: row.accepted_by || row.canceled_by || null,
      source: "vc_verify_sessions",
      raw: row,
    });
  }

  for (const row of safeArray<TicketNoteRow>(notes)) {
    items.push({
      id: `note:${row.id || row.created_at}`,
      type: "internal_note",
      title: "Internal Note Added",
      description: truncateText(row.content, 180),
      created_at: row.created_at || null,
      actor_name: row.staff_name || row.staff_id || "Staff",
      actor_id: row.staff_id || null,
      source: "ticket_notes",
      raw: row,
    });
  }

  return items
    .filter((row) => row.created_at)
    .sort((a, b) => parseDateMs(b.created_at) - parseDateMs(a.created_at))
    .slice(0, 40);
}

function buildCategoryPatch(body: JsonRecord) {
  return {
    category: normalizeString(body?.category) || null,
    category_id: normalizeString(body?.category_id) || null,
    category_override: normalizeBoolean(
      body?.category_override ?? body?.manual_override ?? true
    ),
    category_set_by: normalizeString(body?.category_set_by) || null,
    category_set_at: new Date().toISOString(),
  };
}

function buildTranscriptExports(ticketId: string) {
  const encoded = encodeURIComponent(ticketId);
  return {
    html: `/api/tickets/${encoded}/transcript`,
    txt: `/api/tickets/${encoded}/transcript?format=txt`,
    json: `/api/tickets/${encoded}/transcript?format=json`,
  };
}

async function parseRequestBody(request: Request): Promise<JsonRecord> {
  try {
    const body = await request.json();
    return safeObject<JsonRecord>(body);
  } catch {
    return {};
  }
}

async function writeVerificationContext(args: {
  supabase: ReturnType<typeof createServerSupabase>;
  guildId: string;
  ticketId: string;
  existingTicket: TicketRow;
  actorId: string | null;
  actorName: string;
  entryMethod?: string | null;
  verificationSource?: string | null;
  entryReason?: string | null;
  approvalReason?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
}) {
  const {
    supabase,
    guildId,
    ticketId,
    existingTicket,
    actorId,
    actorName,
    entryMethod,
    verificationSource,
    entryReason,
    approvalReason,
    categoryName,
    categorySlug,
  } = args;

  const userId = String(existingTicket.user_id || "").trim();
  if (!userId) return;

  await patchGuildMemberEntryFields(
    {
      guildId,
      userId,
      approvedBy: actorId,
      approvedByName: actorName,
      sourceTicketId: ticketId,
      verificationTicketId: ticketId,
      entryMethod:
        normalizeString(entryMethod) ||
        normalizeString(verificationSource) ||
        "verification_ticket",
      verificationSource:
        normalizeString(verificationSource) ||
        "dashboard_manual_category_override",
      entryReason:
        normalizeString(entryReason) ||
        `Ticket category manually set to ${categoryName || categorySlug || "verification"}.`,
      approvalReason:
        normalizeString(approvalReason) ||
        `Dashboard staff manually linked verification context on ticket ${ticketId}.`,
    },
    supabase
  );

  await patchLatestMemberJoinContext(
    {
      guildId,
      userId,
      username: existingTicket.username || null,
      approvedBy: actorId,
      approvedByName: actorName,
      sourceTicketId: ticketId,
      entryMethod: normalizeString(entryMethod) || "verification_ticket",
      verificationSource:
        normalizeString(verificationSource) ||
        "dashboard_manual_category_override",
      joinNote:
        normalizeString(entryReason) ||
        `Verification context linked from ticket ${ticketId}.`,
    },
    supabase
  );

  await insertMemberEvent(
    {
      guildId,
      userId,
      actorId,
      actorName,
      eventType: "verification_context_linked",
      title: "Verification Context Linked",
      reason:
        normalizeString(approvalReason) ||
        "Verification entry context was linked from dashboard ticket override.",
      metadata: {
        ticket_id: ticketId,
        verification_ticket_id: ticketId,
        category_name: categoryName || null,
        category_slug: categorySlug || null,
        verification_source:
          normalizeString(verificationSource) ||
          "dashboard_manual_category_override",
      },
    },
    supabase
  );
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const typedSession = session as SessionLike;
    const supabase = createServerSupabase();
    const ticketId = normalizeString(context?.params?.id);

    if (!ticketId) {
      return buildErrorResponse("Missing ticket id.", 400, refreshedTokens);
    }

    const [ticketRes, messagesRes, notesRes, categoriesRes] = await Promise.all([
      supabase.from("tickets").select("*").eq("id", ticketId).single(),
      supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true }),
      supabase
        .from("ticket_notes")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false }),
      supabase
        .from("ticket_categories")
        .select("*")
        .eq("guild_id", env.guildId || ""),
    ]);

    if (ticketRes.error || !ticketRes.data) {
      return buildErrorResponse(
        ticketRes.error?.message || "Ticket not found.",
        404,
        refreshedTokens
      );
    }

    const rawTicket = mapTicket(ticketRes.data as TicketRow);
    const categoryRows = safeArray<TicketCategoryRow>(categoriesRes.data || []);
    const categoryIndex = indexCategories(categoryRows);
    const ticket = enrichTicketWithMatchedCategory(rawTicket, categoryRows) as TicketRow;

    const ticketUserId = normalizeString(ticket?.user_id);
    const ticketChannelId = normalizeString(ticket?.channel_id || ticket?.discord_thread_id);

    const [memberRowsRes, joinsRes, memberEventsRes, flagsRes, tokensRes, vcRes, warnsRes, activityRes] =
      await Promise.all([
        ticketUserId
          ? supabase
              .from("guild_members")
              .select("*")
              .eq("guild_id", env.guildId || "")
              .eq("user_id", ticketUserId)
              .limit(1)
          : Promise.resolve({ data: [], error: null }),
        ticketUserId
          ? supabase
              .from("member_joins")
              .select("*")
              .eq("guild_id", env.guildId || "")
              .eq("user_id", ticketUserId)
              .order("joined_at", { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [], error: null }),
        ticketUserId
          ? supabase
              .from("member_events")
              .select("*")
              .eq("guild_id", env.guildId || "")
              .eq("user_id", ticketUserId)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null }),
        ticketUserId
          ? supabase
              .from("verification_flags")
              .select("*")
              .eq("guild_id", env.guildId || "")
              .eq("user_id", ticketUserId)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null }),
        ticketUserId
          ? supabase
              .from("verification_tokens")
              .select("*")
              .eq("guild_id", env.guildId || "")
              .or(`requester_id.eq.${ticketUserId},user_id.eq.${ticketUserId},approved_user_id.eq.${ticketUserId}`)
              .order("created_at", { ascending: false })
              .limit(60)
          : Promise.resolve({ data: [], error: null }),
        ticketUserId
          ? supabase
              .from("vc_verify_sessions")
              .select("*")
              .eq("guild_id", env.guildId || "")
              .or(`owner_id.eq.${ticketUserId},requester_id.eq.${ticketUserId}`)
              .order("created_at", { ascending: false })
              .limit(40)
          : Promise.resolve({ data: [], error: null }),
        ticketUserId
          ? supabase
              .from("warns")
              .select("*")
              .eq("guild_id", env.guildId || "")
              .eq("user_id", ticketUserId)
              .order("created_at", { ascending: false })
              .limit(30)
          : Promise.resolve({ data: [], error: null }),
        ticketUserId
          ? supabase
              .from("activity_feed_events")
              .select("*")
              .eq("guild_id", env.guildId || "")
              .or(
                ticketChannelId
                  ? `ticket_id.eq.${ticketId},channel_id.eq.${ticketChannelId},target_user_id.eq.${ticketUserId}`
                  : `ticket_id.eq.${ticketId},target_user_id.eq.${ticketUserId}`
              )
              .order("created_at", { ascending: false })
              .limit(100)
          : supabase
              .from("activity_feed_events")
              .select("*")
              .eq("guild_id", env.guildId || "")
              .eq("ticket_id", ticketId)
              .order("created_at", { ascending: false })
              .limit(100),
      ]);

    const member = mapGuildMember((safeArray<GuildMemberRow>(memberRowsRes.data || [])[0] || null) as GuildMemberRow | null);
    const messages = safeArray<TicketMessageRow>(messagesRes.data).map(mapTicketMessage);
    const notes = safeArray<TicketNoteRow>(notesRes.data).map(mapTicketNote);
    const joins = safeArray<MemberJoinRow>(joinsRes.data).map(mapJoin);
    const memberEvents = safeArray<MemberEventRow>(memberEventsRes.data).map(mapMemberEvent);
    const verificationFlags = safeArray<VerificationFlagRow>(flagsRes.data).map(mapVerificationFlag);
    const verificationTokens = safeArray<VerificationTokenRow>(tokensRes.data).map(mapVerificationToken);
    const vcSessions = safeArray<VcSessionRow>(vcRes.data).map(mapVcSession);
    const warns = safeArray<WarnRow>(warnsRes.data).map(mapWarn);
    const activity = safeArray<ActivityFeedRow>(activityRes.data).map(mapActivityRow);

    const category = getTicketCategoryRow(ticket, categoryIndex);
    const latestNote = latestBy(notes, "created_at");
    const latestFlag = latestBy(verificationFlags, "created_at");
    const latestToken = latestBy(
      verificationTokens,
      "updated_at",
      "decided_at",
      "submitted_at",
      "created_at"
    );
    const latestVc = latestBy(
      vcSessions,
      "completed_at",
      "started_at",
      "accepted_at",
      "canceled_at",
      "created_at"
    );
    const latestActivity = latestBy(activity, "created_at");
    const latestJoin = latestBy(joins, "joined_at");
    const altRisk = buildAltRiskSnapshot(member, latestJoin);

    const flaggedCount = verificationFlags.filter((row) => row.flagged).length;
    const maxFlagScore = Math.max(
      0,
      ...verificationFlags.map((row) => normalizeNumber(row.score, 0))
    );
    const warnCount = warns.length;
    const noteCount = notes.length;
    const messageCount = messages.length;

    const slaState = deriveSlaState(ticket);
    const verificationLabel = deriveVerificationLabel({
      member,
      latestToken,
      latestVc,
      flaggedCount,
      ticket,
    });
    const riskLevel = deriveRiskLevel({
      ticket,
      member,
      flaggedCount,
      warnCount,
      maxFlagScore,
      noteCount,
      slaState,
    });
    const recommendedActions = deriveRecommendedActions({
      ticket,
      member,
      flaggedCount,
      latestVc,
      noteCount,
      slaState,
    });

    const ownerDisplayName =
      member?.display_name ||
      member?.nickname ||
      member?.username ||
      ticket?.username ||
      ticket?.user_id ||
      "Unknown User";

    const latestActivityAt =
      latestActivity?.created_at ||
      latestNote?.created_at ||
      ticket?.updated_at ||
      ticket?.created_at ||
      null;

    const transcriptState =
      normalizeString(ticket?.transcript_url) ||
      normalizeString(ticket?.transcript_message_id) ||
      normalizeString(ticket?.transcript_channel_id)
        ? "available"
        : normalizeLower(ticket?.status) === "closed" || normalizeLower(ticket?.status) === "deleted"
          ? "expected_missing"
          : "not_ready";

    const enrichedTicket = {
      ...ticket,
      owner_display_name: ownerDisplayName,
      owner_avatar_url: member?.avatar_url || null,
      owner_role_state: member?.role_state || "unknown",
      owner_role_state_reason: member?.role_state_reason || "",
      owner_has_unverified: Boolean(member?.has_unverified),
      owner_has_verified_role: Boolean(member?.has_verified_role),
      owner_has_staff_role: Boolean(member?.has_staff_role),
      owner_entry_method: member?.entry_method || latestJoin?.entry_method || null,
      owner_verification_source:
        member?.verification_source || latestJoin?.verification_source || null,
      owner_entry_reason: member?.entry_reason || null,
      owner_approval_reason: member?.approval_reason || null,
      owner_invited_by: member?.invited_by || latestJoin?.invited_by || null,
      owner_invited_by_name:
        member?.invited_by_name || latestJoin?.invited_by_name || null,
      owner_invite_code: member?.invite_code || latestJoin?.invite_code || null,
      owner_vouched_by: member?.vouched_by || latestJoin?.vouched_by || null,
      owner_vouched_by_name:
        member?.vouched_by_name || latestJoin?.vouched_by_name || null,
      owner_approved_by: member?.approved_by || latestJoin?.approved_by || null,
      owner_approved_by_name:
        member?.approved_by_name || latestJoin?.approved_by_name || null,

      owner_verification_label: verificationLabel,
      owner_flag_count: flaggedCount,
      owner_latest_flag_score: normalizeNumber(latestFlag?.score, 0),
      owner_latest_flag_at: latestFlag?.created_at || null,
      owner_latest_flag_reasons: Array.isArray(latestFlag?.reasons)
        ? latestFlag.reasons
        : [],
      owner_max_flag_score: maxFlagScore,

      owner_token_count: verificationTokens.length,
      owner_latest_token_status: latestToken?.status || null,
      owner_latest_token_decision: latestToken?.decision || null,
      owner_latest_token_at:
        latestToken?.updated_at ||
        latestToken?.decided_at ||
        latestToken?.submitted_at ||
        latestToken?.created_at ||
        null,

      owner_vc_count: vcSessions.length,
      owner_latest_vc_status: latestVc?.status || null,
      owner_latest_vc_at:
        latestVc?.completed_at ||
        latestVc?.started_at ||
        latestVc?.accepted_at ||
        latestVc?.canceled_at ||
        latestVc?.created_at ||
        null,

      owner_warn_count: warnCount,

      owner_alt_risk_score: altRisk.score,
      owner_alt_risk_level: altRisk.level,
      owner_alt_risk_label: formatAltRiskLabel(altRisk.level),
      owner_alt_risk_reasons: altRisk.reasons,
      owner_fingerprint: altRisk.fingerprint,
      owner_alt_cluster_key: altRisk.altClusterKey,
      owner_alt_cluster_size: altRisk.altClusterSize,
      owner_burst_join_count: altRisk.burstJoinCount,
      owner_same_fingerprint_count: altRisk.sameFingerprintCount,
      owner_similar_name_count: altRisk.similarNameCount,
      owner_same_age_bucket_count: altRisk.sameAgeBucketCount,
      owner_suspicious_name_pattern: altRisk.suspiciousNamePattern,
      owner_repeated_char_pattern: altRisk.repeatedCharPattern,
      owner_default_avatar: altRisk.defaultAvatar,
      owner_account_age_days: altRisk.accountAgeDays,
      owner_age_bucket: altRisk.ageBucket,
      owner_digit_ratio: altRisk.digitRatio,
      owner_underscore_ratio: altRisk.underscoreRatio,
      owner_alt_cluster_members: altRisk.clusterMembers,
      owner_suspicion_flags: altRisk.suspicionFlags,
      owner_risk_evaluated_at: altRisk.riskEvaluatedAt,
      owner_last_join_risk_score: altRisk.lastJoinRiskScore,
      owner_last_join_risk_level: altRisk.lastJoinRiskLevel,
      owner_last_join_fingerprint: altRisk.lastJoinFingerprint,
      owner_alt_notes: altRisk.altNotes,
      owner_alt_risk_source: altRisk.source,

      category_color: category?.color || null,
      category_description: category?.description || null,
      category_button_label: category?.button_label || null,

      note_count: noteCount,
      latest_note_at: latestNote?.created_at || null,
      latest_note_staff_id: latestNote?.staff_id || null,
      latest_note_staff_name: latestNote?.staff_name || null,

      message_count: messageCount,
      latest_message_at: messages.length
        ? messages[messages.length - 1]?.created_at || null
        : null,

      latest_activity_at: latestActivityAt,
      latest_activity_title: latestActivity?.title || latestActivity?.event_type || null,
      latest_activity_type: latestActivity?.event_type || null,

      sla_status: slaState.sla_status,
      overdue: slaState.overdue,
      minutes_overdue: slaState.minutes_overdue,
      minutes_until_deadline: slaState.minutes_until_deadline,

      risk_level: riskLevel,
      recommended_actions: recommendedActions,

      transcript_state: transcriptState,
      transcript_available:
        Boolean(normalizeString(ticket?.transcript_url)) ||
        Boolean(normalizeString(ticket?.transcript_message_id)) ||
        Boolean(normalizeString(ticket?.transcript_channel_id)),
      transcript_exports: buildTranscriptExports(ticketId),

      can_assign: !normalizeLower(ticket?.status).includes("deleted"),
      can_close:
        normalizeLower(ticket?.status) !== "closed" &&
        normalizeLower(ticket?.status) !== "deleted",
      can_reopen:
        normalizeLower(ticket?.status) !== "open" &&
        normalizeLower(ticket?.status) !== "deleted",
      can_delete: normalizeLower(ticket?.status) !== "deleted",
    };

    const viewer = {
      id:
        typedSession?.user?.discord_id ||
        typedSession?.user?.id ||
        typedSession?.discordUser?.id ||
        null,
      username:
        typedSession?.user?.username ||
        typedSession?.discordUser?.username ||
        typedSession?.user?.name ||
        "Staff",
    };

    const timeline = buildTimeline({
      activityRows: activity,
      memberEvents,
      verificationFlags,
      verificationTokens,
      vcSessions,
      notes,
    });

    return buildJsonResponse(
      {
        ok: true,
        ticket: enrichedTicket,
        category: category || null,
        member,
        joins,
        latestJoin: latestJoin || null,
        memberEvents,
        verificationFlags,
        verificationTokens,
        vcSessions,
        warns,
        activity,
        timeline,
        messages,
        notes,
        workspace: {
          verificationLabel,
          riskLevel,
          noteCount,
          messageCount,
          flaggedCount,
          maxFlagScore,
          warnCount,
          latestActivityAt,
          recommendedActions,
          sla: slaState,
          altRisk,
          altRiskLabel: formatAltRiskLabel(altRisk.level),
        },
        counts: {
          notes: noteCount,
          messages: messageCount,
          flags: flaggedCount,
          warns: warnCount,
          tokens: verificationTokens.length,
          vcSessions: vcSessions.length,
        },
        viewer,
        currentStaffId: viewer.id || "",
      },
      200,
      refreshedTokens
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load ticket.";
    return buildErrorResponse(
      message,
      message === "Unauthorized" ? 401 : 500
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const typedSession = session as SessionLike;
    const supabase = createServerSupabase();
    const body = await parseRequestBody(request);
    const ticketId = normalizeString(context?.params?.id);
    const { actorId, actorName } = getActorIdentity(typedSession);

    if (!ticketId) {
      return buildErrorResponse("Missing ticket id.", 400, refreshedTokens);
    }

    const action = normalizeLower(body?.action || "update-category") as PatchAction;

    if (
      action !== "update-category" &&
      action !== "clear-category-override" &&
      action !== "link-verification-context"
    ) {
      return buildErrorResponse(
        "Unsupported patch action.",
        400,
        refreshedTokens
      );
    }

    const { data: existingTicket, error: existingTicketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (existingTicketError || !existingTicket) {
      return buildErrorResponse(
        existingTicketError?.message || "Ticket not found.",
        404,
        refreshedTokens
      );
    }

    const typedTicket = existingTicket as TicketRow;
    const guildId = normalizeString(env.guildId || typedTicket.guild_id || "");

    if (!guildId) {
      return buildErrorResponse(
        "Missing guild id configuration.",
        500,
        refreshedTokens
      );
    }

    const { data: categoryRows, error: categoryRowsError } = await supabase
      .from("ticket_categories")
      .select("*")
      .eq("guild_id", guildId);

    if (categoryRowsError) {
      return buildErrorResponse(categoryRowsError.message, 500, refreshedTokens);
    }

    const categoryIndex = indexCategories(
      safeArray<TicketCategoryRow>(categoryRows || [])
    );

    if (action === "clear-category-override") {
      const currentCategory = getTicketCategoryRow(typedTicket, categoryIndex);

      const updatePayload = {
        updated_at: new Date().toISOString(),
        category_override: false,
        category_set_by: actorId || null,
        category_set_at: new Date().toISOString(),
        category_id: currentCategory?.id || typedTicket.category_id || null,
        category:
          currentCategory?.slug ||
          currentCategory?.name ||
          typedTicket.category ||
          null,
        matched_category_id: currentCategory?.id || typedTicket.matched_category_id || null,
        matched_category_name:
          currentCategory?.name || typedTicket.matched_category_name || null,
        matched_category_slug:
          currentCategory?.slug || typedTicket.matched_category_slug || null,
        matched_intake_type:
          currentCategory?.intake_type || typedTicket.matched_intake_type || null,
        matched_category_reason: "manual-override-cleared",
        matched_category_score: normalizeNumber(
          typedTicket.matched_category_score,
          0
        ),
      };

      const { data: ticket, error } = await supabase
        .from("tickets")
        .update(updatePayload)
        .eq("id", ticketId)
        .select("*")
        .single();

      if (error) {
        return buildErrorResponse(error.message, 500, refreshedTokens);
      }

      await insertMemberEvent(
        {
          guildId,
          userId: normalizeString(typedTicket.user_id),
          actorId,
          actorName,
          eventType: "ticket_category_override_cleared",
          title: "Ticket Category Override Cleared",
          reason: "Manual category override was removed.",
          metadata: {
            ticket_id: ticketId,
            ticket_number: typedTicket.ticket_number || null,
            category: updatePayload.category,
            category_id: updatePayload.category_id,
            source: "dashboard_ticket_patch",
          },
        },
        supabase
      );

      return buildJsonResponse({ ok: true, ticket }, 200, refreshedTokens);
    }

    if (action === "link-verification-context") {
      const inferredCategory = findCategoryFromPatch(
        {
          category_id: normalizeString(body?.category_id) || typedTicket.category_id || null,
          category:
            normalizeString(body?.category) ||
            typedTicket.matched_category_slug ||
            typedTicket.category ||
            null,
        },
        categoryIndex
      );

      await writeVerificationContext({
        supabase,
        guildId,
        ticketId,
        existingTicket: typedTicket,
        actorId,
        actorName,
        entryMethod: normalizeString(body?.entry_method) || null,
        verificationSource: normalizeString(body?.verification_source) || null,
        entryReason: normalizeString(body?.entry_reason) || null,
        approvalReason: normalizeString(body?.approval_reason) || null,
        categoryName: inferredCategory?.name || typedTicket.matched_category_name || null,
        categorySlug: inferredCategory?.slug || typedTicket.matched_category_slug || null,
      });

      return buildJsonResponse(
        { ok: true, message: "Verification context linked." },
        200,
        refreshedTokens
      );
    }

    const patch = buildCategoryPatch({
      ...body,
      category_set_by: body?.category_set_by || actorId || "",
    });

    const categoryRow = findCategoryFromPatch(patch, categoryIndex);

    if (!categoryRow && !patch.category && !patch.category_id) {
      return buildErrorResponse(
        "Choose a valid category first.",
        400,
        refreshedTokens
      );
    }

    const selectedCategorySlug = categoryRow?.slug || patch.category || null;
    const selectedCategoryName = categoryRow?.name || patch.category || null;
    const selectedIntakeType = categoryRow?.intake_type || null;

    const updatePayload = {
      updated_at: new Date().toISOString(),
      category_override: patch.category_override,
      category_set_by: patch.category_set_by,
      category_set_at: patch.category_set_at,
      category_id: categoryRow?.id || patch.category_id || null,
      category: selectedCategorySlug || selectedCategoryName || null,
      matched_category_id: categoryRow?.id || null,
      matched_category_name: selectedCategoryName,
      matched_category_slug: selectedCategorySlug,
      matched_intake_type: selectedIntakeType,
      matched_category_reason: "manual-override",
      matched_category_score: 999,
    };

    const { data: ticket, error } = await supabase
      .from("tickets")
      .update(updatePayload)
      .eq("id", ticketId)
      .select("*")
      .single();

    if (error) {
      return buildErrorResponse(error.message, 500, refreshedTokens);
    }

    await insertMemberEvent(
      {
        guildId,
        userId: normalizeString(typedTicket.user_id),
        actorId,
        actorName,
        eventType: "ticket_category_overridden",
        title: "Ticket Category Overridden",
        reason: `Manual category override set to ${selectedCategoryName || selectedCategorySlug || "unknown"}.`,
        metadata: {
          ticket_id: ticketId,
          ticket_number: typedTicket.ticket_number || null,
          previous_category: typedTicket.category || null,
          previous_category_id: typedTicket.category_id || null,
          previous_matched_category_id: typedTicket.matched_category_id || null,
          previous_matched_category_name: typedTicket.matched_category_name || null,
          next_category: updatePayload.category,
          next_category_id: updatePayload.category_id,
          matched_category_name: updatePayload.matched_category_name,
          matched_category_slug: updatePayload.matched_category_slug,
          matched_intake_type: updatePayload.matched_intake_type,
          source: "dashboard_ticket_patch",
        },
      },
      supabase
    );

    const shouldPatchEntryContext =
      normalizeLower(selectedIntakeType).includes("verification") ||
      normalizeLower(selectedCategorySlug).includes("verification") ||
      normalizeLower(selectedCategoryName).includes("verification");

    if (shouldPatchEntryContext) {
      await writeVerificationContext({
        supabase,
        guildId,
        ticketId,
        existingTicket: typedTicket,
        actorId,
        actorName,
        entryMethod: normalizeString(body?.entry_method) || null,
        verificationSource: normalizeString(body?.verification_source) || null,
        entryReason: normalizeString(body?.entry_reason) || null,
        approvalReason: normalizeString(body?.approval_reason) || null,
        categoryName: selectedCategoryName,
        categorySlug: selectedCategorySlug,
      });
    }

    return buildJsonResponse({ ok: true, ticket }, 200, refreshedTokens);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unauthorized";
    return buildErrorResponse(
      message,
      message === "Unauthorized" ? 401 : 500
    );
  }
}
