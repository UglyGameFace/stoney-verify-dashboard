import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { createServerSupabase } from "@/lib/supabase-server";
import { queueCreateTicket } from "@/lib/botCommands";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeText(value) {
  return String(value ?? "").trim();
}

export async function POST(req) {
  try {
    const session = await getSession();

    const userId = safeText(session?.user?.id);
    const username =
      safeText(session?.user?.username) ||
      safeText(session?.user?.global_name) ||
      "Member";

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const category = safeText(body?.category || "support") || "support";
    const priority = safeText(body?.priority || "medium") || "medium";
    const openingMessage =
      safeText(body?.openingMessage) ||
      `Ticket created from member portal by ${username}`;

    const supabase = createServerSupabase();

    const { data: existingOpen, error: existingError } = await supabase
      .from("tickets")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["open", "claimed"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existingOpen) {
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        queued: false,
        ticket: existingOpen,
      });
    }

    const command = await queueCreateTicket({
      userId,
      category,
      priority,
      openingMessage,
      ghost: false,
      allowDuplicate: false,
      requestedBy: userId,
    });

    try {
      await supabase.from("audit_logs").insert({
        action: "member_portal_ticket_create_requested",
        staff_id: null,
        meta: {
          user_id: userId,
          username,
          category,
          priority,
          command_id: command?.id || null,
        },
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json({
      ok: true,
      queued: true,
      command,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}
