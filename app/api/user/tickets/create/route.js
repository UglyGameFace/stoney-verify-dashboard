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

function normalizeTextBlock(value) {
  return normalizeString(value).replace(/\s+/g, " ").slice(0, 2000);
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

function buildTicketTitle(category, username) {
  const categoryName = normalizeString(category?.name || "Support");
  const userName = normalizeString(username || "Member");
  return `${categoryName} - ${userName}`.slice(0, 120);
}

function buildInitialMessage(body, category, viewer) {
  const requestedCategory = normalizeString(category?.name || category?.slug || "Support");
  const details = normalizeTextBlock(body?.message || body?.details || body?.initial_message);

  const lines = [
    `Ticket requested by ${viewer.username} (${viewer.discordId}).`,
    `Requested category: ${requestedCategory}.`,
  ];

  if (details) {
    lines.push(`Member message: ${details}`);
  }

  return lines.join(" ");
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
  const requestedSlug = normalizeSlug(body?.category_slug || body?.slug || body?.category);
  const requestedIntakeType = normalizeSlug(body?.intake_type);

  let category =
    categories.find((item) => normalizeSlug(item?.slug) === requestedSlug) ||
    categories.find((item) => normalizeSlug(item?.intake_type) === requestedIntakeType) ||
    categories.find((item) => item?.is_default) ||
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

    const categories = await getConfiguredCategories(supabase, guildId);
    const category = pickCategory(categories, body);

    const title = buildTicketTitle(category, viewer.username);
    const initialMessage = buildInitialMessage(body, category, viewer);

    const payload = {
      guild_id: guildId,
      user_id: viewer.discordId,
      username: viewer.username,
      title,
      category: normalizeString(category?.slug || category?.name || "general"),
      status: "open",
      priority: normalizeString(body?.priority || "medium").toLowerCase() || "medium",
      initial_message: initialMessage,
      source: "dashboard",
      category_id: category?.id || null,
      matched_category_id: category?.id || null,
      matched_category_name: normalizeString(category?.name),
      matched_category_slug: normalizeString(category?.slug),
      matched_intake_type: normalizeString(category?.intake_type || "general"),
      matched_category_reason: "user-dashboard-create",
      matched_category_score: 100,
      category_override: true,
      category_set_by: viewer.discordId,
      category_set_at: new Date().toISOString(),
    };

    const { data: insertedTicket, error: insertError } = await supabase
      .from("tickets")
      .insert(payload)
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      ticket: {
        id: insertedTicket.id,
        title: insertedTicket.title,
        status: insertedTicket.status,
        category: insertedTicket.category,
        matched_category_name: insertedTicket.matched_category_name,
        matched_category_slug: insertedTicket.matched_category_slug,
        matched_intake_type: insertedTicket.matched_intake_type,
        priority: insertedTicket.priority,
        created_at: insertedTicket.created_at,
        updated_at: insertedTicket.updated_at,
        channel_id: insertedTicket.channel_id,
        channel_name: insertedTicket.channel_name,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create ticket.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 }
    );
  }
}
