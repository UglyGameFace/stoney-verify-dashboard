export type BotApiResult<T = unknown> = {
  ok: boolean
  error?: string
  [key: string]: T | boolean | string | undefined
}

const BOT_API_BASE =
  process.env.BOT_API_BASE_URL ||
  process.env.NEXT_PUBLIC_BOT_API_BASE_URL ||
  ""

const BOT_API_SECRET =
  process.env.BOT_API_SECRET ||
  process.env.NEXT_PUBLIC_BOT_API_SECRET ||
  ""

function requireBaseUrl(): string {
  const base = BOT_API_BASE.trim()
  if (!base) {
    throw new Error("Missing BOT_API_BASE_URL / NEXT_PUBLIC_BOT_API_BASE_URL")
  }
  return base.replace(/\/+$/, "")
}

function buildHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }

  if (BOT_API_SECRET.trim()) {
    headers["x-bot-secret"] = BOT_API_SECRET.trim()
  }

  return headers
}

async function postJson<T = unknown>(
  path: string,
  body: Record<string, unknown>
): Promise<BotApiResult<T>> {
  const base = requireBaseUrl()

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  })

  let data: BotApiResult<T>
  try {
    data = (await res.json()) as BotApiResult<T>
  } catch {
    data = {
      ok: false,
      error: `Bot API returned non-JSON response (${res.status})`,
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      error: data?.error || `Bot API error (${res.status})`,
      ...data,
    }
  }

  return data
}

async function getJson<T = unknown>(path: string): Promise<BotApiResult<T>> {
  const base = requireBaseUrl()

  const res = await fetch(`${base}${path}`, {
    method: "GET",
    headers: buildHeaders(),
    cache: "no-store",
  })

  let data: BotApiResult<T>
  try {
    data = (await res.json()) as BotApiResult<T>
  } catch {
    data = {
      ok: false,
      error: `Bot API returned non-JSON response (${res.status})`,
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      error: data?.error || `Bot API error (${res.status})`,
      ...data,
    }
  }

  return data
}

export async function botHealth() {
  return getJson<{ status: string }>("/health")
}

export async function botCreateTicket(input: {
  guildId: string
  userId: string
  category?: string
  ghost?: boolean
  openingMessage?: string
  priority?: string
  parentCategoryId?: string
  staffRoleIds?: string[]
  allowDuplicate?: boolean
}) {
  return postJson<{
    created?: boolean
    duplicate?: boolean
    existing_ticket?: unknown
    ticket?: {
      channel_id: string
      channel_name: string
      guild_id: string
      mention: string
      category_id?: string | null
      category_name?: string | null
    }
  }>("/ticket/create", {
    guild_id: input.guildId,
    user_id: input.userId,
    category: input.category ?? "support",
    ghost: Boolean(input.ghost),
    opening_message: input.openingMessage ?? null,
    priority: input.priority ?? "medium",
    parent_category_id: input.parentCategoryId ?? null,
    staff_role_ids: input.staffRoleIds ?? null,
    allow_duplicate: Boolean(input.allowDuplicate),
  })
}

export async function botCloseTicket(input: {
  channelId: string
  staffId?: string
  reason?: string
}) {
  return postJson("/ticket/close", {
    channel_id: input.channelId,
    staff_id: input.staffId ?? null,
    reason: input.reason ?? null,
  })
}

export async function botDeleteTicket(input: {
  channelId: string
  ghost?: boolean
  forceTranscript?: boolean
  staffId?: string
  reason?: string
}) {
  return postJson<{
    deleted?: boolean
    transcript_posted?: boolean
    transcript_url?: string | null
    transcript_message_id?: string | null
    transcript_channel_id?: string | null
  }>("/ticket/delete", {
    channel_id: input.channelId,
    ghost: Boolean(input.ghost),
    force_transcript: Boolean(input.forceTranscript),
    staff_id: input.staffId ?? null,
    reason: input.reason ?? "Deleted from dashboard",
  })
}

export async function botReopenTicket(input: {
  channelId: string
}) {
  return postJson("/ticket/reopen", {
    channel_id: input.channelId,
  })
}

export async function botAssignTicket(input: {
  channelId: string
  staffId: string
}) {
  return postJson("/ticket/assign", {
    channel_id: input.channelId,
    staff_id: input.staffId,
  })
}

export async function botSyncMembers(input: {
  guildId: string
}) {
  return postJson<{
    summary?: {
      processed: number
      failed: number
      total_seen: number
    }
  }>("/members/sync", {
    guild_id: input.guildId,
  })
}

export async function botReconcileDepartedMembers(input: {
  guildId: string
}) {
  return postJson<{
    summary?: {
      checked: number
      marked_departed: number
    }
  }>("/members/reconcile", {
    guild_id: input.guildId,
  })
}

export async function botRoleMemberSync(input: {
  guildId: string
  roleId: string
}) {
  return postJson<{
    summary?: {
      role_id: number
      role_name: string
      processed: number
      failed: number
    }
  }>("/members/role-sync", {
    guild_id: input.guildId,
    role_id: input.roleId,
  })
}
