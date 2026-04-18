// ============================================================
// File: app/api/user/dashboard/route.ts
// Purpose:
//   User dashboard API route.
//   Loads member profile, ticket history, verification history,
//   VC verification history, join-source data, activity timeline,
//   and relationship metadata for the dashboard UI.
// ============================================================

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth-server";
import { derivePriority, sortTickets } from "@/lib/priority";
import { env } from "@/lib/env";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue | undefined };
type AnyRecord = Record<string, unknown>;

type SupabaseRowsResponse<T> = {
  data?: T[] | null;
};

type SupabaseSingleResponse<T> = {
  data?: T | null;
};

type QueryFactoryRows<T> = () => Promise<SupabaseRowsResponse<T>>;
type QueryFactorySingle<T> = () => Promise<SupabaseSingleResponse<T>>;

interface ViewerSummary {
  discord_id: string;
  username: string;
  global_name: string;
  avatar_url: string | null;
  isStaff: boolean;
  guild_id: string | null;
}

interface MemberSummary {
  guild_id: string | null;
  user_id: string | null;
  username: string;
  display_name: string;
  nickname: string | null;
  avatar_url: string | null;
  joined_at: string | null;
  role_names: string[];
  role_ids: string[];
  has_unverified: boolean;
  has_verified_role: boolean;
  has_staff_role: boolean;
  has_secondary_verified_role: boolean;
  has_cosmetic_only: boolean;
  role_state: string;
  role_state_reason: string;
  previous_usernames: string[];
  previous_display_names: string[];
  previous_nicknames: string[];
  last_seen_username: string | null;
  last_seen_display_name: string | null;
  last_seen_nickname: string | null;
  invited_by: string | null;
  invited_by_name: string | null;
  invite_code: string | null;
  vouched_by: string | null;
  vouched_by_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  verification_ticket_id: string | null;
  source_ticket_id: string | null;
  entry_method: string | null;
  verification_source: string | null;
  join_source: string | null;
  vanity_used: boolean;
  entry_reason: string | null;
  approval_reason: string | null;
  top_role: string | null;
  in_guild: boolean;
  times_joined: number;
  times_left: number;
}

interface CategorySummary {
  id: string | null;
  name: string;
  slug: string;
  color: string;
  description: string;
  intake_type: string;
  button_label: string;
  is_default: boolean;
  sort_order: number | null;
  staff_role_ids: string[];
  staff_role_names: string[];
  match_keywords: string[];
}

interface VerificationFlagSummary {
  id: string | null;
  created_at: string | null;
  score: number;
  flagged: boolean;
  reasons: string[];
  note: string;
  raw: AnyRecord;
}

interface VerificationTokenSummary {
  token: string | null;
  status: string;
  decision: string;
  used: boolean;
  submitted: boolean;
  created_at: string | null;
  updated_at: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  expires_at: string | null;
  requester_id: string | null;
  approved_user_id: string | null;
  decided_by: string | null;
  decided_by_display_name: string | null;
  decided_by_username: string | null;
  role_sync_ok: boolean;
  role_sync_reason: string | null;
  ai_status: string | null;
  expected_role_state: string | null;
  actual_role_state: string | null;
  channel_id: string | null;
  raw: AnyRecord;
}

interface VcSessionSummary {
  token: string | null;
  status: string;
  created_at: string | null;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  canceled_at: string | null;
  access_minutes: number;
  requester_id: string | null;
  owner_id: string | null;
  accepted_by: string | null;
  canceled_by: string | null;
  staff_id: string | null;
  staff_name: string | null;
  ticket_id: string | null;
  ticket_channel_id: string | null;
  vc_channel_id: string | null;
  queue_channel_id: string | null;
  queue_message_id: string | null;
  revoke_at: string | null;
  last_watchdog_at: string | null;
  meta: AnyRecord;
  raw: AnyRecord;
}

interface JoinHistorySummary {
  id: string | null;
  joined_at: string | null;
  join_source: string | null;
  entry_method: string | null;
  verification_source: string | null;
  invite_code: string | null;
  inviter_id: string | null;
  inviter_name: string | null;
  vouched_by: string | null;
  vouched_by_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  source_ticket_id: string | null;
  join_note: string | null;
  vanity_used: boolean;
  username: string | null;
  display_name: string | null;
  raw: AnyRecord;
}

interface MemberEventSummary {
  id: string | null;
  created_at: string | null;
  event_type: string;
  title: string;
  reason: string;
  actor_id: string | null;
  actor_name: string;
  metadata: AnyRecord;
  raw: AnyRecord;
}

interface ActivityEventSummary {
  id: string | null;
  title: string;
  description: string;
  reason: string;
  event_type: string;
  created_at: string | null;
  updated_at: string | null;
  actor_id: string | null;
  actor_name: string;
  ticket_id: string | null;
  metadata: AnyRecord;
  _source: string;
}

interface UserTicketSummary {
  id: string | null;
  title: string;
  category: string | null;
  matched_category_name: string | null;
  matched_category_slug: string | null;
  matched_intake_type: string | null;
  matched_category_reason: string | null;
  matched_category_score: number;
  status: string;
  priority: string;
  claimed_by: string | null;
  claimed_by_name: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  closed_by: string | null;
  closed_by_name: string | null;
  closed_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  deleted_at: string | null;
  reopened_at: string | null;
  sla_deadline: string | null;
  channel_id: string | null;
  channel_name: string | null;
  transcript_url: string | null;
  source: string | null;
  initial_message: string;
  is_ghost: boolean;
  ticket_number: number | null;
  username?: string | null;
}

interface UsernameHistoryRow {
  id: string;
  created_at: string | null;
  username: string | null;
  display_name: string | null;
  nickname: string | null;
  source: string;
}

interface VouchRow {
  id: string;
  created_at: string | null;
  actor_id: string | null;
  actor_name: string | null;
  target_user_id: string | null;
  reason: string;
  raw: AnyRecord | null;
}

interface EntrySummary {
  joined_at: string | null;
  join_source: string | null;
  entry_method: string | null;
  verification_source: string | null;
  invite_code: string | null;
  inviter_id: string | null;
  inviter_name: string | null;
  vouched_by: string | null;
  vouched_by_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  source_ticket_id: string | null;
  join_note: string | null;
  vanity_used: boolean;
  source_confidence: string;
  source_truth_reason: string;
  raw: AnyRecord | null;
}

interface VerificationSummary {
  status: string;
  has_unverified: boolean;
  has_verified_role: boolean;
  has_secondary_verified_role: boolean;
  has_staff_role: boolean;
  flag_count: number;
  flagged_count: number;
  latest_flag_at: string | null;
  vc_request_count: number;
  vc_completed_count: number;
  vc_latest_status: string | null;
  token_count: number;
  token_latest_status: string | null;
  token_latest_decision: string | null;
  token_submitted_count: number;
  token_pending_count: number;
  token_approved_count: number;
  token_denied_count: number;
  open_ticket_id: string | null;
}

interface RelationshipSummary {
  entry_method: string | null;
  verification_source: string | null;
  join_source: string | null;
  entry_reason: string | null;
  approval_reason: string | null;
  invite_code: string | null;
  inviter_id: string | null;
  inviter_name: string | null;
  vanity_used: boolean;
  vouched_by: string | null;
  vouched_by_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  verification_ticket_id: string | null;
  source_ticket_id: string | null;
  source_confidence: string;
  source_truth_reason: string | null;
  vouch_count: number;
  latest_vouch_at: string | null;
}

interface TicketSummaryStats {
  total: number;
  open: number;
  closed: number;
  deleted: number;
  claimed: number;
  status_counts: Record<string, number>;
  priority_counts: Record<string, number>;
  category_counts: Record<string, number>;
  latest_ticket_at: string | null;
}

interface DashboardStats {
  ticket_count: number;
  activity_count: number;
  verification_flag_count: number;
  verification_token_count: number;
  vc_session_count: number;
  last_activity_at: string | null;
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : {};
}

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function parseDateMs(value: unknown): number {
  const ms = new Date(String(value || 0)).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeObject(value: unknown): AnyRecord {
  return asRecord(value);
}

function dedupeStrings(values: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of safeArray<unknown>(values)) {
    const clean = normalizeString(value);
    if (!clean) continue;

    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }

  return out;
}

function pushCandidate(values: string[], candidate: unknown): void {
  const clean = normalizeString(candidate);
  if (clean) values.push(clean);
}

function uniqueBy<T>(items: T[], keyFactory: (item: T) => unknown): T[] {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const item of safeArray<T>(items)) {
    const key = String(keyFactory(item) || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function sortByCreatedDesc<T extends { created_at?: string | null; updated_at?: string | null }>(rows: T[]): T[] {
  return safeArray<T>(rows).sort(
    (a, b) =>
      parseDateMs(b?.created_at || b?.updated_at) -
      parseDateMs(a?.created_at || a?.updated_at)
  );
}

function firstNonEmpty(...values: unknown[]): string | null {
  for (const value of values) {
    const text = normalizeString(value);
    if (text) return text;
  }
  return null;
}

async function safeSupabaseRows<T>(queryFactory: QueryFactoryRows<T>): Promise<T[]> {
  try {
    const response = await queryFactory();
    return Array.isArray(response?.data) ? response.data : [];
  } catch {
    return [];
  }
}

async function safeSupabaseSingle<T>(queryFactory: QueryFactorySingle<T>): Promise<T | null> {
  try {
    const response = await queryFactory();
    return response?.data && typeof response.data === "object" ? response.data : null;
  } catch {
    return null;
  }
}

function isClosedLikeStatus(status: unknown): boolean {
  const value = normalizeString(status).toLowerCase();
  return value === "closed" || value === "deleted";
}

function hasUsableChannel(ticket: AnyRecord): boolean {
  return Boolean(normalizeString(ticket?.channel_id || ticket?.discord_thread_id));
}

function shouldHideStaleTicket(ticket: AnyRecord): boolean {
  const status = normalizeString(ticket?.status).toLowerCase();
  const missingChannel = !hasUsableChannel(ticket);

  if (!missingChannel) return false;
  if (!isClosedLikeStatus(status)) return false;

  const closedAtMs = parseDateMs(ticket?.closed_at);
  const updatedAtMs = parseDateMs(ticket?.updated_at);
  const createdAtMs = parseDateMs(ticket?.created_at);
  const newestMs = Math.max(closedAtMs, updatedAtMs, createdAtMs);
  const ageMs = Date.now() - newestMs;

  return ageMs > 5 * 60 * 1000;
}

function deriveViewerFromSession(session: AnyRecord, guildId: string): ViewerSummary {
  const user = asRecord(session?.user);
  const discordUser = asRecord(session?.discordUser);

  const discordId = normalizeString(
    user?.discord_id || user?.id || discordUser?.id
  );

  const username = normalizeString(
    user?.username ||
      discordUser?.username ||
      user?.global_name ||
      user?.name ||
      "Member"
  );

  const globalName = normalizeString(
    user?.global_name ||
      user?.display_name ||
      discordUser?.global_name ||
      username
  );

  const avatarUrl = normalizeString(
    user?.avatar_url ||
      user?.avatar ||
      user?.image ||
      user?.picture ||
      discordUser?.avatar_url ||
      ""
  );

  return {
    discord_id: discordId,
    username,
    global_name: globalName || username,
    avatar_url: avatarUrl || null,
    isStaff: Boolean(session?.isStaff),
    guild_id: guildId || null,
  };
}

function resolveMemberDisplayName(memberRow: AnyRecord | null | undefined, fallback = "Unknown"): string {
  return (
    normalizeString(memberRow?.display_name) ||
    normalizeString(memberRow?.nickname) ||
    normalizeString(memberRow?.username) ||
    fallback
  );
}

function sanitizeMember(memberRow: AnyRecord | null, viewer: ViewerSummary): MemberSummary {
  if (!memberRow) {
    return {
      guild_id: viewer?.guild_id || null,
      user_id: viewer?.discord_id || null,
      username: viewer?.username || "Member",
      display_name: viewer?.global_name || viewer?.username || "Member",
      nickname: null,
      avatar_url: viewer?.avatar_url || null,
      joined_at: null,
      role_names: [],
      role_ids: [],
      has_unverified: false,
      has_verified_role: false,
      has_staff_role: false,
      has_secondary_verified_role: false,
      has_cosmetic_only: false,
      role_state: "unknown",
      role_state_reason: "Member row not found in guild_members.",
      previous_usernames: [],
      previous_display_names: [],
      previous_nicknames: [],
      last_seen_username: viewer?.username || null,
      last_seen_display_name: viewer?.global_name || null,
      last_seen_nickname: null,
      invited_by: null,
      invited_by_name: null,
      invite_code: null,
      vouched_by: null,
      vouched_by_name: null,
      approved_by: null,
      approved_by_name: null,
      verification_ticket_id: null,
      source_ticket_id: null,
      entry_method: null,
      verification_source: null,
      join_source: null,
      vanity_used: false,
      entry_reason: null,
      approval_reason: null,
      top_role: null,
      in_guild: true,
      times_joined: 0,
      times_left: 0,
    };
  }

  return {
    guild_id: firstNonEmpty(memberRow?.guild_id),
    user_id: firstNonEmpty(memberRow?.user_id),
    username: normalizeString(memberRow?.username) || viewer?.username || "Member",
    display_name:
      normalizeString(memberRow?.display_name) ||
      normalizeString(memberRow?.nickname) ||
      viewer?.global_name ||
      viewer?.username ||
      "Member",
    nickname: firstNonEmpty(memberRow?.nickname),
    avatar_url: firstNonEmpty(memberRow?.avatar_url, viewer?.avatar_url),
    joined_at: firstNonEmpty(memberRow?.joined_at),
    role_names: safeArray<string>(memberRow?.role_names),
    role_ids: safeArray<string>(memberRow?.role_ids),
    has_unverified: Boolean(memberRow?.has_unverified),
    has_verified_role: Boolean(memberRow?.has_verified_role),
    has_staff_role: Boolean(memberRow?.has_staff_role),
    has_secondary_verified_role: Boolean(memberRow?.has_secondary_verified_role),
    has_cosmetic_only: Boolean(memberRow?.has_cosmetic_only),
    role_state: normalizeString(memberRow?.role_state) || "unknown",
    role_state_reason: normalizeString(memberRow?.role_state_reason),
    previous_usernames: safeArray<string>(memberRow?.previous_usernames),
    previous_display_names: safeArray<string>(memberRow?.previous_display_names),
    previous_nicknames: safeArray<string>(memberRow?.previous_nicknames),
    last_seen_username: firstNonEmpty(memberRow?.last_seen_username),
    last_seen_display_name: firstNonEmpty(memberRow?.last_seen_display_name),
    last_seen_nickname: firstNonEmpty(memberRow?.last_seen_nickname),
    invited_by: firstNonEmpty(memberRow?.invited_by),
    invited_by_name: firstNonEmpty(memberRow?.invited_by_name),
    invite_code: firstNonEmpty(memberRow?.invite_code),
    vouched_by: firstNonEmpty(memberRow?.vouched_by),
    vouched_by_name: firstNonEmpty(memberRow?.vouched_by_name),
    approved_by: firstNonEmpty(memberRow?.approved_by),
    approved_by_name: firstNonEmpty(memberRow?.approved_by_name),
    verification_ticket_id: firstNonEmpty(memberRow?.verification_ticket_id),
    source_ticket_id: firstNonEmpty(memberRow?.source_ticket_id),
    entry_method: firstNonEmpty(memberRow?.entry_method),
    verification_source: firstNonEmpty(memberRow?.verification_source),
    join_source: firstNonEmpty(memberRow?.join_source),
    vanity_used: Boolean(memberRow?.vanity_used),
    entry_reason: firstNonEmpty(memberRow?.entry_reason),
    approval_reason: firstNonEmpty(memberRow?.approval_reason),
    top_role: firstNonEmpty(memberRow?.top_role, memberRow?.highest_role_name),
    in_guild: memberRow?.in_guild !== false,
    times_joined: normalizeNumber(memberRow?.times_joined, 0),
    times_left: normalizeNumber(memberRow?.times_left, 0),
  };
}

function sanitizeCategory(category: AnyRecord): CategorySummary {
  return {
    id: firstNonEmpty(category?.id),
    name: normalizeString(category?.name) || "Support",
    slug: normalizeString(category?.slug) || "support",
    color: normalizeString(category?.color) || "#45d483",
    description: normalizeString(category?.description),
    intake_type: normalizeString(category?.intake_type) || "general",
    button_label:
      normalizeString(category?.button_label) ||
      `Open ${String(category?.name || "Support").trim()} Ticket`,
    is_default: Boolean(category?.is_default),
    sort_order: Number.isFinite(Number(category?.sort_order)) ? Number(category?.sort_order) : null,
    staff_role_ids: safeArray<string>(category?.staff_role_ids),
    staff_role_names: safeArray<string>(category?.staff_role_names),
    match_keywords: safeArray<string>(category?.match_keywords),
  };
}

function sanitizeVerificationFlag(flag: AnyRecord): VerificationFlagSummary {
  return {
    id: firstNonEmpty(flag?.id),
    created_at: firstNonEmpty(flag?.created_at),
    score: normalizeNumber(flag?.score, 0),
    flagged: Boolean(flag?.flagged),
    reasons: safeArray<string>(flag?.reasons),
    note: normalizeString(flag?.note || flag?.reason),
    raw: flag || {},
  };
}

function sanitizeVerificationToken(row: AnyRecord): VerificationTokenSummary {
  return {
    token: firstNonEmpty(row?.token),
    status: normalizeString(row?.status || "pending").toLowerCase() || "pending",
    decision: normalizeString(row?.decision || "PENDING").toUpperCase() || "PENDING",
    used: Boolean(row?.used),
    submitted: Boolean(row?.submitted),
    created_at: firstNonEmpty(row?.created_at),
    updated_at: firstNonEmpty(row?.updated_at),
    submitted_at: firstNonEmpty(row?.submitted_at),
    decided_at: firstNonEmpty(row?.decided_at),
    expires_at: firstNonEmpty(row?.expires_at),
    requester_id: firstNonEmpty(row?.requester_id),
    approved_user_id: firstNonEmpty(row?.approved_user_id),
    decided_by: firstNonEmpty(row?.decided_by),
    decided_by_display_name: firstNonEmpty(row?.decided_by_display_name),
    decided_by_username: firstNonEmpty(row?.decided_by_username),
    role_sync_ok: Boolean(row?.role_sync_ok),
    role_sync_reason: firstNonEmpty(row?.role_sync_reason),
    ai_status: firstNonEmpty(row?.ai_status),
    expected_role_state: firstNonEmpty(row?.expected_role_state),
    actual_role_state: firstNonEmpty(row?.actual_role_state),
    channel_id: firstNonEmpty(row?.channel_id),
    raw: row || {},
  };
}

function sanitizeVcSession(row: AnyRecord, staffLookup: Record<string, AnyRecord> = {}): VcSessionSummary {
  const acceptedBy = normalizeString(row?.accepted_by);
  const canceledBy = normalizeString(row?.canceled_by);
  const actorId = acceptedBy || canceledBy || null;
  const actorRow = actorId ? staffLookup[actorId] : null;
  const actorName = actorRow
    ? resolveMemberDisplayName(actorRow, actorId)
    : actorId || null;

  return {
    token: firstNonEmpty(row?.token),
    status: normalizeString(row?.status || "PENDING").toUpperCase() || "PENDING",
    created_at: firstNonEmpty(row?.created_at),
    accepted_at: firstNonEmpty(row?.accepted_at),
    started_at: firstNonEmpty(row?.started_at),
    completed_at: firstNonEmpty(row?.completed_at),
    canceled_at: firstNonEmpty(row?.canceled_at),
    access_minutes: normalizeNumber(row?.access_minutes, 0),
    requester_id: firstNonEmpty(row?.requester_id),
    owner_id: firstNonEmpty(row?.owner_id),
    accepted_by: acceptedBy || null,
    canceled_by: canceledBy || null,
    staff_id: actorId,
    staff_name: actorName,
    ticket_id: firstNonEmpty(row?.ticket_id),
    ticket_channel_id: firstNonEmpty(row?.ticket_channel_id),
    vc_channel_id: firstNonEmpty(row?.vc_channel_id),
    queue_channel_id: firstNonEmpty(row?.queue_channel_id),
    queue_message_id: firstNonEmpty(row?.queue_message_id),
    revoke_at: firstNonEmpty(row?.revoke_at),
    last_watchdog_at: firstNonEmpty(row?.last_watchdog_at),
    meta: safeObject(row?.meta),
    raw: row || {},
  };
}

function sanitizeJoinRow(row: AnyRecord): JoinHistorySummary {
  return {
    id: firstNonEmpty(row?.id),
    joined_at: firstNonEmpty(row?.joined_at, row?.created_at),
    join_source:
      firstNonEmpty(row?.join_source, row?.verification_source, row?.entry_method),
    entry_method:
      firstNonEmpty(row?.entry_method, row?.join_source, row?.verification_source),
    verification_source: firstNonEmpty(row?.verification_source),
    invite_code: firstNonEmpty(row?.invite_code),
    inviter_id: firstNonEmpty(row?.invited_by),
    inviter_name: firstNonEmpty(row?.invited_by_name),
    vouched_by: firstNonEmpty(row?.vouched_by),
    vouched_by_name: firstNonEmpty(row?.vouched_by_name),
    approved_by: firstNonEmpty(row?.approved_by),
    approved_by_name: firstNonEmpty(row?.approved_by_name),
    source_ticket_id: firstNonEmpty(row?.source_ticket_id),
    join_note: firstNonEmpty(row?.join_note),
    vanity_used: Boolean(row?.vanity_used),
    username: firstNonEmpty(row?.username),
    display_name: firstNonEmpty(row?.display_name),
    raw: row || {},
  };
}

function sanitizeMemberEventRow(row: AnyRecord): MemberEventSummary {
  return {
    id: firstNonEmpty(row?.id),
    created_at: firstNonEmpty(row?.created_at),
    event_type: normalizeString(row?.event_type) || "member_event",
    title: normalizeString(row?.title) || "Member Event",
    reason: normalizeString(row?.reason),
    actor_id: firstNonEmpty(row?.actor_id),
    actor_name: normalizeString(row?.actor_name) || "System",
    metadata: safeObject(row?.metadata),
    raw: row || {},
  };
}

function sanitizeActivityFeedRow(row: AnyRecord): ActivityEventSummary & {
  event_family?: string;
  target_user_id?: string | null;
  target_name?: string | null;
  channel_id?: string | null;
  channel_name?: string | null;
  raw?: AnyRecord;
} {
  return {
    id: firstNonEmpty(row?.id),
    created_at: firstNonEmpty(row?.created_at),
    updated_at: firstNonEmpty(row?.created_at),
    title: normalizeString(row?.title) || "Activity",
    description: normalizeString(row?.description),
    reason: normalizeString(row?.reason),
    event_family: normalizeString(row?.event_family) || "activity",
    event_type: normalizeString(row?.event_type) || "activity",
    actor_id: firstNonEmpty(row?.actor_user_id),
    actor_name: normalizeString(row?.actor_name) || "System",
    target_user_id: firstNonEmpty(row?.target_user_id),
    target_name: firstNonEmpty(row?.target_name),
    ticket_id: firstNonEmpty(row?.ticket_id),
    channel_id: firstNonEmpty(row?.channel_id),
    channel_name: firstNonEmpty(row?.channel_name),
    metadata: safeObject(row?.metadata),
    _source: normalizeString(row?.source) || "activity_feed_events",
    raw: row || {},
  };
}

function sanitizeUserTicket(ticket: AnyRecord, staffLookup: Record<string, AnyRecord> = {}): UserTicketSummary {
  const claimedBy = normalizeString(ticket?.claimed_by);
  const assignedTo = normalizeString(ticket?.assigned_to);
  const closedBy = normalizeString(ticket?.closed_by);

  const claimedMember = claimedBy ? staffLookup[claimedBy] : null;
  const assignedMember = assignedTo ? staffLookup[assignedTo] : null;
  const closedMember = closedBy ? staffLookup[closedBy] : null;

  return {
    id: firstNonEmpty(ticket?.id),
    title: normalizeString(ticket?.title || ticket?.channel_name) || "Ticket",
    category: firstNonEmpty(ticket?.category),
    matched_category_name: firstNonEmpty(ticket?.matched_category_name),
    matched_category_slug: firstNonEmpty(ticket?.matched_category_slug),
    matched_intake_type: firstNonEmpty(ticket?.matched_intake_type),
    matched_category_reason: firstNonEmpty(ticket?.matched_category_reason),
    matched_category_score: normalizeNumber(ticket?.matched_category_score, 0),
    status: normalizeString(ticket?.status) || "open",
    priority: normalizeString(ticket?.priority) || "medium",
    claimed_by: claimedBy || null,
    claimed_by_name: claimedMember
      ? resolveMemberDisplayName(claimedMember, claimedBy)
      : claimedBy || null,
    assigned_to: assignedTo || null,
    assigned_to_name: assignedMember
      ? resolveMemberDisplayName(assignedMember, assignedTo)
      : assignedTo || null,
    closed_by: closedBy || null,
    closed_by_name: closedMember
      ? resolveMemberDisplayName(closedMember, closedBy)
      : closedBy || null,
    closed_reason: firstNonEmpty(ticket?.closed_reason),
    created_at: firstNonEmpty(ticket?.created_at),
    updated_at: firstNonEmpty(ticket?.updated_at),
    closed_at: firstNonEmpty(ticket?.closed_at),
    deleted_at: firstNonEmpty(ticket?.deleted_at),
    reopened_at: firstNonEmpty(ticket?.reopened_at),
    sla_deadline: firstNonEmpty(ticket?.sla_deadline),
    channel_id: firstNonEmpty(ticket?.channel_id, ticket?.discord_thread_id),
    channel_name: firstNonEmpty(ticket?.channel_name),
    transcript_url: firstNonEmpty(ticket?.transcript_url),
    source: firstNonEmpty(ticket?.source),
    initial_message: normalizeString(ticket?.initial_message),
    is_ghost: Boolean(ticket?.is_ghost),
    ticket_number: Number.isFinite(Number(ticket?.ticket_number)) ? Number(ticket?.ticket_number) : null,
    username: firstNonEmpty(ticket?.username),
  };
}

async function loadMemberRow(supabase: SupabaseClient, guildId: string, discordId: string): Promise<AnyRecord | null> {
  return safeSupabaseSingle<AnyRecord>(() =>
    supabase
      .from("guild_members")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", discordId)
      .maybeSingle()
  );
}

async function loadMemberLookupByIds(
  supabase: SupabaseClient,
  guildId: string,
  userIds: unknown
): Promise<Record<string, AnyRecord>> {
  const ids = dedupeStrings(userIds);
  if (!ids.length) return {};

  const rows = await safeSupabaseRows<AnyRecord>(() =>
    supabase
      .from("guild_members")
      .select("*")
      .eq("guild_id", guildId)
      .in("user_id", ids)
  );

  const out: Record<string, AnyRecord> = {};
  for (const row of rows) {
    const id = normalizeString(row?.user_id);
    if (!id) continue;
    out[id] = row;
  }
  return out;
}

async function loadTicketCategories(supabase: SupabaseClient, guildId: string): Promise<CategorySummary[]> {
  const rows = await safeSupabaseRows<AnyRecord>(() =>
    supabase
      .from("ticket_categories")
      .select("*")
      .eq("guild_id", guildId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
  );

  return rows.map(sanitizeCategory);
}

async function loadVerificationFlags(supabase: SupabaseClient, guildId: string, discordId: string): Promise<VerificationFlagSummary[]> {
  const rows = await safeSupabaseRows<AnyRecord>(() =>
    supabase
      .from("verification_flags")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", discordId)
      .order("created_at", { ascending: false })
      .limit(20)
  );

  return rows.map(sanitizeVerificationFlag);
}

async function loadVerificationTokens(supabase: SupabaseClient, guildId: string, discordId: string): Promise<VerificationTokenSummary[]> {
  const rows = await safeSupabaseRows<AnyRecord>(() =>
    supabase
      .from("verification_tokens")
      .select("*")
      .eq("guild_id", guildId)
      .or(`requester_id.eq.${discordId},user_id.eq.${discordId},approved_user_id.eq.${discordId}`)
      .order("created_at", { ascending: false })
      .limit(25)
  );

  return rows.map(sanitizeVerificationToken);
}

async function loadRawVcSessions(supabase: SupabaseClient, discordId: string): Promise<AnyRecord[]> {
  const numericId = normalizeNumber(discordId, 0);
  if (!numericId) return [];

  return safeSupabaseRows<AnyRecord>(() =>
    supabase
      .from("vc_verify_sessions")
      .select("*")
      .or(`owner_id.eq.${numericId},requester_id.eq.${numericId}`)
      .order("created_at", { ascending: false })
      .limit(20)
  );
}

async function loadJoinHistory(supabase: SupabaseClient, guildId: string, discordId: string): Promise<JoinHistorySummary[]> {
  const rows = await safeSupabaseRows<AnyRecord>(() =>
    supabase
      .from("member_joins")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", discordId)
      .order("joined_at", { ascending: false })
      .limit(10)
  );

  return rows.map(sanitizeJoinRow);
}

async function loadMemberEvents(supabase: SupabaseClient, guildId: string, discordId: string): Promise<MemberEventSummary[]> {
  const rows = await safeSupabaseRows<AnyRecord>(() =>
    supabase
      .from("member_events")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", discordId)
      .order("created_at", { ascending: false })
      .limit(20)
  );

  return rows.map(sanitizeMemberEventRow);
}

async function loadRecentTickets(supabase: SupabaseClient, guildId: string, discordId: string): Promise<AnyRecord[]> {
  return safeSupabaseRows<AnyRecord>(() =>
    supabase
      .from("tickets")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", discordId)
      .order("updated_at", { ascending: false })
      .limit(50)
  );
}

async function loadActivityFeedEvents(
  supabase: SupabaseClient,
  guildId: string,
  discordId: string,
  ticketIds: string[] = []
): Promise<AnyRecord[]> {
  const byUser = await safeSupabaseRows<AnyRecord>(() =>
    supabase
      .from("activity_feed_events")
      .select("*")
      .eq("guild_id", guildId)
      .or(`target_user_id.eq.${discordId},actor_user_id.eq.${discordId}`)
      .order("created_at", { ascending: false })
      .limit(40)
  );

  let byTicket: AnyRecord[] = [];
  const cleanTicketIds = dedupeStrings(ticketIds);
  if (cleanTicketIds.length) {
    byTicket = await safeSupabaseRows<AnyRecord>(() =>
      supabase
        .from("activity_feed_events")
        .select("*")
        .eq("guild_id", guildId)
        .in("ticket_id", cleanTicketIds)
        .order("created_at", { ascending: false })
        .limit(40)
    );
  }

  return uniqueBy([...byUser, ...byTicket], (row) => row?.id || `${row?.event_type}:${row?.created_at}`);
}

function buildTicketLifecycleEvents(tickets: UserTicketSummary[]): ActivityEventSummary[] {
  const events: ActivityEventSummary[] = [];

  for (const ticket of safeArray<UserTicketSummary>(tickets)) {
    const ticketId = ticket?.id || null;
    const ticketTitle = ticket?.title || ticket?.channel_name || "Ticket";
    const category = ticket?.matched_category_name || ticket?.category || "support";
    const baseMetadata: AnyRecord = {
      ticket_id: ticketId,
      ticket_title: ticketTitle,
      channel_name: ticket?.channel_name || null,
      channel_id: ticket?.channel_id || null,
      category,
      status: ticket?.status || null,
      priority: ticket?.priority || null,
    };

    if (ticket?.created_at) {
      events.push({
        id: `ticket-created-${ticketId || ticket?.created_at}`,
        title: "Ticket Opened",
        description: `Opened ${ticketTitle}`,
        reason: ticket?.initial_message || "",
        event_type: "ticket_created",
        created_at: ticket.created_at,
        updated_at: ticket.created_at,
        actor_id: null,
        actor_name: "System",
        ticket_id: ticketId,
        metadata: baseMetadata,
        _source: "tickets",
      });
    }

    if (ticket?.claimed_by && ticket?.updated_at) {
      events.push({
        id: `ticket-claimed-${ticketId || ticket?.updated_at}`,
        title: "Ticket Claimed",
        description: `${ticketTitle} was claimed by staff.`,
        reason: "",
        event_type: "ticket_claimed",
        created_at: ticket.updated_at,
        updated_at: ticket.updated_at,
        actor_id: ticket?.claimed_by || null,
        actor_name: ticket?.claimed_by_name || ticket?.claimed_by || "Staff",
        ticket_id: ticketId,
        metadata: {
          ...baseMetadata,
          claimed_by: ticket?.claimed_by || null,
          claimed_by_name: ticket?.claimed_by_name || null,
        },
        _source: "tickets",
      });
    }

    if (ticket?.closed_at || normalizeString(ticket?.status).toLowerCase() === "closed") {
      events.push({
        id: `ticket-closed-${ticketId || ticket?.closed_at || ticket?.updated_at}`,
        title: "Ticket Closed",
        description: `${ticketTitle} was closed.`,
        reason: ticket?.closed_reason || "",
        event_type: "ticket_closed",
        created_at: ticket?.closed_at || ticket?.updated_at || null,
        updated_at: ticket?.closed_at || ticket?.updated_at || null,
        actor_id: ticket?.closed_by || null,
        actor_name: ticket?.closed_by_name || ticket?.closed_by || "Staff",
        ticket_id: ticketId,
        metadata: {
          ...baseMetadata,
          closed_by: ticket?.closed_by || null,
          closed_reason: ticket?.closed_reason || null,
        },
        _source: "tickets",
      });
    }

    if (normalizeString(ticket?.status).toLowerCase() === "deleted") {
      events.push({
        id: `ticket-deleted-${ticketId || ticket?.deleted_at || ticket?.updated_at}`,
        title: "Ticket Deleted",
        description: `${ticketTitle} was deleted.`,
        reason: ticket?.closed_reason || "",
        event_type: "ticket_deleted",
        created_at: ticket?.deleted_at || ticket?.closed_at || ticket?.updated_at || null,
        updated_at: ticket?.deleted_at || ticket?.closed_at || ticket?.updated_at || null,
        actor_id: ticket?.closed_by || null,
        actor_name: ticket?.closed_by_name || ticket?.closed_by || "Staff",
        ticket_id: ticketId,
        metadata: {
          ...baseMetadata,
        },
        _source: "tickets",
      });
    }
  }

  return events.filter((event) => Boolean(event?.created_at));
}

function buildVerificationFlagEvents(flags: VerificationFlagSummary[]): ActivityEventSummary[] {
  return safeArray<VerificationFlagSummary>(flags)
    .filter(Boolean)
    .map((flag) => ({
      id: `verification-flag-${flag?.id || flag?.created_at}`,
      title: flag?.flagged ? "Verification Flag Raised" : "Verification Reviewed",
      description: flag?.flagged
        ? "Your verification was flagged for manual review."
        : "Verification review activity detected.",
      reason: Array.isArray(flag?.reasons) ? flag.reasons.join(" • ") : "",
      event_type: "verification_flag",
      created_at: flag?.created_at || null,
      updated_at: flag?.created_at || null,
      actor_id: null,
      actor_name: "System",
      ticket_id: null,
      metadata: {
        score: Number(flag?.score || 0),
        reasons: Array.isArray(flag?.reasons) ? flag.reasons : [],
      },
      _source: "verification_flags",
    }))
    .filter((event) => Boolean(event?.created_at));
}

function buildVerificationTokenEvents(tokens: VerificationTokenSummary[]): ActivityEventSummary[] {
  const events: ActivityEventSummary[] = [];

  for (const row of safeArray<VerificationTokenSummary>(tokens)) {
    if (row?.created_at) {
      events.push({
        id: `verification-token-created-${row?.token || row?.created_at}`,
        title: "Verification Link Issued",
        description: `Verification token status: ${normalizeString(row?.status || "pending")}.`,
        reason: "",
        event_type: "verification_token_created",
        created_at: row.created_at,
        updated_at: row.created_at,
        actor_id: null,
        actor_name: "System",
        ticket_id: null,
        metadata: {
          token: row?.token || null,
          status: row?.status || null,
          decision: row?.decision || null,
        },
        _source: "verification_tokens",
      });
    }

    if (row?.submitted_at) {
      events.push({
        id: `verification-token-submitted-${row?.token || row?.submitted_at}`,
        title: "Verification Submitted",
        description: "Your verification submission was received.",
        reason: "",
        event_type: "verification_submitted",
        created_at: row.submitted_at,
        updated_at: row.submitted_at,
        actor_id: row?.requester_id || null,
        actor_name: (row?.raw?.requester_display_name as string) || (row?.raw?.requester_username as string) || "Member",
        ticket_id: null,
        metadata: {
          token: row?.token || null,
          status: row?.status || null,
        },
        _source: "verification_tokens",
      });
    }

    if (row?.decided_at) {
      const decision = normalizeString(row?.decision || row?.status || "PENDING").toUpperCase();
      events.push({
        id: `verification-token-decided-${row?.token || row?.decided_at}`,
        title:
          decision === "APPROVED"
            ? "Verification Approved"
            : decision === "DENIED"
              ? "Verification Denied"
              : "Verification Updated",
        description: `Verification decision: ${decision}.`,
        reason: row?.role_sync_reason || "",
        event_type:
          decision === "APPROVED"
            ? "verification_approved"
            : decision === "DENIED"
              ? "verification_denied"
              : "verification_decision",
        created_at: row.decided_at,
        updated_at: row.decided_at,
        actor_id: row?.decided_by || null,
        actor_name:
          row?.decided_by_display_name ||
          row?.decided_by_username ||
          row?.decided_by ||
          "Staff",
        ticket_id: null,
        metadata: {
          token: row?.token || null,
          decision,
          status: row?.status || null,
          role_sync_ok: Boolean(row?.role_sync_ok),
        },
        _source: "verification_tokens",
      });
    }
  }

  return events.filter((event) => Boolean(event?.created_at));
}

function buildVcSessionEvents(rows: VcSessionSummary[]): ActivityEventSummary[] {
  const events: ActivityEventSummary[] = [];

  for (const row of safeArray<VcSessionSummary>(rows)) {
    const status = normalizeString(row?.status || "PENDING").toUpperCase();

    if (row?.created_at) {
      events.push({
        id: `vc-created-${row?.token || row?.created_at}`,
        title: "VC Verification Requested",
        description: `VC verification status: ${status}`,
        reason: "",
        event_type: "vc_verify_requested",
        created_at: row.created_at,
        updated_at: row.created_at,
        actor_id: null,
        actor_name: "System",
        ticket_id: row?.ticket_id || null,
        metadata: {
          status,
          access_minutes: Number(row?.access_minutes || 0),
          ticket_channel_id: row?.ticket_channel_id || null,
        },
        _source: "vc_verify_sessions",
      });
    }

    if (row?.accepted_at) {
      events.push({
        id: `vc-accepted-${row?.token || row?.accepted_at}`,
        title: "VC Verification Accepted",
        description: "A staff member accepted your VC verification request.",
        reason: "",
        event_type: "vc_verify_accepted",
        created_at: row.accepted_at,
        updated_at: row.accepted_at,
        actor_id: row?.staff_id || null,
        actor_name: row?.staff_name || row?.staff_id || "Staff",
        ticket_id: row?.ticket_id || null,
        metadata: {
          status,
        },
        _source: "vc_verify_sessions",
      });
    }

    if (row?.started_at) {
      events.push({
        id: `vc-started-${row?.token || row?.started_at}`,
        title: "VC Verification Started",
        description: "Your VC verification session started.",
        reason: "",
        event_type: "vc_verify_started",
        created_at: row.started_at,
        updated_at: row.started_at,
        actor_id: row?.staff_id || null,
        actor_name: row?.staff_name || row?.staff_id || "Staff",
        ticket_id: row?.ticket_id || null,
        metadata: {
          status,
        },
        _source: "vc_verify_sessions",
      });
    }

    if (row?.completed_at) {
      events.push({
        id: `vc-completed-${row?.token || row?.completed_at}`,
        title: "VC Verification Completed",
        description: `VC verification finished with status ${status}.`,
        reason: "",
        event_type: "vc_verify_completed",
        created_at: row.completed_at,
        updated_at: row.completed_at,
        actor_id: row?.staff_id || null,
        actor_name: row?.staff_name || row?.staff_id || "Staff",
        ticket_id: row?.ticket_id || null,
        metadata: {
          status,
        },
        _source: "vc_verify_sessions",
      });
    }

    if (row?.canceled_at) {
      events.push({
        id: `vc-canceled-${row?.token || row?.canceled_at}`,
        title: "VC Verification Ended",
        description: `VC verification ended with status ${status}.`,
        reason: "",
        event_type: "vc_verify_ended",
        created_at: row.canceled_at,
        updated_at: row.canceled_at,
        actor_id: row?.staff_id || null,
        actor_name: row?.staff_name || row?.staff_id || "Staff",
        ticket_id: row?.ticket_id || null,
        metadata: {
          status,
        },
        _source: "vc_verify_sessions",
      });
    }
  }

  return events.filter((event) => Boolean(event?.created_at));
}

function buildJoinEvents(rows: JoinHistorySummary[]): ActivityEventSummary[] {
  return safeArray<JoinHistorySummary>(rows)
    .filter(Boolean)
    .map((row) => ({
      id: `member-join-${row?.id || row?.joined_at}`,
      title: "Joined Server",
      description: "Your member profile was recorded in the server.",
      reason:
        row?.join_note ||
        row?.join_source ||
        row?.entry_method ||
        row?.verification_source ||
        "",
      event_type: "member_join",
      created_at: row?.joined_at || null,
      updated_at: row?.joined_at || null,
      actor_id: null,
      actor_name: "System",
      ticket_id: null,
      metadata: {
        join_source: row?.join_source || null,
        entry_method: row?.entry_method || null,
        verification_source: row?.verification_source || null,
        invite_code: row?.invite_code || null,
        inviter_id: row?.inviter_id || null,
        inviter_name: row?.inviter_name || null,
        vouched_by: row?.vouched_by || null,
        vouched_by_name: row?.vouched_by_name || null,
        approved_by: row?.approved_by || null,
        approved_by_name: row?.approved_by_name || null,
      },
      _source: "member_joins",
    }))
    .filter((event) => Boolean(event?.created_at));
}

function buildMemberEventsTimeline(rows: MemberEventSummary[]): ActivityEventSummary[] {
  return safeArray<MemberEventSummary>(rows)
    .filter(Boolean)
    .map((row) => ({
      id: `member-event-${row?.id || row?.created_at}`,
      title: row?.title || "Member Event",
      description: row?.reason || "",
      reason: row?.reason || "",
      event_type: row?.event_type || "member_event",
      created_at: row?.created_at || null,
      updated_at: row?.created_at || null,
      actor_id: row?.actor_id || null,
      actor_name: row?.actor_name || "System",
      ticket_id: null,
      metadata: safeObject(row?.metadata),
      _source: "member_events",
    }))
    .filter((event) => Boolean(event?.created_at));
}

function normalizeEventObject(event: ActivityEventSummary | null): ActivityEventSummary | null {
  if (!event) return null;

  return {
    id: event?.id || null,
    title: event?.title || "Activity",
    description: event?.description || "",
    reason: event?.reason || "",
    event_type: event?.event_type || "activity",
    created_at: event?.created_at || null,
    updated_at: event?.updated_at || event?.created_at || null,
    actor_id: event?.actor_id || null,
    actor_name: event?.actor_name || "System",
    ticket_id: event?.ticket_id || null,
    metadata: event?.metadata && typeof event.metadata === "object" ? event.metadata : {},
    _source: event?._source || "activity",
  };
}

function buildRecentActivity({
  tickets,
  verificationFlags,
  verificationTokens,
  vcSessions,
  joinHistory,
  memberEvents,
  activityFeedRows,
  limit = 25,
}: {
  tickets: UserTicketSummary[];
  verificationFlags: VerificationFlagSummary[];
  verificationTokens: VerificationTokenSummary[];
  vcSessions: VcSessionSummary[];
  joinHistory: JoinHistorySummary[];
  memberEvents: MemberEventSummary[];
  activityFeedRows: AnyRecord[];
  limit?: number;
}): ActivityEventSummary[] {
  const merged = [
    ...safeArray<AnyRecord>(activityFeedRows).map(sanitizeActivityFeedRow),
    ...buildTicketLifecycleEvents(tickets),
    ...buildVerificationFlagEvents(verificationFlags),
    ...buildVerificationTokenEvents(verificationTokens),
    ...buildVcSessionEvents(vcSessions),
    ...buildJoinEvents(joinHistory),
    ...buildMemberEventsTimeline(memberEvents),
  ]
    .map(normalizeEventObject)
    .filter((item): item is ActivityEventSummary => Boolean(item))
    .sort((a, b) => parseDateMs(b?.created_at) - parseDateMs(a?.created_at));

  const deduped: ActivityEventSummary[] = [];
  const seen = new Set<string>();

  for (const item of merged) {
    const key = `${item?._source || "activity"}:${item?.id || ""}:${item?.created_at || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= limit) break;
  }

  return deduped;
}

function buildUsernameHistory({
  member,
  viewer,
  joinHistory,
  recentTickets,
}: {
  member: MemberSummary;
  viewer: ViewerSummary;
  joinHistory: JoinHistorySummary[];
  recentTickets: UserTicketSummary[];
}): UsernameHistoryRow[] {
  const rows: UsernameHistoryRow[] = [];

  function pushRow(
    source: string,
    createdAt: string | null,
    username: unknown,
    displayName: unknown,
    nickname: unknown
  ): void {
    const cleanUser = normalizeString(username);
    const cleanDisplay = normalizeString(displayName);
    const cleanNick = normalizeString(nickname);

    if (!cleanUser && !cleanDisplay && !cleanNick) return;

    rows.push({
      id: `${source}:${createdAt || cleanUser || cleanDisplay || cleanNick}`,
      created_at: createdAt || null,
      username: cleanUser || null,
      display_name: cleanDisplay || null,
      nickname: cleanNick || null,
      source,
    });
  }

  pushRow(
    "current_member",
    member?.joined_at || null,
    member?.username,
    member?.display_name,
    member?.nickname
  );

  pushRow(
    "viewer_session",
    null,
    viewer?.username,
    viewer?.global_name,
    null
  );

  for (const value of safeArray<string>(member?.previous_usernames)) {
    pushRow("guild_members_previous_username", null, value, null, null);
  }

  for (const value of safeArray<string>(member?.previous_display_names)) {
    pushRow("guild_members_previous_display_name", null, null, value, null);
  }

  for (const value of safeArray<string>(member?.previous_nicknames)) {
    pushRow("guild_members_previous_nickname", null, null, null, value);
  }

  pushRow(
    "guild_members_last_seen",
    null,
    member?.last_seen_username,
    member?.last_seen_display_name,
    member?.last_seen_nickname
  );

  for (const row of safeArray<JoinHistorySummary>(joinHistory)) {
    pushRow(
      "member_joins",
      row?.joined_at,
      row?.username,
      row?.display_name,
      null
    );
  }

  for (const ticket of safeArray<UserTicketSummary>(recentTickets)) {
    pushRow(
      "tickets",
      ticket?.created_at,
      ticket?.username,
      null,
      null
    );
  }

  const sorted = rows.sort(
    (a, b) => parseDateMs(b?.created_at) - parseDateMs(a?.created_at)
  );

  const uniqueRows = uniqueBy(
    sorted,
    (row) =>
      `${normalizeString(row?.username).toLowerCase()}|${normalizeString(row?.display_name).toLowerCase()}|${normalizeString(row?.nickname).toLowerCase()}`
  );

  return uniqueRows.slice(0, 30);
}

function deriveHistoricalUsernames({
  member,
  viewer,
  usernameHistory,
}: {
  member: MemberSummary;
  viewer: ViewerSummary;
  usernameHistory: UsernameHistoryRow[];
}): string[] {
  const candidates: string[] = [];

  pushCandidate(candidates, member?.username);
  pushCandidate(candidates, member?.display_name);
  pushCandidate(candidates, member?.nickname);
  pushCandidate(candidates, member?.last_seen_username);
  pushCandidate(candidates, member?.last_seen_display_name);
  pushCandidate(candidates, member?.last_seen_nickname);
  pushCandidate(candidates, viewer?.username);
  pushCandidate(candidates, viewer?.global_name);

  for (const value of safeArray<string>(member?.previous_usernames)) {
    pushCandidate(candidates, value);
  }
  for (const value of safeArray<string>(member?.previous_display_names)) {
    pushCandidate(candidates, value);
  }
  for (const value of safeArray<string>(member?.previous_nicknames)) {
    pushCandidate(candidates, value);
  }

  for (const row of safeArray<UsernameHistoryRow>(usernameHistory)) {
    pushCandidate(candidates, row?.username);
    pushCandidate(candidates, row?.display_name);
    pushCandidate(candidates, row?.nickname);
  }

  return dedupeStrings(candidates).slice(0, 30);
}

function buildTicketSummary(recentTickets: UserTicketSummary[]): TicketSummaryStats {
  const statusCounts: Record<string, number> = {};
  const priorityCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};

  for (const ticket of safeArray<UserTicketSummary>(recentTickets)) {
    const status = normalizeString(ticket?.status || "unknown").toLowerCase() || "unknown";
    const priority = normalizeString(ticket?.priority || "medium").toLowerCase() || "medium";
    const category =
      normalizeString(ticket?.matched_category_slug || ticket?.category || "support").toLowerCase() ||
      "support";

    statusCounts[status] = (statusCounts[status] || 0) + 1;
    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  }

  return {
    total: safeArray<UserTicketSummary>(recentTickets).length,
    open: (statusCounts.open || 0) + (statusCounts.claimed || 0),
    closed: statusCounts.closed || 0,
    deleted: statusCounts.deleted || 0,
    claimed: statusCounts.claimed || 0,
    status_counts: statusCounts,
    priority_counts: priorityCounts,
    category_counts: categoryCounts,
    latest_ticket_at:
      safeArray<UserTicketSummary>(recentTickets)
        .map((ticket) => ticket?.updated_at || ticket?.created_at)
        .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] || null,
  };
}

function getLatestJoinRow(joinHistory: JoinHistorySummary[]): JoinHistorySummary | null {
  return (
    safeArray<JoinHistorySummary>(joinHistory).sort(
      (a, b) => parseDateMs(b?.joined_at) - parseDateMs(a?.joined_at)
    )[0] || null
  );
}

function deriveEntry(joinHistory: JoinHistorySummary[], member: MemberSummary): EntrySummary {
  const latestJoin = getLatestJoinRow(joinHistory);

  const joinSource =
    latestJoin?.join_source ||
    latestJoin?.verification_source ||
    latestJoin?.entry_method ||
    member?.join_source ||
    member?.verification_source ||
    member?.entry_method ||
    null;

  const entryMethod =
    latestJoin?.entry_method ||
    member?.entry_method ||
    latestJoin?.join_source ||
    member?.join_source ||
    latestJoin?.verification_source ||
    member?.verification_source ||
    null;

  const inviteCode = latestJoin?.invite_code || member?.invite_code || null;
  const inviterId = latestJoin?.inviter_id || member?.invited_by || null;
  const inviterName = latestJoin?.inviter_name || member?.invited_by_name || null;
  const vouchedBy = latestJoin?.vouched_by || member?.vouched_by || null;
  const vouchedByName = latestJoin?.vouched_by_name || member?.vouched_by_name || null;
  const approvedBy = latestJoin?.approved_by || member?.approved_by || null;
  const approvedByName = latestJoin?.approved_by_name || member?.approved_by_name || null;
  const vanityUsed = Boolean(latestJoin?.vanity_used || member?.vanity_used);

  let source_confidence = "unknown";
  let source_truth_reason = "The dashboard does not have enough join-source detail yet.";

  if (vouchedBy || vouchedByName) {
    source_confidence = "confirmed";
    source_truth_reason = "A vouch trail exists for this member.";
  } else if (vanityUsed) {
    source_confidence = "confirmed";
    source_truth_reason = "The join was matched to the server vanity invite.";
  } else if (inviteCode || inviterId || inviterName) {
    source_confidence = "confirmed";
    source_truth_reason = "The join was matched to a tracked Discord invite.";
  } else if (approvedBy || approvedByName) {
    source_confidence = "partial";
    source_truth_reason = "A staff approval trail exists, but the original join source is incomplete.";
  } else if (joinSource || entryMethod) {
    source_confidence = "partial";
    source_truth_reason = "The general entry path is known, but the detailed source trail is incomplete.";
  }

  return {
    joined_at: latestJoin?.joined_at || member?.joined_at || null,
    join_source: joinSource,
    entry_method: entryMethod,
    verification_source:
      latestJoin?.verification_source ||
      member?.verification_source ||
      null,
    invite_code: inviteCode,
    inviter_id: inviterId,
    inviter_name: inviterName,
    vouched_by: vouchedBy,
    vouched_by_name: vouchedByName,
    approved_by: approvedBy,
    approved_by_name: approvedByName,
    source_ticket_id:
      latestJoin?.source_ticket_id ||
      member?.source_ticket_id ||
      null,
    join_note: latestJoin?.join_note || null,
    vanity_used: vanityUsed,
    source_confidence,
    source_truth_reason,
    raw: latestJoin?.raw || null,
  };
}

function buildRecentVouches(member: MemberSummary, joinHistory: JoinHistorySummary[]): VouchRow[] {
  const rows: VouchRow[] = [];

  const currentVouchActorId = normalizeString(member?.vouched_by);
  const currentVouchActorName = normalizeString(member?.vouched_by_name);

  if (currentVouchActorId || currentVouchActorName) {
    rows.push({
      id: `member-vouch-${currentVouchActorId || currentVouchActorName}`,
      created_at: member?.joined_at || null,
      actor_id: currentVouchActorId || null,
      actor_name: currentVouchActorName || currentVouchActorId || null,
      target_user_id: member?.user_id || null,
      reason: member?.entry_reason || "Member was vouched into the server.",
      raw: null,
    });
  }

  for (const row of safeArray<JoinHistorySummary>(joinHistory)) {
    const actorId = normalizeString(row?.vouched_by);
    const actorName = normalizeString(row?.vouched_by_name);
    if (!actorId && !actorName) continue;

    rows.push({
      id: `join-vouch-${row?.id || row?.joined_at || actorId || actorName}`,
      created_at: row?.joined_at || null,
      actor_id: actorId || null,
      actor_name: actorName || actorId || null,
      target_user_id: member?.user_id || null,
      reason: row?.join_note || "Member was vouched into the server.",
      raw: row?.raw || null,
    });
  }

  return uniqueBy(
    rows.sort((a, b) => parseDateMs(b?.created_at) - parseDateMs(a?.created_at)),
    (row) => row?.id
  ).slice(0, 15);
}

function deriveVerificationSummary({
  member,
  verificationFlags,
  verificationTokens,
  vcSessions,
  openTicket,
}: {
  member: MemberSummary;
  verificationFlags: VerificationFlagSummary[];
  verificationTokens: VerificationTokenSummary[];
  vcSessions: VcSessionSummary[];
  openTicket: UserTicketSummary | null;
}): VerificationSummary {
  const flags = safeArray<VerificationFlagSummary>(verificationFlags);
  const tokens = safeArray<VerificationTokenSummary>(verificationTokens);
  const vc = safeArray<VcSessionSummary>(vcSessions);

  const latestToken = sortByCreatedDesc(tokens)[0] || null;
  const latestVc = sortByCreatedDesc(vc)[0] || null;

  let status = "unknown";

  if (member?.has_staff_role) {
    status = "staff";
  } else if (
    member?.has_verified_role ||
    member?.has_secondary_verified_role ||
    normalizeString(latestToken?.status).toLowerCase() === "approved" ||
    normalizeString(latestToken?.decision).toUpperCase() === "APPROVED"
  ) {
    status = "verified";
  } else if (
    normalizeString(latestToken?.status).toLowerCase() === "denied" ||
    normalizeString(latestToken?.decision).toUpperCase() === "DENIED"
  ) {
    status = "denied";
  } else if (flags.some((item) => item?.flagged)) {
    status = "needs_review";
  } else if (
    ["PENDING", "ACCEPTED", "READY", "STARTED", "IN_VC", "STAFF_ACCEPTED"].includes(
      normalizeString(latestVc?.status).toUpperCase()
    )
  ) {
    status = "vc_in_progress";
  } else if (
    ["submitted", "pending", "resubmit", "used"].includes(
      normalizeString(latestToken?.status).toLowerCase()
    ) ||
    member?.has_unverified ||
    openTicket
  ) {
    status = "pending";
  }

  return {
    status,
    has_unverified: Boolean(member?.has_unverified),
    has_verified_role: Boolean(member?.has_verified_role),
    has_secondary_verified_role: Boolean(member?.has_secondary_verified_role),
    has_staff_role: Boolean(member?.has_staff_role),
    flag_count: flags.length,
    flagged_count: flags.filter((item) => item?.flagged).length,
    latest_flag_at:
      flags
        .map((item) => item?.created_at)
        .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] || null,
    vc_request_count: vc.length,
    vc_completed_count: vc.filter((item) => item?.completed_at).length,
    vc_latest_status: sortByCreatedDesc(vc)[0]?.status || null,
    token_count: tokens.length,
    token_latest_status: latestToken?.status || null,
    token_latest_decision: latestToken?.decision || null,
    token_submitted_count: tokens.filter(
      (item) => normalizeString(item?.status).toLowerCase() === "submitted"
    ).length,
    token_pending_count: tokens.filter(
      (item) => normalizeString(item?.status).toLowerCase() === "pending"
    ).length,
    token_approved_count: tokens.filter(
      (item) =>
        normalizeString(item?.status).toLowerCase() === "approved" ||
        normalizeString(item?.decision).toUpperCase() === "APPROVED"
    ).length,
    token_denied_count: tokens.filter(
      (item) =>
        normalizeString(item?.status).toLowerCase() === "denied" ||
        normalizeString(item?.decision).toUpperCase() === "DENIED"
    ).length,
    open_ticket_id: openTicket?.id || null,
  };
}

function buildRelationshipSummary({
  member,
  joinHistory,
  vouches,
  recentTickets,
}: {
  member: MemberSummary;
  joinHistory: JoinHistorySummary[];
  vouches: VouchRow[];
  recentTickets: UserTicketSummary[];
}): RelationshipSummary {
  const entry = deriveEntry(joinHistory, member);
  const latestJoin = getLatestJoinRow(joinHistory);

  return {
    entry_method: entry?.entry_method || member?.entry_method || null,
    verification_source:
      latestJoin?.verification_source ||
      member?.verification_source ||
      entry?.join_source ||
      null,
    join_source: entry?.join_source || member?.join_source || null,
    entry_reason: member?.entry_reason || latestJoin?.join_note || null,
    approval_reason: member?.approval_reason || null,
    invite_code: entry?.invite_code || member?.invite_code || null,
    inviter_id: entry?.inviter_id || member?.invited_by || null,
    inviter_name: entry?.inviter_name || member?.invited_by_name || null,
    vanity_used: Boolean(entry?.vanity_used),
    vouched_by: entry?.vouched_by || member?.vouched_by || null,
    vouched_by_name: entry?.vouched_by_name || member?.vouched_by_name || null,
    approved_by: entry?.approved_by || member?.approved_by || null,
    approved_by_name: entry?.approved_by_name || member?.approved_by_name || null,
    verification_ticket_id: member?.verification_ticket_id || null,
    source_ticket_id:
      entry?.source_ticket_id ||
      member?.source_ticket_id ||
      safeArray<UserTicketSummary>(recentTickets)[0]?.id ||
      null,
    source_confidence: entry?.source_confidence || "unknown",
    source_truth_reason: entry?.source_truth_reason || null,
    vouch_count: safeArray<VouchRow>(vouches).length,
    latest_vouch_at:
      safeArray<VouchRow>(vouches)
        .map((item) => item?.created_at)
        .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] || null,
  };
}

function buildStats({
  recentTickets,
  verificationFlags,
  verificationTokens,
  vcSessions,
  recentActivity,
}: {
  recentTickets: UserTicketSummary[];
  verificationFlags: VerificationFlagSummary[];
  verificationTokens: VerificationTokenSummary[];
  vcSessions: VcSessionSummary[];
  recentActivity: ActivityEventSummary[];
}): DashboardStats {
  return {
    ticket_count: safeArray<UserTicketSummary>(recentTickets).length,
    activity_count: safeArray<ActivityEventSummary>(recentActivity).length,
    verification_flag_count: safeArray<VerificationFlagSummary>(verificationFlags).length,
    verification_token_count: safeArray<VerificationTokenSummary>(verificationTokens).length,
    vc_session_count: safeArray<VcSessionSummary>(vcSessions).length,
    last_activity_at:
      safeArray<ActivityEventSummary>(recentActivity)
        .map((item) => item?.created_at)
        .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] || null,
  };
}

export async function GET(): Promise<NextResponse> {
  try {
    const rawSession = (await getSession()) as unknown;
    const session = asRecord(rawSession);

    if (!Object.keys(session).length) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const guildId = normalizeString(env.guildId);

    if (!guildId) {
      return NextResponse.json(
        { ok: false, error: "Missing guild id." },
        { status: 500 }
      );
    }

    const viewer = deriveViewerFromSession(session, guildId);

    if (!viewer.discord_id) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createServerSupabase();

    const [
      memberRowRaw,
      categories,
      verificationFlags,
      verificationTokens,
      rawVcSessionRows,
      joinHistory,
      memberEvents,
      rawTicketRows,
    ] = await Promise.all([
      loadMemberRow(supabase, guildId, viewer.discord_id),
      loadTicketCategories(supabase, guildId),
      loadVerificationFlags(supabase, guildId, viewer.discord_id),
      loadVerificationTokens(supabase, guildId, viewer.discord_id),
      loadRawVcSessions(supabase, viewer.discord_id),
      loadJoinHistory(supabase, guildId, viewer.discord_id),
      loadMemberEvents(supabase, guildId, viewer.discord_id),
      loadRecentTickets(supabase, guildId, viewer.discord_id),
    ]);

    const member = sanitizeMember(memberRowRaw, viewer);

    const staffIds = dedupeStrings([
      ...safeArray<AnyRecord>(rawTicketRows).map((row) => row?.claimed_by),
      ...safeArray<AnyRecord>(rawTicketRows).map((row) => row?.assigned_to),
      ...safeArray<AnyRecord>(rawTicketRows).map((row) => row?.closed_by),
      ...safeArray<AnyRecord>(rawVcSessionRows).map((row) => row?.accepted_by),
      ...safeArray<AnyRecord>(rawVcSessionRows).map((row) => row?.canceled_by),
      member?.approved_by,
      member?.vouched_by,
    ]);

    const staffLookup = await loadMemberLookupByIds(supabase, guildId, staffIds);

    const vcSessions = safeArray<AnyRecord>(rawVcSessionRows).map((row) =>
      sanitizeVcSession(row, staffLookup)
    );

    const visibleTickets = safeArray<AnyRecord>(rawTicketRows)
      .map((ticket) => ({
        ...ticket,
        priority: ticket?.priority || derivePriority(ticket as never),
        channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
      }))
      .filter((ticket) => !shouldHideStaleTicket(ticket))
      .map((ticket) => sanitizeUserTicket(ticket, staffLookup));

    const recentTickets = sortTickets(visibleTickets as never, "updated_desc") as UserTicketSummary[];
    const openTicket =
      recentTickets.find((ticket) =>
        ["open", "claimed"].includes(normalizeString(ticket?.status).toLowerCase())
      ) || null;

    const ticketIds = recentTickets.map((ticket) => ticket?.id).filter((value): value is string => Boolean(value));
    const activityFeedRows = await loadActivityFeedEvents(
      supabase,
      guildId,
      viewer.discord_id,
      ticketIds
    );

    const usernameHistory = buildUsernameHistory({
      member,
      viewer,
      joinHistory,
      recentTickets,
    });

    const historicalUsernames = deriveHistoricalUsernames({
      member,
      viewer,
      usernameHistory,
    });

    const vouches = buildRecentVouches(member, joinHistory);

    const recentActivity = buildRecentActivity({
      tickets: recentTickets,
      verificationFlags,
      verificationTokens,
      vcSessions,
      joinHistory,
      memberEvents,
      activityFeedRows,
      limit: 25,
    });

    const entry = deriveEntry(joinHistory, member);
    const ticketSummary = buildTicketSummary(recentTickets);
    const verification = deriveVerificationSummary({
      member,
      verificationFlags,
      verificationTokens,
      vcSessions,
      openTicket,
    });
    const relationships = buildRelationshipSummary({
      member,
      joinHistory,
      vouches,
      recentTickets,
    });
    const stats = buildStats({
      recentTickets,
      verificationFlags,
      verificationTokens,
      vcSessions,
      recentActivity,
    });

    return NextResponse.json(
      {
        ok: true,
        viewer,
        member,
        profile: member,
        entry,
        categories,
        verificationFlags,
        verificationTokens,
        verification,
        vcSessions,
        joinHistory,
        memberEvents,
        usernameHistory,
        historicalUsernames,
        vouches,
        relationships,
        openTicket,
        recentTickets,
        ticketSummary,
        recentActivity,
        stats,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load user dashboard.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
