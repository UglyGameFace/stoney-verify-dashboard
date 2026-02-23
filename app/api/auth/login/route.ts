import { NextResponse } from "next/server";
import { discordAuthUrl } from "@/lib/discord";
import crypto from "crypto";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/dashboard";
  const state = crypto.randomBytes(16).toString("hex") + ":" + Buffer.from(next).toString("base64url");
  return NextResponse.redirect(discordAuthUrl(state));
}
