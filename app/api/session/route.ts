import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const sess = await getSession();
  if (!sess) return NextResponse.json(null, { status: 401 });
  return NextResponse.json(sess);
}
