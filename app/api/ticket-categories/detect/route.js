import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      suggestions: [],
      recommended: [],
      ignored: [],
      message: "No clear ticket categories were detected. Use the starter set or create categories manually."
    },
    { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
