import { createServerSupabase } from "@/lib/supabase-server";
import {
  dashboardAuthErrorJson,
  dashboardAuthJson,
  requireDashboardStaffSession,
  type DashboardAuthSession,
} from "@/lib/dashboard-auth";
import {
  DEFAULT_PROFILE_CUSTOMIZER_SETTINGS,
  getDefaultProfilePanels,
  type ProfilePanelPreset,
} from "@/lib/profileCustomizer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SupabaseLike = ReturnType<typeof createServerSupabase>;

function clean(value: unknown): string {
  return String(value || "").trim();
}

function actorId(session: DashboardAuthSession | null): string | null {
  return clean(session?.user?.discord_id || session?.discordUser?.id || session?.user?.id || null) || null;
}

function actorName(session: DashboardAuthSession | null): string | null {
  return (
    clean(session?.user?.global_name) ||
    clean(session?.user?.username) ||
    clean(session?.discordUser?.global_name) ||
    clean(session?.discordUser?.username) ||
    null
  );
}

async function loadProfileCustomizerState(supabase: SupabaseLike, guildId: string) {
  const [settingsRes, panelsRes] = await Promise.all([
    supabase.from("profile_customizer_settings").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase
      .from("profile_role_panels")
      .select("*, options:profile_role_options(*)")
      .eq("guild_id", guildId)
      .order("sort_order", { ascending: true })
      .order("sort_order", { foreignTable: "profile_role_options", ascending: true }),
  ]);

  if (settingsRes.error) throw new Error(settingsRes.error.message);
  if (panelsRes.error) throw new Error(panelsRes.error.message);

  return {
    settings: settingsRes.data || null,
    panels: panelsRes.data || [],
  };
}

function panelRow(guildId: string, panel: ProfilePanelPreset, now: string) {
  return {
    guild_id: guildId,
    panel_key: panel.panelKey,
    title: panel.title,
    description: panel.description,
    enabled: true,
    optional: panel.optional,
    allow_multiple: panel.allowMultiple,
    max_choices: panel.maxChoices,
    sort_order: panel.sortOrder,
    updated_at: now,
  };
}

function optionRow(args: {
  guildId: string;
  panelId: string;
  panel: ProfilePanelPreset;
  option: ProfilePanelPreset["options"][number];
  now: string;
}) {
  return {
    guild_id: args.guildId,
    panel_id: args.panelId,
    option_key: args.option.optionKey,
    label: args.option.label,
    description: args.option.description,
    emoji: args.option.emoji,
    role_name: args.option.roleName,
    privacy_kind: args.option.privacyKind || "public_role",
    enabled: true,
    sort_order: args.option.sortOrder,
    updated_at: args.now,
  };
}

async function writeAuditEvent(supabase: SupabaseLike, args: {
  guildId: string;
  actorId: string | null;
  actorName: string | null;
  panels: number;
  options: number;
}) {
  const attempts = [
    {
      guild_id: args.guildId,
      title: "Profile Customizer defaults applied",
      description: `Seeded ${args.panels} optional profile panels and ${args.options} profile options.`,
      event_family: "profile",
      event_type: "profile_customizer_defaults_seeded",
      source: "dashboard_profile_customizer",
      actor_user_id: args.actorId,
      actor_name: args.actorName,
      metadata: {
        seeded_panels: args.panels,
        seeded_options: args.options,
        require_before_access: false,
      },
    },
    {
      guild_id: args.guildId,
      title: "Profile Customizer defaults applied",
      description: `Seeded ${args.panels} optional profile panels and ${args.options} profile options.`,
      event_type: "profile_customizer_defaults_seeded",
      source: "dashboard_profile_customizer",
      actor_user_id: args.actorId,
      actor_name: args.actorName,
    },
  ];

  for (const candidate of attempts) {
    try {
      const { error } = await supabase.from("activity_feed_events").insert(candidate);
      if (!error) return;
    } catch {
      // Audit logging is best effort so setup cannot fail because the optional feed table shape differs.
    }
  }
}

export async function GET() {
  let session: DashboardAuthSession | null = null;
  try {
    session = await requireDashboardStaffSession();
    const guildId = clean(session.selectedGuildId);
    const supabase = createServerSupabase();
    const state = await loadProfileCustomizerState(supabase, guildId);

    return dashboardAuthJson(
      {
        ok: true,
        selectedGuildId: guildId,
        ...state,
        defaults: {
          settings: DEFAULT_PROFILE_CUSTOMIZER_SETTINGS,
          panels: getDefaultProfilePanels(),
        },
      },
      200,
      session
    );
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}

export async function POST() {
  let session: DashboardAuthSession | null = null;
  try {
    session = await requireDashboardStaffSession();
    const guildId = clean(session.selectedGuildId);
    if (!guildId) {
      return dashboardAuthJson(
        {
          ok: false,
          error: "Select a server before setting up Profile Customizer.",
          error_code: "selected_server_required",
          needsServerSelection: true,
        },
        428,
        session
      );
    }

    const supabase = createServerSupabase();
    const now = new Date().toISOString();
    const panels = getDefaultProfilePanels();

    const { error: settingsError } = await supabase.from("profile_customizer_settings").upsert(
      {
        guild_id: guildId,
        enabled: DEFAULT_PROFILE_CUSTOMIZER_SETTINGS.enabled,
        show_after_verification: DEFAULT_PROFILE_CUSTOMIZER_SETTINGS.showAfterVerification,
        require_before_access: DEFAULT_PROFILE_CUSTOMIZER_SETTINGS.requireBeforeAccess,
        allow_user_reset: DEFAULT_PROFILE_CUSTOMIZER_SETTINGS.allowUserReset,
        audit_changes: DEFAULT_PROFILE_CUSTOMIZER_SETTINGS.auditChanges,
        updated_at: now,
      },
      { onConflict: "guild_id" }
    );

    if (settingsError) throw new Error(settingsError.message);

    const { data: panelRows, error: panelError } = await supabase
      .from("profile_role_panels")
      .upsert(panels.map((panel) => panelRow(guildId, panel, now)), {
        onConflict: "guild_id,panel_key",
      })
      .select("id,panel_key");

    if (panelError) throw new Error(panelError.message);

    const panelIds = new Map<string, string>();
    for (const row of panelRows || []) {
      const key = clean((row as { panel_key?: string }).panel_key);
      const id = clean((row as { id?: string }).id);
      if (key && id) panelIds.set(key, id);
    }

    const optionRows = panels.flatMap((panel) => {
      const panelId = panelIds.get(panel.panelKey);
      if (!panelId) return [];
      return panel.options.map((option) => optionRow({ guildId, panelId, panel, option, now }));
    });

    if (optionRows.length) {
      const { error: optionError } = await supabase
        .from("profile_role_options")
        .upsert(optionRows, { onConflict: "panel_id,option_key" });

      if (optionError) throw new Error(optionError.message);
    }

    await writeAuditEvent(supabase, {
      guildId,
      actorId: actorId(session),
      actorName: actorName(session),
      panels: panels.length,
      options: optionRows.length,
    });

    const state = await loadProfileCustomizerState(supabase, guildId);

    return dashboardAuthJson(
      {
        ok: true,
        selectedGuildId: guildId,
        seededPanels: panels.length,
        seededOptions: optionRows.length,
        ...state,
      },
      200,
      session
    );
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}
