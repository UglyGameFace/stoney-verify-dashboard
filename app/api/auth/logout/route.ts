// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const res = NextResponse.redirect(new URL("/", url.origin));
  clearSessionCookie(res);
  return res;
}
