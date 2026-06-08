import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";

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
    name: "General Support",
    slug: "general-support",
    description: "General help, questions, and server support.",
    intake_type: "general",
    button_label: "Open Support Ticket",
    is_default: true,
  },
  {
    id: null,
    name: "Verification Issue",
    slug: "verification-issue",
    description: "Help with pending verification, missing verified role, or verification review.",
    intake_type: "verification",
    button_label: "Open Verification Ticket",
    is_default: false,
  },
  {
    id: null,
    name: "Appeals / Reports",
    slug: "appeals-reports",
    description: "Ban appeals, reports, and staff review requests.",
    intake_type: "appeal",
    button_label: "Open Appeal Ticket",
    is_default: false,
  },
  {
    id: null,
    name: "COD / Service Support",
    slug: "cod-service-support",
    description: "Support for COD services, modded lobbies, older Call of Duty titles, and hosted service questions.",
    intake_type: "custom",
    button_label: "Open COD Support Ticket",
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

function selectedGuildId(): string {
  return normalizeString(getSelectedGuildId());
}

function inferErrorCode(body: unknown, status: number): string | null {
  const payload = safeObject(body);
  const explicit = normalizeString(payload.error_code || payload.code);
  if (explicit) return explicit;
  if (status === 401) return "signed_out";
  if (status === 428) return "selected_server_required";
  if (status === 409) return "ticket_conflict";
  if (status === 400) return "invalid_request";
  if (status >= 500) return "server_error";
  return null;
}

function normalizeErrorPayload(body: unknown, status: number): unknown {
  const payload = safeObject(body);
  if (status < 400 || !Object.keys(payload).length) return body;
  const errorCode = inferErrorCode(payload, status);
  return {
    ...payload,
    ok: payload.ok ?? false,
    error: payload.error || (status === 401 ? "Discord login required." : "Request failed."),
    error_code: errorCode || undefined,
    needsServerSelection: payload.needsServerSelection ?? errorCode === "selected_server_required",
    retryable: payload.retryable ?? false,
  };
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(normalizeErrorPayload(body, status), {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function signedOutResponse() {
  return noStoreJson(
    {
      ok: false,
      error: "Discord login required.",
      error_code: "signed_out",
      retryable: false,
    },
    401
  );
}

function deriveViewerFromSession(session: AnyRecord): ViewerInfo {
  const user = safeObject(session?.user);
  const discordUser = safeObject(session?.discordUser);
  const member = safeObject(session?.member);

  const discordId = normalizeString(user?.discord_id || user?.id || discordUser?.id);
  const username = normalizeString(
    user?.username ||
      discordUser?.username ||
      user?.global_name ||
      user?.name ||
      "Member"
  );
  const displayName = normalizeString(
    member?.display_name || discordUser?.global_name || user?.global_name || username
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
  const intakeType = normalizeSlug(row?.intake_type || "general");
  return {
    id: normalizeString(row?.id) || null,
    name: normalizeString(row?.name || "Support"),
    slug: normalizeSlug(row?.slug || row?.name || "support"),
    description: normalizeTextBlock(row?.description || "", 400),
    intake_type: ALLOWED_INTAKE_TYPES.has(intakeType) ? intakeType : "general",
    button_label: normalizeString(row?.button_label || "Open Support Ticket"),
    is_default: Boolean(row?.is_default),
  };
}

async function getConfiguredCategories(supabase: any, guildId: string): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("ticket_categories")
    .select("*")
    .eq("guild_id", guildId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = safeArray<AnyRecord>(data).map(sanitizeCategoryRow);
  return rows.length ? rows : FALLBACK_CATEGORIES;
}

function pickCategory(categories: CategoryRow[], body: RequestBody): CategoryRow {
  const requestedSlug = normalizeSlug(body?.category_slug || body?.slug || body?.category);
  const requestedIntakeType = normalizeSlug(body?.intake_type);

  const category =
    categories.find((item) => normalizeSlug(item?.slug) === requestedSlug) ||
    categories.find((item) => normalizeSlug(item?.intake_type) === requestedIntakeType) ||
    categories.find((item) => Boolean(item?.is_default)) ||
    categories[0] ||
    null;

  if (!category) throw new Error("No support category is available.");

  const intakeType = normalizeSlug(category?.intake_type || "general");
  if (!ALLOWED_INTAKE_TYPES.has(intakeType)) throw new Error("That category is not allowed.");

  return category;
}

async function findExistingOpenTicket(supabase: any, guildId: string, userId: string) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .in("status", ["open", "claimed"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data && typeof data === "object" ? safeObject(data) : null;
}

function isFreshPendingCommand(row: AnyRecord, maxMinutes = 20): boolean {
  const createdAt = new Date(String(row?.created_at || 0)).getTime();
  if (!Number.isFinite(createdAt) || createdAt <= 0) return false;
  return Date.now() - createdAt <= maxMinutes * 60 * 1000;
}

async function findExistingPendingCommand(supabase: any, guildId: string, userId: string) {
  const { data, error } = await supabase
    .from("bot_commands")
    .select("*")
    .eq("guild_id", guildId)
    .eq("action", "create_ticket")
    .eq("requested_by", userId)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw new Error(error.message);

  return (
    safeArray<AnyRecord>(data).find((row) => {
      const payload = safeObject(row?.payload);
      const payloadUserId = normalizeString(payload?.user_id || payload?.owner_id || payload?.requester_id);
      return payloadUserId === userId && isFreshPendingCommand(row, 20);
    }) || null
  );
}

async function getMemberSnapshot(supabase: any, guildId: string, userId: string) {
  const { data } = await supabase
    .from("guild_members")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .maybeSingle();

  return data && typeof data === "object" ? safeObject(data) : null;
}

function buildInitialMessage(body: RequestBody, category: CategoryRow, viewer: ViewerInfo, memberSnapshot: AnyRecord | null): string {
  const details = normalizeTextBlock(body?.message || body?.details || body?.initial_message, 1600);
  const parts = [
    `Ticket requested by ${viewer.displayName} (${viewer.discordId}).`,
    `Requested category: ${category.name}.`,
  ];

  const joinSource = normalizeString(memberSnapshot?.join_source || memberSnapshot?.entry_method || "");
  const roleState = normalizeString(memberSnapshot?.role_state || "");

  if (joinSource) parts.push(`Join source: ${joinSource}.`);
  if (roleState) parts.push(`Role state: ${roleState}.`);
  if (details) parts.push(`Member message: ${details}`);

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
  memberSnapshot: AnyRecord | null;
  requestBody: RequestBody;
}): AnyRecord {
  const categoryName = normalizeString(category?.name || "Support");
  const categorySlug = normalizeSlug(category?.slug || "general");
  const intakeType = normalizeSlug(category?.intake_type || "general");
  const priority = normalizePriority(requestBody?.priority);
  const memberMessage = normalizeTextBlock(
    requestBody?.message || requestBody?.details || requestBody?.initial_message,
    1600
  );

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
    member_message: memberMessage,
    source: "dashboard",
    create_from: "user_dashboard",
    matched_category_name: categoryName,
    matched_category_slug: categorySlug,
    matched_intake_type: intakeType,
    category_id: category?.id || null,
    requested_at: new Date().toISOString(),
    member_snapshot: {
      role_state: normalizeString(memberSnapshot?.role_state) || null,
      role_state_reason: normalizeString(memberSnapshot?.role_state_reason) || null,
      has_unverified: Boolean(memberSnapshot?.has_unverified),
      has_verified_role: Boolean(memberSnapshot?.has_verified_role),
      has_staff_role: Boolean(memberSnapshot?.has_staff_role),
      has_secondary_verified_role: Boolean(memberSnapshot?.has_secondary_verified_role),
      role_names: safeArray<string>(memberSnapshot?.role_names).slice(0, 25),
      joined_at: normalizeString(memberSnapshot?.joined_at) || null,
      entry_method: normalizeString(memberSnapshot?.entry_method) || null,
      join_source: normalizeString(memberSnapshot?.join_source) || null,
      verification_source: normalizeString(memberSnapshot?.verification_source) || null,
      invite_code: normalizeString(memberSnapshot?.invite_code) || null,
      invited_by: normalizeString(memberSnapshot?.invited_by) || null,
      invited_by_name: normalizeString(memberSnapshot?.invited_by_name) || null,
      approved_by: normalizeString(memberSnapshot?.approved_by) || null,
      approved_by_name: normalizeString(memberSnapshot?.approved_by_name) || null,
      vouched_by: normalizeString(memberSnapshot?.vouched_by) || null,
      vouched_by_name: normalizeString(memberSnapshot?.vouched_by_name) || null,
      verification_ticket_id: normalizeString(memberSnapshot?.verification_ticket_id) || null,
      source_ticket_id: normalizeString(memberSnapshot?.source_ticket_id) || null,
      vanity_used: Boolean(memberSnapshot?.vanity_used),
      entry_reason: normalizeString(memberSnapshot?.entry_reason) || null,
      approval_reason: normalizeString(memberSnapshot?.approval_reason) || null,
    },
    dashboard_context: {
      selected_guild_id: guildId,
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

    if (!Object.keys(session).length) return signedOutResponse();

    const viewer = deriveViewerFromSession(session);
    if (!viewer.discordId) return signedOutResponse();

    const guildId = selectedGuildId();
    if (!guildId) {
      return noStoreJson(
        {
          ok: false,
          error: "Select a server before creating a ticket.",
          error_code: "selected_server_required",
          needsServerSelection: true,
        },
        428
      );
    }

    const requestBody = safeObject((await request.json().catch(() => ({}))) as unknown) as RequestBody;
    const supabase = createServerSupabase();

    const [existingOpenTicket, existingPendingCommand, categories, memberSnapshot] = await Promise.all([
      findExistingOpenTicket(supabase, guildId, viewer.discordId),
      findExistingPendingCommand(supabase, guildId, viewer.discordId),
      getConfiguredCategories(supabase, guildId),
      getMemberSnapshot(supabase, guildId, viewer.discordId),
    ]);

    if (existingOpenTicket) {
      return noStoreJson(
        {
          ok: false,
          selectedGuildId: guildId,
          error: "You already have an open ticket.",
          error_code: "existing_open_ticket",
          existing_ticket: {
            id: normalizeString(existingOpenTicket.id) || null,
            title: normalizeString(existingOpenTicket.title) || null,
            status: normalizeString(existingOpenTicket.status) || null,
            category: normalizeString(existingOpenTicket.category) || null,
            matched_category_name: normalizeString(existingOpenTicket.matched_category_name) || null,
            channel_id: normalizeString(existingOpenTicket.channel_id) || null,
            channel_name: normalizeString(existingOpenTicket.channel_name) || null,
            created_at: normalizeString(existingOpenTicket.created_at) || null,
            updated_at: normalizeString(existingOpenTicket.updated_at) || null,
          },
        },
        409
      );
    }

    if (existingPendingCommand) {
      return noStoreJson(
        {
          ok: false,
          selectedGuildId: guildId,
          error: "A ticket request is already being processed.",
          error_code: "ticket_request_processing",
          retryable: true,
          existing_command: {
            id: normalizeString(existingPendingCommand.id) || null,
            status: normalizeString(existingPendingCommand.status) || null,
            created_at: normalizeString(existingPendingCommand.created_at) || null,
          },
        },
        409
      );
    }

    const category = pickCategory(categories, requestBody);
    const initialMessage = buildInitialMessage(requestBody, category, viewer, memberSnapshot);
    const payload = buildCommandPayload({ guildId, viewer, category, initialMessage, memberSnapshot, requestBody });

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

    if (commandError) return noStoreJson({ ok: false, selectedGuildId: guildId, error: commandError.message, error_code: "server_error" }, 500);

    const command = safeObject(commandRow);
    return noStoreJson({
      ok: true,
      selectedGuildId: guildId,
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
    const message = error instanceof Error ? error.message : "Failed to queue ticket creation.";
    return noStoreJson({ ok: false, error: message, error_code: "invalid_request" }, 400);
  }
}
