import { classifyTicket, spamScoreMessage, suggestModerationAction } from "@/lib/moderation"

export async function POST(request) {
  const body = await request.json()
  const text = body.text || ""
  return Response.json({
    classification: classifyTicket(text),
    spam: spamScoreMessage(text),
    suggestion: suggestModerationAction(text)
  })
}
