import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  clearSession();
  return NextResponse.redirect(new URL("/login", url.origin));
}
