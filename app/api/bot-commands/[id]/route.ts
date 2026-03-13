import { NextRequest, NextResponse } from "next/server";
import { getBotCommand } from "@/lib/botCommands";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const commandId = typeof id === "string" ? id.trim() : "";

    if (!commandId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing command id",
        },
        { status: 400 }
      );
    }

    const command = await getBotCommand(commandId);

    if (!command) {
      return NextResponse.json(
        {
          ok: false,
          error: "Command not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      command,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}
