export function derivePriority(ticket) {
  const created = new Date(ticket.created_at || Date.now()).getTime()
  const minutesWaiting = Math.floor((Date.now() - created) / 60000)
  let score = 0

  if (minutesWaiting >= 45) score += 4
  else if (minutesWaiting >= 20) score += 3
  else if (minutesWaiting >= 10) score += 2
  else score += 1

  if (ticket.category === "appeal") score += 1
  if (ticket.category === "verification_issue") score += 1
  if (ticket.category === "verification_fraud") score += 2
  if (ticket.flagged) score += 2
  if (ticket.status === "open") score += 1

  if (score >= 7) return "high"
  if (score >= 4) return "medium"
  return "low"
}

const rank = { high: 3, medium: 2, low: 1 }

export function sortTickets(tickets = [], sortBy = "priority_desc") {
  const rows = [...tickets]
  if (sortBy === "updated_desc") return rows.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
  if (sortBy === "updated_asc") return rows.sort((a, b) => new Date(a.updated_at || a.created_at) - new Date(b.updated_at || b.created_at))
  if (sortBy === "created_desc") return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  if (sortBy === "created_asc") return rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  return rows.sort((a, b) => {
    const pa = a.priority || derivePriority(a)
    const pb = b.priority || derivePriority(b)
    const delta = (rank[pb] || 0) - (rank[pa] || 0)
    if (delta !== 0) return delta
    return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
  })
}
