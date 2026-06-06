import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardStaffSession, dashboardAuthJson, type DashboardAuthSession } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AnyRecord = Record<string, unknown>;
type ErrorWithStatus = Error & { status?: number };

type HealthCheck = {
  key: string;
  label: string;
  description: string;
  ok: boolean;
  severity: "required" | "recommended" | "optional";
  action_label?: string;
  action_href?: string;
  detail?: string;
};

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeObject(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function errorStatus(error: unknown, fallback: number): number {
  return typeof (error as ErrorWithStatus)?.status === "number" ? Number((error as ErrorWithStatus).status) : fallback;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function safeRows(queryFactory: () => Promise<{ data?: unknown[] | null; error?: { message?: string } | null }>): Promise<unknown[]> {
  try {
    const response = await queryFactory();
    if (response?.error) return [];
    return safeArray(response?.data);
  } catch {
    return [];
  }
}

async function safeCount(queryFactory: () => Promise<{ count?: number | null; error?: { message?: string } | null }>): Promise<number> {
  try {
    const response = await queryFactory();
    if (response?.error) return 0;
    return Number(response?.count || 0);
  } catch {
    return 0;
  }
}

function hasText(value: unknown): boolean {
  return Boolean(normalizeString(value));
}

function categoryHasForm(category: AnyRecord): boolean {
  if (category?.form_enabled === false) return false;
  const questions = safeArray(category?.form_questions);
  const config = safeObject(category?.form_config);
  if (questions.length > 0) return true;
  return config.disable_default_template !== true && config.forms_disabled !== true;
}

function buildCheck(check: HealthCheck): HealthCheck {
  return check;
}

function serverRequiredHealth(session: DashboardAuthSession | null) {
  const checks: HealthCheck[] = [
    buildCheck({
      key: "server_selected",
      label: "Choose Server",
      description: "Pick the Discord server this dashboard should manage before opening categories, forms, tickets, activity, or member tools.",
      ok: false,
      severity: "required",
      action_label: "Choose Server",
      action_href: "/servers",
      detail: "No selected server",
    }),
  ];

  return dashboardAuthJson(
    {
      ok: false,
      error: "Select a server before checking setup health.",
      needsServerSelection: true,
      selectedGuildId: null,
      score: 0,
      total: checks.length,
      passed: 0,
      required_total: 1,
      required_passed: 0,
      ready_for_launch: false,
      next_fix: checks[0],
      summary: { server_selected: false },
      checks,
    },
    200,
    session
  );
}

export async function GET() {
  let session: DashboardAuthSession | null = null;

  try {
    session = await requireDashboardStaffSession();
    const guildId = normalizeString(session.selectedGuildId);
    if (!guildId) return serverRequiredHealth(session);

    const supabase = createServerSupabase();

    const [categoriesRaw, ticketsCount, activeTicketsCount, botCommandsRaw, activityCount, guildMembersCount, rolesCount] = await Promise.all([
      safeRows(() =>
        supabase
          .from("ticket_categories")
          .select("id,name,slug,is_default,form_enabled,form_questions,form_config,button_label,sort_order")
          .eq("guild_id", guildId)
          .order("sort_order", { ascending: true })
          .limit(50)
      ),
      safeCount(() => supabase.from("tickets").select("*", { count: "exact", head: true }).eq("guild_id", guildId)),
      safeCount(() => supabase.from("tickets").select("*", { count: "exact", head: true }).eq("guild_id", guildId).in("status", ["open", "claimed"])),
      safeRows(() =>
        supabase
          .from("bot_commands")
          .select("id,action,status,created_at,payload")
          .eq("guild_id", guildId)
          .order("created_at", { ascending: false })
          .limit(50)
      ),
      safeCount(() => supabase.from("activity_feed_events").select("*", { count: "exact", head: true }).eq("guild_id", guildId)),
      safeCount(() => supabase.from("guild_members").select("*", { count: "exact", head: true }).eq("guild_id", guildId)),
      safeCount(() => supabase.from("guild_roles").select("*", { count: "exact", head: true }).eq("guild_id", guildId)),
    ]);

    const categories = safeArray<AnyRecord>(categoriesRaw).map(safeObject);
    const botCommands = safeArray<AnyRecord>(botCommandsRaw).map(safeObject);

    const defaultCategory = categories.find((category) => Boolean(category?.is_default)) || null;
    const namedCategories = categories.filter((category) => hasText(category?.name) && hasText(category?.slug));
    const categoriesWithButtons = categories.filter((category) => hasText(category?.button_label));
    const categoriesWithForms = categories.filter(categoryHasForm);
    const panelCommands = botCommands.filter((row) => normalizeString(row?.action).toLowerCase().includes("panel"));
    const doctorCommands = botCommands.filter((row) => normalizeString(row?.action).toLowerCase().includes("doctor"));
    const pendingCommands = botCommands.filter((row) => ["pending", "processing"].includes(normalizeString(row?.status).toLowerCase()));

    const checks: HealthCheck[] = [
      buildCheck({
        key: "server_selected",
        label: "Server Selected",
        description: "Dashboard is scoped to one Discord server before reading or changing data.",
        ok: true,
        severity: "required",
        action_label: "Change Server",
        action_href: "/servers",
        detail: guildId,
      }),
      buildCheck({
        key: "member_sync",
        label: "Member Sync Data",
        description: "Member and role data is available so tickets can show names, roles, and staff context.",
        ok: guildMembersCount > 0,
        severity: "recommended",
        action_label: "Sync Members",
        action_href: "/#actions",
        detail: `${guildMembersCount} member row${guildMembersCount === 1 ? "" : "s"}, ${rolesCount} role row${rolesCount === 1 ? "" : "s"}`,
      }),
      buildCheck({
        key: "categories_created",
        label: "Ticket Categories",
        description: "At least one ticket category exists for member-facing ticket routing.",
        ok: categories.length > 0,
        severity: "required",
        action_label: "Create Categories",
        action_href: "/ticket-categories",
        detail: `${categories.length} categor${categories.length === 1 ? "y" : "ies"}`,
      }),
      buildCheck({
        key: "categories_named",
        label: "Category Labels",
        description: "Categories have clear names and slugs so staff and members understand what each option means.",
        ok: categories.length > 0 && namedCategories.length === categories.length,
        severity: "required",
        action_label: "Review Categories",
        action_href: "/ticket-categories",
        detail: `${namedCategories.length}/${categories.length} ready`,
      }),
      buildCheck({
        key: "default_category",
        label: "Default Category",
        description: "One category should be marked default so uncategorized requests still route safely.",
        ok: Boolean(defaultCategory),
        severity: "recommended",
        action_label: "Set Default",
        action_href: "/ticket-categories",
        detail: defaultCategory ? normalizeString(defaultCategory.name) : "No default category",
      }),
      buildCheck({
        key: "button_labels",
        label: "Button Labels",
        description: "Member-facing buttons should use clear labels like Open Support Ticket or Open Verification Ticket.",
        ok: categories.length > 0 && categoriesWithButtons.length === categories.length,
        severity: "recommended",
        action_label: "Fix Labels",
        action_href: "/ticket-categories",
        detail: `${categoriesWithButtons.length}/${categories.length} labeled`,
      }),
      buildCheck({
        key: "forms_configured",
        label: "Forms / Smart Templates",
        description: "Each category should either use smart defaults or custom questions so staff get useful context.",
        ok: categories.length > 0 && categoriesWithForms.length === categories.length,
        severity: "recommended",
        action_label: "Configure Forms",
        action_href: "/ticket-forms",
        detail: `${categoriesWithForms.length}/${categories.length} covered`,
      }),
      buildCheck({
        key: "panel_activity",
        label: "Panel Publish Activity",
        description: "The dashboard should see panel-related bot activity after the public panel is posted or updated.",
        ok: panelCommands.length > 0,
        severity: "recommended",
        action_label: "Publish Panel",
        action_href: "#panel-command",
        detail: panelCommands.length ? `${panelCommands.length} panel command${panelCommands.length === 1 ? "" : "s"} found` : "No panel command found yet",
      }),
      buildCheck({
        key: "doctor_activity",
        label: "Doctor Check Activity",
        description: "A setup doctor check should run after posting the panel to catch numbering, channel, or routing problems.",
        ok: doctorCommands.length > 0,
        severity: "optional",
        action_label: "Run Doctor",
        action_href: "#panel-command",
        detail: doctorCommands.length ? `${doctorCommands.length} doctor command${doctorCommands.length === 1 ? "" : "s"} found` : "No doctor command found yet",
      }),
      buildCheck({
        key: "test_ticket",
        label: "Test Ticket Flow",
        description: "At least one ticket should exist so staff can confirm open, claim, close, transcript, and dashboard updates.",
        ok: ticketsCount > 0,
        severity: "required",
        action_label: "Open Test Ticket",
        action_href: "/#tickets",
        detail: `${ticketsCount} ticket${ticketsCount === 1 ? "" : "s"}; ${activeTicketsCount} open/claimed`,
      }),
      buildCheck({
        key: "activity_feed",
        label: "Activity Feed",
        description: "Activity events should be flowing so staff can audit ticket, moderation, verification, and system actions.",
        ok: activityCount > 0,
        severity: "recommended",
        action_label: "View Activity",
        action_href: "/#activity",
        detail: `${activityCount} event${activityCount === 1 ? "" : "s"}`,
      }),
      buildCheck({
        key: "command_queue_clear",
        label: "Command Queue Health",
        description: "Pending bot commands should not pile up. Stuck commands usually mean the bot is offline or not reading the queue.",
        ok: pendingCommands.length === 0,
        severity: "required",
        action_label: "Review Actions",
        action_href: "/#actions",
        detail: pendingCommands.length ? `${pendingCommands.length} pending/processing` : "No stuck commands found",
      }),
    ];

    const required = checks.filter((check) => check.severity === "required");
    const passed = checks.filter((check) => check.ok).length;
    const requiredPassed = required.filter((check) => check.ok).length;
    const score = checks.length ? Math.round((passed / checks.length) * 100) : 0;
    const readyForLaunch = required.length > 0 && requiredPassed === required.length;
    const nextFix = checks.find((check) => !check.ok && check.severity === "required") || checks.find((check) => !check.ok) || null;

    return dashboardAuthJson(
      {
        ok: true,
        selectedGuildId: guildId,
        score,
        total: checks.length,
        passed,
        required_total: required.length,
        required_passed: requiredPassed,
        ready_for_launch: readyForLaunch,
        next_fix: nextFix,
        summary: {
          categories: categories.length,
          forms_covered: categoriesWithForms.length,
          tickets: ticketsCount,
          active_tickets: activeTicketsCount,
          activity_events: activityCount,
          guild_members: guildMembersCount,
          guild_roles: rolesCount,
          pending_commands: pendingCommands.length,
        },
        checks,
      },
      200,
      session
    );
  } catch (error) {
    return dashboardAuthJson({ ok: false, error: errorMessage(error, "Failed to check setup health.") }, errorStatus(error, 500), session);
  }
}
