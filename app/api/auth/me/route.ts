import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized", session: null },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    userId: session.userId,
    id: session.userId,
    username: session.username,
    roles: session.roles ?? [],
    avatar: session.avatar ?? null,
    guildId: session.guildId ?? null,
    session,
  });
}
