// ============================================================
// File: app/api/user/tickets/create/route.ts
// Purpose:
//   Queue user-created ticket requests from the dashboard with
//   stronger validation, smarter de-dupe checks, richer member
//   context, and safer payload shaping for the bot worker.
// ============================================================

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth-server";
import { env } from "@/lib/env";

type AnyRecord = Record<string, unknown>;

type ViewerInfo = {
  discordId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isStaff: boolean;
};

type CategoryRow = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  intake_type: string;
  button_label: string;
  is_default: boolean;
};

type ExistingTicket = {
  id: string | null;
  title: string | null;
  status: string | null;
  category: string | null;
  matched_category_name: string | null;
  channel_id: string | null;
  channel_name: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ExistingCommand = {
  id: string | null;
  status: string | null;
  created_at: string | null;
  payload?: AnyRecord | null;
};

type MemberSnapshot = {
  role_state?: string | null;
  role_state_reason?: string | null;
  has_unverified?: boolean | null;
  has_verified_role?: boolean | null;
  has_staff_role?: boolean | null;
  has_secondary_verified_role?: boolean | null;
  role_names?: string[] | null;
  joined_at?: string | null;
  entry_method?: string | null;
  join_source?: string | null;
  verification_source?: string | null;
  invite_code?: string | null;
  invited_by?: string | null;
  invited_by_name?: string | null;
  approved_by?: string | null;
  approved_by_name?: string | null;
  vouched_by?: string | null;
  vouched_by_name?: string | null;
  verification_ticket_id?: string | null;
  source_ticket_id?: string | null;
  vanity_used?: boolean | null;
  entry_reason?: string | null;
  approval_reason?: string | null;
};

type RequestBody = {
  category_slug?: unknown;
  slug?: unknown;
  category?: unknown;
  intake_type?: unknown;
  message?: unknown;
  details?: unknown;
  initial_message?: unknown;
  priority?: unknown;
};

const ALLOWED_INTAKE_TYPES = new Set([
  "general",
  "verification",
  "appeal",
  "report",
  "partnership",
  "question",
  "custom",
]);

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

const FALLBACK_CATEGORIES: CategoryRow[] = [
  {
    id: null,
    name: "Verification",
    slug: "verification",
    description:
      "Help with pending verification, missing verified role, or verification review.",
    intake_type: "verification",
    button_label: "Open Verification Ticket",
    is_default: true,
  },
  {
    id: null,
    name: "Appeal",
    slug: "appeal",
    description:
      "Appeal a moderation action or request review of a previous decision.",
    intake_type: "appeal",
    button_label: "Open Appeal Ticket",
    is_default: false,
  },
  {
    id: null,
    name: "Report / Incident",
    slug: "report",
    description:
      "Report a member, suspicious activity, scam, abuse, or other incident.",
    intake_type: "report",
    button_label: "Open Report Ticket",
    is_default: false,
  },
  {
    id: null,
    name: "Question",
    slug: "question",
    description:
      "General support questions, access issues, or guidance on what to do next.",
    intake_type: "question",
    button_label: "Open Question Ticket",
    is_default: false,
  },
];

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSlug(value: unknown): string {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeTextBlock(value: unknown, maxLength = 2000): string {
  return normalizeString(value).replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizePriority(value: unknown): string {
  const normalized = normalizeSlug(value || "medium");
  return ALLOWED_PRIORITIES.has(normalized) ? normalized : "medium";
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeObject(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : {};
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function deriveViewerFromSession(session: AnyRecord): ViewerInfo {
  const user = safeObject(session?.user);
  const discordUser = safeObject(session?.discordUser);
  const member = safeObject(session?.member);

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

  const displayName = normalizeString(
    member?.display_name ||
      discordUser?.global_name ||
      user?.global_name ||
      username
  );

  const avatarUrl = normalizeString(
    user?.avatar_url ||
      user?.avatar ||
      user?.image ||
      user?.picture ||
      discordUser?.avatar_url ||
      discordUser?.avatar ||
      ""
  );

  return {
    discordId,
    username,
    displayName: displayName || username,
    avatarUrl: avatarUrl || null,
    isStaff: Boolean(session?.isStaff),
  };
}

function sanitizeCategoryRow(row: AnyRecord): CategoryRow {
  return {
    id: normalizeString(row?.id) || null,
    name: normalizeString(row?.name || "Support"),
    slug: normalizeSlug(row?.slug || row?.name || "support"),
    description: normalizeTextBlock(row?.description || "", 400),
    intake_type: normalizeSlug(row?.intake_type || "general"),
    button_label: normalizeString(row?.button_label || "Open Support Ticket"),
    is_default: Boolean(row?.is_default),
  };
}

async function getConfiguredCategories(
  supabase: SupabaseClient,
  guildId: string
): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("ticket_categories")
    .select("*")
    .eq("guild_id", guildId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = safeArray<AnyRecord>(data).map(sanitizeCategoryRow);
  return rows.length ? rows : FALLBACK_CATEGORIES;
}

function pickCategory(categories: CategoryRow[], body: RequestBody): CategoryRow {
  const requestedSlug = normalizeSlug(
    body?.category_slug || body?.slug || body?.category
  );
  const requestedIntakeType = normalizeSlug(body?.intake_type);

  const category =
    categories.find((item) => normalizeSlug(item?.slug) === requestedSlug) ||
    categories.find(
      (item) => normalizeSlug(item?.intake_type) === requestedIntakeType
    ) ||
    categories.find((item) => Boolean(item?.is_default)) ||
    categories[0] ||
    null;

  if (!category) {
    throw new Error("No support category is available.");
  }

  const intakeType = normalizeSlug(category?.intake_type || "general");
  if (!ALLOWED_INTAKE_TYPES.has(intakeType)) {
    throw new Error("That category is not allowed.");
  }

  return category;
}

async function findExistingOpenTicket(
  supabase: SupabaseClient,
  guildId: string,
  userId: string
): Promise<ExistingTicket | null> {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .in("status", ["open", "claimed"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || typeof data !== "object") {
    return null;
  }

  const row = data as AnyRecord;

  return {
    id: normalizeString(row?.id) || null,
    title: normalizeString(row?.title) || null,
    status: normalizeString(row?.status) || null,
    category: normalizeString(row?.category) || null,
    matched_category_name: normalizeString(row?.matched_category_name) || null,
    channel_id: normalizeString(row?.channel_id) || null,
    channel_name: normalizeString(row?.channel_name) || null,
    created_at: normalizeString(row?.created_at) || null,
    updated_at: normalizeString(row?.updated_at) || null,
  };
}

function isFreshPendingCommand(row: ExistingCommand, maxMinutes = 20): boolean {
  try {
    const createdAt = new Date(row?.created_at || 0).getTime();
    if (!Number.isFinite(createdAt) || createdAt <= 0) return false;
    const ageMs = Date.now() - createdAt;
    return ageMs <= maxMinutes * 60 * 1000;
  } catch {
    return false;
  }
}

async function findExistingPendingCommand(
  supabase: SupabaseClient,
  guildId: string,
  userId: string
): Promise<ExistingCommand | null> {
  const { data, error } = await supabase
    .from("bot_commands")
    .select("*")
    .eq("guild_id", guildId)
    .eq("action", "create_ticket")
    .eq("requested_by", userId)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  const rows = safeArray<AnyRecord>(data).map((row) => ({
    id: normalizeString(row?.id) || null,
    status: normalizeString(row?.status) || null,
    created_at: normalizeString(row?.created_at) || null,
    payload: safeObject(row?.payload),
  }));

  return (
    rows.find((row) => {
      const payload = safeObject(row?.payload);
      const payloadUserId = normalizeString(
        payload?.user_id || payload?.owner_id || payload?.requester_id
      );

      return payloadUserId === userId && isFreshPendingCommand(row, 20);
    }) || null
  );
}

async function getMemberSnapshot(
  supabase: SupabaseClient,
  guildId: string,
  userId: string
): Promise<MemberSnapshot | null> {
  try {
    const { data, error } = await supabase
      .from("guild_members")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data || typeof data !== "object") return null;

    const row = data as AnyRecord;

    return {
      role_state: normalizeString(row?.role_state) || null,
      role_state_reason: normalizeString(row?.role_state_reason) || null,
      has_unverified: Boolean(row?.has_unverified),
      has_verified_role: Boolean(row?.has_verified_role),
      has_staff_role: Boolean(row?.has_staff_role),
      has_secondary_verified_role: Boolean(row?.has_secondary_verified_role),
      role_names: safeArray<string>(row?.role_names),
      joined_at: normalizeString(row?.joined_at) || null,
      entry_method: normalizeString(row?.entry_method) || null,
      join_source: normalizeString(row?.join_source) || null,
      verification_source: normalizeString(row?.verification_source) || null,
      invite_code: normalizeString(row?.invite_code) || null,
      invited_by: normalizeString(row?.invited_by) || null,
      invited_by_name: normalizeString(row?.invited_by_name) || null,
      approved_by: normalizeString(row?.approved_by) || null,
      approved_by_name: normalizeString(row?.approved_by_name) || null,
      vouched_by: normalizeString(row?.vouched_by) || null,
      vouched_by_name: normalizeString(row?.vouched_by_name) || null,
      verification_ticket_id:
        normalizeString(row?.verification_ticket_id) || null,
      source_ticket_id: normalizeString(row?.source_ticket_id) || null,
      vanity_used: Boolean(row?.vanity_used),
      entry_reason: normalizeString(row?.entry_reason) || null,
      approval_reason: normalizeString(row?.approval_reason) || null,
    };
  } catch {
    return null;
  }
}

function buildInitialMessage(
  body: RequestBody,
  category: CategoryRow,
  viewer: ViewerInfo,
  memberSnapshot: MemberSnapshot | null
): string {
  const requestedCategory = normalizeString(
    category?.name || category?.slug || "Support"
  );
  const details = normalizeTextBlock(
    body?.message || body?.details || body?.initial_message,
    1600
  );

  const parts = [
    `Ticket requested by ${viewer.displayName} (${viewer.discordId}).`,
    `Requested category: ${requestedCategory}.`,
  ];

  const joinSource = normalizeString(
    memberSnapshot?.join_source || memberSnapshot?.entry_method || ""
  );
  const roleState = normalizeString(memberSnapshot?.role_state || "");

  if (joinSource) {
    parts.push(`Join source: ${joinSource}.`);
  }

  if (roleState) {
    parts.push(`Role state: ${roleState}.`);
  }

  if (details) {
    parts.push(`Member message: ${details}`);
  }

  return parts.join(" ");
}

function buildCommandPayload({
  guildId,
  viewer,
  category,
  initialMessage,
  memberSnapshot,
  requestBody,
}: {
  guildId: string;
  viewer: ViewerInfo;
  category: CategoryRow;
  initialMessage: string;
  memberSnapshot: MemberSnapshot | null;
  requestBody: RequestBody;
}): AnyRecord {
  const categoryName = normalizeString(category?.name || "Support");
  const categorySlug = normalizeSlug(category?.slug || "general");
  const intakeType = normalizeSlug(category?.intake_type || "general");
  const priority = normalizePriority(requestBody?.priority);

  const entryMethod = normalizeString(memberSnapshot?.entry_method || "");
  const joinSource = normalizeString(memberSnapshot?.join_source || "");
  const verificationSource = normalizeString(
    memberSnapshot?.verification_source || ""
  );
  const inviteCode = normalizeString(memberSnapshot?.invite_code || "");
  const invitedBy = normalizeString(memberSnapshot?.invited_by || "");
  const invitedByName = normalizeString(memberSnapshot?.invited_by_name || "");
  const approvedBy = normalizeString(memberSnapshot?.approved_by || "");
  const approvedByName = normalizeString(memberSnapshot?.approved_by_name || "");
  const vouchedBy = normalizeString(memberSnapshot?.vouched_by || "");
  const vouchedByName = normalizeString(memberSnapshot?.vouched_by_name || "");

  return {
    guild_id: guildId,
    user_id: viewer.discordId,
    owner_id: viewer.discordId,
    requester_id: viewer.discordId,
    username: viewer.username,
    owner_username: viewer.username,
    owner_display_name: viewer.displayName,
    owner_avatar_url: viewer.avatarUrl,
    category: categorySlug,
    category_name: categoryName,
    category_slug: categorySlug,
    intake_type: intakeType,
    priority,
    title: `${categoryName} - ${viewer.displayName}`.slice(0, 120),
    initial_message: initialMessage,
    member_message: normalizeTextBlock(
      requestBody?.message ||
        requestBody?.details ||
        requestBody?.initial_message,
      1600
    ),
    source: "dashboard",
    create_from: "user_dashboard",
    matched_category_name: categoryName,
    matched_category_slug: categorySlug,
    matched_intake_type: intakeType,
    category_id: category?.id || null,
    requested_at: new Date().toISOString(),

    member_snapshot: {
      role_state: memberSnapshot?.role_state || null,
      role_state_reason: memberSnapshot?.role_state_reason || null,
      has_unverified: Boolean(memberSnapshot?.has_unverified),
      has_verified_role: Boolean(memberSnapshot?.has_verified_role),
      has_staff_role: Boolean(memberSnapshot?.has_staff_role),
      has_secondary_verified_role: Boolean(
        memberSnapshot?.has_secondary_verified_role
      ),
      role_names: safeArray<string>(memberSnapshot?.role_names).slice(0, 25),
      joined_at: memberSnapshot?.joined_at || null,
      entry_method: entryMethod || null,
      join_source: joinSource || null,
      verification_source: verificationSource || null,
      invite_code: inviteCode || null,
      invited_by: invitedBy || null,
      invited_by_name: invitedByName || null,
      approved_by: approvedBy || null,
      approved_by_name: approvedByName || null,
      vouched_by: vouchedBy || null,
      vouched_by_name: vouchedByName || null,
      verification_ticket_id: memberSnapshot?.verification_ticket_id || null,
      source_ticket_id: memberSnapshot?.source_ticket_id || null,
      vanity_used: Boolean(memberSnapshot?.vanity_used),
      entry_reason: memberSnapshot?.entry_reason || null,
      approval_reason: memberSnapshot?.approval_reason || null,
    },

    dashboard_context: {
      requested_category_name: categoryName,
      requested_category_slug: categorySlug,
      requested_intake_type: intakeType,
      requested_priority: priority,
      requested_by_display_name: viewer.displayName,
      requested_by_username: viewer.username,
      requested_by_avatar_url: viewer.avatarUrl,
    },
  };
}

export async function POST(request: Request) {
  try {
    const rawSession = (await getSession()) as unknown;
    const session = safeObject(rawSession);

    if (!Object.keys(session).length) {
      return noStoreJson({ ok: false, error: "Unauthorized" }, 401);
    }

    const viewer = deriveViewerFromSession(session);

    if (!viewer.discordId) {
      return noStoreJson({ ok: false, error: "Unauthorized" }, 401);
    }

    const guildId = normalizeString(env.guildId);
    if (!guildId) {
      return noStoreJson({ ok: false, error: "Missing guild id." }, 500);
    }

    const requestBody = safeObject(
      (await request.json().catch(() => ({}))) as unknown
    ) as RequestBody;

    const supabase = createServerSupabase() as SupabaseClient;

    const [existingOpenTicket, existingPendingCommand, categories, memberSnapshot] =
      await Promise.all([
        findExistingOpenTicket(supabase, guildId, viewer.discordId),
        findExistingPendingCommand(supabase, guildId, viewer.discordId),
        getConfiguredCategories(supabase, guildId),
        getMemberSnapshot(supabase, guildId, viewer.discordId),
      ]);

    if (existingOpenTicket) {
      return noStoreJson(
        {
          ok: false,
          error: "You already have an open ticket.",
          existing_ticket: {
            id: existingOpenTicket.id,
            title: existingOpenTicket.title,
            status: existingOpenTicket.status,
            category: existingOpenTicket.category,
            matched_category_name: existingOpenTicket.matched_category_name,
            channel_id: existingOpenTicket.channel_id,
            channel_name: existingOpenTicket.channel_name,
            created_at: existingOpenTicket.created_at,
            updated_at: existingOpenTicket.updated_at,
          },
        },
        409
      );
    }

    if (existingPendingCommand) {
      return noStoreJson(
        {
          ok: false,
          error: "A ticket request is already being processed.",
          existing_command: {
            id: existingPendingCommand.id,
            status: existingPendingCommand.status,
            created_at: existingPendingCommand.created_at,
          },
        },
        409
      );
    }

    const category = pickCategory(categories, requestBody);
    const initialMessage = buildInitialMessage(
      requestBody,
      category,
      viewer,
      memberSnapshot
    );

    const payload = buildCommandPayload({
      guildId,
      viewer,
      category,
      initialMessage,
      memberSnapshot,
      requestBody,
    });

    const { data: commandRow, error: commandError } = await supabase
      .from("bot_commands")
      .insert({
        guild_id: guildId,
        action: "create_ticket",
        payload,
        status: "pending",
        requested_by: viewer.discordId,
      })
      .select("*")
      .single();

    if (commandError) {
      return noStoreJson({ ok: false, error: commandError.message }, 500);
    }

    const command = safeObject(commandRow);

    return noStoreJson({
      ok: true,
      queued: true,
      command: {
        id: normalizeString(command?.id) || null,
        status: normalizeString(command?.status) || null,
        created_at: normalizeString(command?.created_at) || null,
      },
      requested_category: {
        id: category?.id || null,
        name: normalizeString(category?.name),
        slug: normalizeString(category?.slug),
        intake_type: normalizeString(category?.intake_type || "general"),
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to queue ticket creation.";

    return noStoreJson({ ok: false, error: message }, 400);
  }
}
