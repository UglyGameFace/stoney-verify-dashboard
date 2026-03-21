import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth-server";
import { env } from "@/lib/env";

const ALLOWED_INTAKE_TYPES = new Set([
  "general",
  "verification",
  "appeal",
  "report",
  "partnership",
  "question",
  "custom",
]);

const FALLBACK_CATEGORIES = [
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

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeSlug(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeTextBlock(value, maxLength = 2000) {
  return normalizeString(value).replace(/\s+/g, " ").slice(0, maxLength);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function deriveViewerFromSession(session) {
  const discordId = normalizeString(
    session?.user?.discord_id ||
      session?.user?.id ||
      session?.discordUser?.id
  );

  const username = normalizeString(
    session?.user?.username ||
      session?.discordUser?.username ||
      session?.user?.global_name ||
      session?.user?.name ||
      "Member"
  );

  return {
    discordId,
    username,
    isStaff: Boolean(session?.isStaff),
  };
}

async function getConfiguredCategories(supabase, guildId) {
  const { data, error } = await supabase
    .from("ticket_categories")
    .select("*")
    .eq("guild_id", guildId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = safeArray(data);
  return rows.length ? rows : FALLBACK_CATEGORIES;
}

function pickCategory(categories, body) {
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

async function findExistingOpenTicket(supabase, guildId, userId) {
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

  return data || null;
}

async function findExistingPendingCommand(supabase, guildId, userId) {
  const { data, error } = await supabase
    .from("bot_commands")
    .select("*")
    .eq("guild_id", guildId)
    .eq("action", "create_ticket")
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(error.message);
  }

  const rows = safeArray(data);
  return (
    rows.find((row) => {
      const payload = row?.payload || {};
      return normalizeString(payload?.user_id || payload?.owner_id) === userId;
    }) || null
  );
}

function buildInitialMessage(body, category, viewer) {
  const requestedCategory = normalizeString(
    category?.name || category?.slug || "Support"
  );
  const details = normalizeTextBlock(
    body?.message || body?.details || body?.initial_message
  );

  const parts = [
    `Ticket requested by ${viewer.username} (${viewer.discordId}).`,
    `Requested category: ${requestedCategory}.`,
  ];

  if (details) {
    parts.push(`Member message: ${details}`);
  }

  return parts.join(" ");
}

function buildCommandPayload({ guildId, viewer, category, initialMessage }) {
  const categoryName = normalizeString(category?.name || "Support");
  const categorySlug = normalizeString(category?.slug || "general");
  const intakeType = normalizeString(category?.intake_type || "general");

  return {
    guild_id: guildId,
    user_id: viewer.discordId,
    owner_id: viewer.discordId,
    requester_id: viewer.discordId,
    username: viewer.username,
    owner_username: viewer.username,
    owner_display_name: viewer.username,
    category: categorySlug,
    category_name: categoryName,
    category_slug: categorySlug,
    intake_type: intakeType,
    title: `${categoryName} - ${viewer.username}`.slice(0, 120),
    initial_message: initialMessage,
    source: "dashboard",
    create_from: "user_dashboard",
    matched_category_name: categoryName,
    matched_category_slug: categorySlug,
    matched_intake_type: intakeType,
    category_id: category?.id || null,
  };
}

export async function POST(request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const viewer = deriveViewerFromSession(session);

    if (!viewer.discordId) {
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

    const body = await request.json().catch(() => ({}));
    const supabase = createServerSupabase();

    const existingOpenTicket = await findExistingOpenTicket(
      supabase,
      guildId,
      viewer.discordId
    );

    if (existingOpenTicket) {
      return NextResponse.json(
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
        { status: 409 }
      );
    }

    const existingPendingCommand = await findExistingPendingCommand(
      supabase,
      guildId,
      viewer.discordId
    );

    if (existingPendingCommand) {
      return NextResponse.json(
        {
          ok: false,
          error: "A ticket request is already being processed.",
          existing_command: {
            id: existingPendingCommand.id,
            status: existingPendingCommand.status,
            created_at: existingPendingCommand.created_at,
          },
        },
        { status: 409 }
      );
    }

    const categories = await getConfiguredCategories(supabase, guildId);
    const category = pickCategory(categories, body);
    const initialMessage = buildInitialMessage(body, category, viewer);
    const payload = buildCommandPayload({
      guildId,
      viewer,
      category,
      initialMessage,
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
      return NextResponse.json(
        { ok: false, error: commandError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      queued: true,
      command: {
        id: commandRow.id,
        status: commandRow.status,
        created_at: commandRow.created_at,
      },
      requested_category: {
        id: category?.id || null,
        name: normalizeString(category?.name),
        slug: normalizeString(category?.slug),
        intake_type: normalizeString(category?.intake_type || "general"),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to queue ticket creation.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 }
    );
  }
}
