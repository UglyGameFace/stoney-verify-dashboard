import { NextRequest, NextResponse } from "next/server";
import { getBotCommand } from "@/lib/botCommands";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const commandId =
      typeof context?.params?.id === "string"
        ? context.params.id.trim()
        : "";

    if (!commandId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing command id",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const command = await getBotCommand(commandId);

    if (!command) {
      return NextResponse.json(
        {
          ok: false,
          error: "Command not found",
        },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        command,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}
