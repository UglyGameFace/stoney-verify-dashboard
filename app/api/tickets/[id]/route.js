import { createServerSupabase } from "@/lib/supabase-server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  const clean = normalizeString(value).toLowerCase();
  return clean === "true" || clean === "1" || clean === "yes" || clean === "on";
}

function buildCategoryPatch(body) {
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

export async function GET(request, { params }) {
  try {
    const supabase = createServerSupabase();

    const [{ data: ticket, error }, { data: messages }, { data: notes }] =
      await Promise.all([
        supabase.from("tickets").select("*").eq("id", params.id).single(),
        supabase
          .from("ticket_messages")
          .select("*")
          .eq("ticket_id", params.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("ticket_notes")
          .select("*")
          .eq("ticket_id", params.id)
          .order("created_at", { ascending: false }),
      ]);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
    }

    return new Response(
      JSON.stringify({
        ticket,
        messages: messages || [],
        notes: notes || [],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Failed to load ticket." }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const supabase = createServerSupabase();
    const body = await request.json();
    const ticketId = params?.id;
    const guildId = env.guildId || "";

    if (!ticketId) {
      return new Response(JSON.stringify({ error: "Missing ticket id." }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
    }

    const action = normalizeString(body?.action || "update-category").toLowerCase();

    if (action !== "update-category") {
      return new Response(JSON.stringify({ error: "Unsupported patch action." }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
    }

    const patch = buildCategoryPatch({
      ...body,
      category_set_by:
        body?.category_set_by ||
        session?.user?.id ||
        session?.user?.user_id ||
        session?.user?.discord_id ||
        session?.discordUser?.id ||
        "",
    });

    let categoryRow = null;

    if (patch.category_id) {
      const { data, error } = await supabase
        .from("ticket_categories")
        .select("*")
        .eq("id", patch.category_id)
        .eq("guild_id", guildId)
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          },
        });
      }

      categoryRow = data || null;
    } else if (patch.category) {
      const { data } = await supabase
        .from("ticket_categories")
        .select("*")
        .eq("guild_id", guildId)
        .or(`slug.eq.${patch.category},name.eq.${patch.category}`)
        .limit(1);

      categoryRow = Array.isArray(data) && data.length ? data[0] : null;
    }

    const updatePayload = {
      updated_at: new Date().toISOString(),
      category_override: patch.category_override,
      category_set_by: patch.category_set_by,
      category_set_at: patch.category_set_at,
      category_id: categoryRow?.id || patch.category_id || null,
      category:
        categoryRow?.slug ||
        categoryRow?.name ||
        patch.category ||
        null,
      matched_category_id: categoryRow?.id || null,
      matched_category_name: categoryRow?.name || null,
      matched_category_slug: categoryRow?.slug || null,
      matched_intake_type: categoryRow?.intake_type || null,
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
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
    }

    const response = new Response(JSON.stringify({ ok: true, ticket }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });

    applyAuthCookies(response, refreshedTokens);
    return response;
  } catch (error) {
    const message = error?.message || "Unauthorized";
    const status = message === "Unauthorized" ? 401 : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  }
}
