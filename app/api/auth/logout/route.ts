// app/api/auth/logout/route.ts

import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function GET(req: Request) {
  clearSession();

  const url = new URL(req.url);
  return NextResponse.redirect(new URL("/", url.origin));
}
