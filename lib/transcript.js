import { formatDateTime } from "@/lib/format"

export function buildTranscriptMarkdown(ticket, messages = [], notes = []) {
  const lines = []
  lines.push("# Ticket Transcript")
  lines.push("")
  lines.push(`- Ticket ID: ${ticket.id}`)
  lines.push(`- User: ${ticket.username || ticket.user_id}`)
  lines.push(`- Category: ${ticket.category}`)
  lines.push(`- Status: ${ticket.status}`)
  lines.push(`- Priority: ${ticket.priority}`)
  lines.push(`- Claimed By: ${ticket.claimed_by || "—"}`)
  lines.push(`- Created: ${formatDateTime(ticket.created_at)}`)
  lines.push("")
  lines.push("## Conversation")
  lines.push("")

  for (const msg of messages) {
    lines.push(`### ${msg.author_name || msg.author_id} — ${formatDateTime(msg.created_at)}`)
    lines.push("")
    lines.push(msg.content || "")
    lines.push("")
  }

  lines.push("## Internal Notes")
  lines.push("")
  if (!notes.length) {
    lines.push("_No internal notes_")
  } else {
    for (const note of notes) {
      lines.push(`- ${note.staff_name || note.staff_id} — ${formatDateTime(note.created_at)}`)
      lines.push(`  - ${note.content}`)
    }
  }

  lines.push("")
  return lines.join("\n")
}
