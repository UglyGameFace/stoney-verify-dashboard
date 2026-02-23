// app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, session: null }, { status: 401 });
  return NextResponse.json({ ok: true, session });
}
