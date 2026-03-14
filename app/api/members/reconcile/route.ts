import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RequestBody = {
  requestedBy?: string | null;
  staffId?: string | null;
};

export async function POST(req: Request) {
  try {
    const body: RequestBody = await req.json().catch(() => ({}));

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const guildId = process.env.DISCORD_GUILD_ID;

    if (!guildId) {
      return NextResponse.json(
        { error: "DISCORD_GUILD_ID not configured" },
        { status: 500 }
      );
    }

    const requestedBy = body?.requestedBy ?? body?.staffId ?? null;

    // queue command for bot worker
    const { data: command, error: commandError } = await supabase
      .from("bot_commands")
      .insert({
        guild_id: guildId,
        action: "reconcile_departed_members",
        payload: {},
        requested_by: requestedBy,
        status: "pending",
      })
      .select()
      .single();

    if (commandError) {
      console.error("Reconcile queue error:", commandError);

      return NextResponse.json(
        { error: commandError.message },
        { status: 500 }
      );
    }

    // audit log
    try {
      await supabase.from("audit_logs").insert({
        action: "members_reconcile_requested",
        staff_id: requestedBy,
        meta: {
          command_id: command?.id ?? null,
        },
      });
    } catch (auditErr) {
      console.warn("Audit log failed", auditErr);
    }

    return NextResponse.json({
      ok: true,
      queued: true,
      command,
    });
  } catch (err: any) {
    console.error("Reconcile route error:", err);

    return NextResponse.json(
      {
        error: err?.message ?? "Failed to queue reconcile command",
      },
      { status: 500 }
    );
  }
}
