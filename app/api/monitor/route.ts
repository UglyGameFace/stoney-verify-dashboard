// app/api/monitor/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs"; 
export const dynamic = "force-dynamic";

/**
 * Stoney Verify
 * Real-Time Monitor (SSE)
 * Compatible with Next.js 14 App Router + Vercel
 */

function createEventStream() {
  const encoder = new TextEncoder();

  let interval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({
          type: "connected",
          message: "Live monitor connected.",
          timestamp: new Date().toISOString(),
        })}\n\n`)
      );

      // Heartbeat every 20 seconds
      interval = setInterval(() => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: "heartbeat",
            timestamp: new Date().toISOString(),
          })}\n\n`)
        );
      }, 20000);
    },

    cancel() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
  });

  return stream;
}

export async function GET(req: NextRequest) {
  const stream = createEventStream();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
