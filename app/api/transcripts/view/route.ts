// app/api/transcripts/view/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Transcript viewer
 * - If caller passes a direct URL, we return it (browser opens).
 * - If you later add a bot endpoint that returns transcript HTML, you can wire it here.
 *
 * This route is intentionally safe: it won't fetch private Discord messages from here.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const url = String(body?.url || "").trim();

  if (url) {
    return NextResponse.json({ url });
  }

  // No URL stored. Return a friendly response.
  return NextResponse.json({
    html: "<p class='sb-muted'>No transcript URL/HTML stored for this ticket yet. If you want, we can add a bot endpoint to return the latest HTML transcript for a channel.</p>",
  });
}
