const { Client, GatewayIntentBits, Partials, ChannelType } = require("discord.js")
const { createClient } = require("@supabase/supabase-js")

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE",
  "DISCORD_TOKEN",
  "GUILD_ID",
  "TICKET_CATEGORY_ID"
]

const missing = required.filter((key) => !process.env[key])

if (missing.length) {
  console.error("Missing required environment variables for bot:")
  for (const key of missing) console.error(`- ${key}`)
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

const GUILD_ID = process.env.GUILD_ID
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID
const AUTO_SYNC_ENABLED = String(process.env.BOT_AUTO_SYNC_ENABLED || "true") === "true"
const AUTO_SYNC_INTERVAL_MINUTES = Number(process.env.BOT_AUTO_SYNC_INTERVAL_MINUTES || 30)
const AUTO_SYNC_BATCH_LIMIT = Math.min(Math.max(Number(process.env.BOT_AUTO_SYNC_BATCH_LIMIT || 500), 100), 1000)
const TICKET_PANEL_CHANNEL_IDS = (process.env.TICKET_PANEL_CHANNEL_IDS || "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean)

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
})

const recentMessages = new Map()
const recentJoins = []

function classifyTicket(text = "") {
  const source = text.toLowerCase()
  const rules = {
    verification_issue: ["verify", "verification", "wallet", "cant verify", "can't verify", "role not showing"],
    appeal: ["appeal", "timeout", "mute", "warn", "ban appeal"],
    bug_report: ["bug", "glitch", "broken", "not working", "error"],
    payment_issue: ["payment", "refund", "chargeback", "purchase"],
    server_help: ["help", "how do i", "where is", "support", "question"]
  }

  let best = "other"
  let bestScore = 0

  for (const [category, terms] of Object.entries(rules)) {
    let score = 0
    for (const term of terms) {
      if (source.includes(term)) score += 1
    }
    if (score > bestScore) {
      best = category
      bestScore = score
    }
  }

  return {
    category: best,
    confidence: Math.min(0.55 + bestScore * 0.11, 0.96)
  }
}

function spamScoreMessage(text = "") {
  const clean = text.trim()
  let score = 0
  const reasons = []
  const words = clean.split(/\s+/).filter(Boolean)
  const unique = new Set(words.map((w) => w.toLowerCase()))

  if (clean.length > 850) {
    score += 2
    reasons.push("very_long_message")
  }

  if (words.length > 12 && unique.size / words.length < 0.4) {
    score += 3
    reasons.push("word_repetition")
  }

  if (/free nitro|steam gift|@everyone|@here/i.test(clean)) {
    score += 3
    reasons.push("spam_pattern")
  }

  if (/(https?:\/\/\S+)/i.test(clean)) {
    score += 3
    reasons.push("link_pattern")
  }

  return { score, reasons, spam: score >= 5 }
}

function fraudScoreVerification(input = {}) {
  let score = 0
  const reasons = []

  if ((input.accountAgeDays || 999) < 3) {
    score += 4
    reasons.push("account_under_3_days")
  }

  if ((input.failedAttempts || 0) >= 2) {
    score += 4
    reasons.push("multiple_failed_attempts")
  }

  if (/^[a-z]+\d{4,}$/i.test(input.username || "")) {
    score += 2
    reasons.push("bot_like_name_pattern")
  }

  return { score, reasons, flagged: score >= 6 }
}

async function audit(title, description, eventType, relatedId = null) {
  await supabase.from("audit_events").insert({
    title,
    description,
    event_type: eventType,
    related_id: relatedId
  })
}

async function fetchRoleRules(guildId) {
  const { data, error } = await supabase
    .from("guild_role_rules")
    .select("*")
    .eq("guild_id", guildId)
    .eq("active", true)

  if (error) {
    console.error("Failed to fetch guild_role_rules:", error.message)
    return []
  }

  return data || []
}

function buildRoleState(roleIds, roleNames, roleRules, inGuild = true) {
  const lowerNames = roleNames.map((x) => String(x || "").toLowerCase())
  const rulesById = new Map(roleRules.map((rule) => [rule.role_id, rule.role_group]))

  const hasGroup = (group) => roleIds.some((id) => rulesById.get(id) === group)
  const hasName = (pattern) => lowerNames.some((name) => pattern.test(name))

  const hasUnverified = hasGroup("unverified") || hasName(/\bunverified\b/)
  const hasVerifiedRole =
    hasGroup("verified") ||
    hasGroup("secondary_verified") ||
    lowerNames.some((name) => /\bverified\b/.test(name) && !/\bunverified\b/.test(name))
  const hasSecondaryVerifiedRole =
    hasGroup("secondary_verified") ||
    hasName(/\bsecondary verified\b|\bfully verified\b|\btrusted\b/)
  const hasStaffRole =
    hasGroup("staff") ||
    hasGroup("admin") ||
    hasName(/\bstaff\b|\bmod\b|\bmoderator\b|\badmin\b|\bowner\b/)
  const hasCosmeticOnly =
    !hasUnverified &&
    !hasVerifiedRole &&
    !hasStaffRole &&
    (hasGroup("cosmetic") || roleNames.length > 0)

  let roleState = "unknown"
  let roleStateReason = "No matching role rules."

  if (!inGuild) {
    roleState = "left_guild"
    roleStateReason = "Member is no longer in the guild."
  } else if (hasStaffRole && hasUnverified) {
    roleState = "staff_conflict"
    roleStateReason = "Member has both staff and unverified roles."
  } else if (hasVerifiedRole && hasUnverified) {
    roleState = "verified_conflict"
    roleStateReason = "Member has both verified and unverified roles."
  } else if (hasStaffRole) {
    roleState = "staff_ok"
    roleStateReason = "Member has staff roles."
  } else if (hasVerifiedRole) {
    roleState = "verified_ok"
    roleStateReason = "Member has a verified role."
  } else if (hasUnverified) {
    roleState = "unverified_only"
    roleStateReason = "Member has only unverified access."
  } else if (hasCosmeticOnly) {
    roleState = "booster_only"
    roleStateReason = "Member has cosmetic-only roles."
  }

  const dataHealth = inGuild ? "ok" : "left_guild"

  return {
    hasUnverified,
    hasVerifiedRole,
    hasStaffRole,
    hasSecondaryVerifiedRole,
    hasCosmeticOnly,
    hasAnyRole: roleIds.length > 0,
    roleState,
    roleStateReason,
    dataHealth
  }
}

function buildMemberSyncRow(member, roleRules, inGuild = true) {
  const sortedRoles = [...member.roles.cache.values()]
    .filter((role) => role.name !== "@everyone")
    .sort((a, b) => b.position - a.position)

  const roleIds = sortedRoles.map((role) => role.id)
  const roleNames = sortedRoles.map((role) => role.name)
  const topRole = roleNames[0] || null
  const topRoleId = roleIds[0] || null
  const displayName = member.user.globalName || member.displayName || member.user.username

  const state = buildRoleState(roleIds, roleNames, roleRules, inGuild)

  return {
    guild_id: member.guild.id,
    user_id: member.user.id,
    username: member.user.username,
    display_name: displayName,
    nickname: member.nickname,
    avatar_hash: member.user.avatar,
    avatar_url: member.user.displayAvatarURL(),
    role_ids: roleIds,
    role_names: roleNames,
    highest_role_id: topRoleId,
    highest_role_name: topRole,
    in_guild: inGuild,
    has_any_role: state.hasAnyRole,
    data_health: state.dataHealth,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    has_unverified: state.hasUnverified,
    has_verified_role: state.hasVerifiedRole,
    has_staff_role: state.hasStaffRole,
    has_secondary_verified_role: state.hasSecondaryVerifiedRole,
    has_cosmetic_only: state.hasCosmeticOnly,
    role_state: state.roleState,
    role_state_reason: state.roleStateReason,
    roles: roleNames,
    top_role: topRole,
    joined_at: member.joinedAt ? member.joinedAt.toISOString() : new Date().toISOString()
  }
}

async function fullAutoSync() {
  try {
    const guild = await client.guilds.fetch(GUILD_ID)
    const fetchedRoles = await guild.roles.fetch()
    const roleRules = await fetchRoleRules(guild.id)

    const roles = [...fetchedRoles.values()]
      .filter((role) => role.name !== "@everyone")
      .sort((a, b) => b.position - a.position)

    let after = "0"
    let totalMembers = 0
    const roleCounts = new Map()

    while (true) {
      const batch = await guild.members.list({ limit: AUTO_SYNC_BATCH_LIMIT, after })
      const members = [...batch.values()]
      if (!members.length) break

      const rows = members.map((member) => {
        for (const role of member.roles.cache.values()) {
          if (role.id !== guild.id) {
            roleCounts.set(role.id, (roleCounts.get(role.id) || 0) + 1)
          }
        }

        return buildMemberSyncRow(member, roleRules, true)
      })

      const { error } = await supabase
        .from("guild_members")
        .upsert(rows, { onConflict: "guild_id,user_id" })

      if (error) throw new Error(error.message)

      totalMembers += rows.length
      after = members[members.length - 1].user.id
      if (members.length < AUTO_SYNC_BATCH_LIMIT) break
    }

    const roleRows = roles.map((role) => ({
      guild_id: guild.id,
      role_id: role.id,
      name: role.name,
      position: role.position,
      member_count: roleCounts.get(role.id) || 0
    }))

    const { error: roleError } = await supabase
      .from("guild_roles")
      .upsert(roleRows, { onConflict: "guild_id,role_id" })

    if (roleError) throw new Error(roleError.message)

    await audit(
      "Bot auto-sync completed",
      `Synced ${roles.length} roles and ${totalMembers} members`,
      "bot_auto_sync"
    )

    console.log(`Auto-sync complete: ${roles.length} roles, ${totalMembers} members`)
  } catch (error) {
    console.error("Auto-sync failed:", error.message || error)
    await audit("Bot auto-sync failed", String(error.message || error), "bot_auto_sync_failed")
  }
}

async function getTicketCategoryChannel(guild) {
  try {
    const channel = await guild.channels.fetch(TICKET_CATEGORY_ID)
    if (!channel) return null
    if (channel.type !== ChannelType.GuildCategory) {
      console.warn("Configured TICKET_CATEGORY_ID is not a category channel.")
      return null
    }
    return channel
  } catch (error) {
    console.error("Failed to fetch configured ticket category:", error.message || error)
    return null
  }
}

async function getNextTicketNumber(guild) {
  const channels = await guild.channels.fetch()
  let highest = 0

  for (const [, channel] of channels) {
    if (!channel) continue
    if (channel.parentId !== TICKET_CATEGORY_ID) continue
    if (channel.type !== ChannelType.GuildText) continue

    const match = String(channel.name || "").match(/^ticket-(\d{4,})$/i)
    if (!match) continue

    const value = Number(match[1])
    if (Number.isFinite(value) && value > highest) {
      highest = value
    }
  }

  return highest + 1
}

function formatTicketChannelName(number) {
  return `ticket-${String(number).padStart(4, "0")}`
}

function inferCategoryFromChannel(channel) {
  const source = `${channel.name || ""} ${channel.topic || ""}`.toLowerCase()

  if (/verify|verification|wallet/.test(source)) return "verification_issue"
  if (/appeal|ban|mute|timeout|warn/.test(source)) return "appeal"
  if (/bug|glitch|broken|error/.test(source)) return "bug_report"
  if (/payment|refund|chargeback|purchase/.test(source)) return "payment_issue"
  if (/help|support|question/.test(source)) return "server_help"

  return "other"
}

function inferPriorityFromChannel(channel) {
  const source = `${channel.name || ""} ${channel.topic || ""}`.toLowerCase()

  if (/urgent|critical|fraud|scam/.test(source)) return "high"
  if (/verify|appeal|payment/.test(source)) return "medium"

  return "low"
}

async function findExistingTicketByDiscordChannelId(channelId) {
  const { data, error } = await supabase
    .from("tickets")
    .select("id, discord_thread_id")
    .eq("discord_thread_id", channelId)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Failed looking up existing ticket by discord channel id:", error.message)
    return null
  }

  return data || null
}

async function ingestExistingDiscordTicketChannel(channel) {
  try {
    if (!channel) return null
    if (channel.guild?.id !== GUILD_ID) return null
    if (channel.type !== ChannelType.GuildText) return null
    if (channel.parentId !== TICKET_CATEGORY_ID) return null

    const existing = await findExistingTicketByDiscordChannelId(channel.id)
    if (existing) {
      return existing
    }

    let starterMessage = ""
    let inferredUserId = null
    let inferredUsername = null

    try {
      const messages = await channel.messages.fetch({ limit: 10 })
      const ordered = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp)

      for (const msg of ordered) {
        const content = String(msg.content || "").trim()
        if (!starterMessage && content) {
          starterMessage = content
        }

        const nonBotMention = msg.mentions.users.find((user) => !user.bot)
        if (nonBotMention && !inferredUserId) {
          inferredUserId = nonBotMention.id
          inferredUsername = nonBotMention.tag
        }

        if (starterMessage && inferredUserId) break
      }
    } catch (error) {
      console.error("Failed to inspect ticket channel messages:", error.message || error)
    }

    const category = inferCategoryFromChannel(channel)
    const priority = inferPriorityFromChannel(channel)
    const now = new Date().toISOString()

    const insertPayload = {
      guild_id: channel.guild.id,
      user_id: inferredUserId || `discord-channel:${channel.id}`,
      username: inferredUsername || channel.name || "Unknown User",
      title: channel.name || "Discord Ticket",
      category,
      status: "open",
      priority,
      initial_message: starterMessage || channel.topic || `Imported from Discord channel ${channel.name}`,
      ai_category_confidence: 0,
      mod_suggestion: category === "verification_issue" ? "send_verification_help" : "review_manually",
      mod_suggestion_confidence: 0,
      discord_thread_id: channel.id,
      created_at: now,
      updated_at: now
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert(insertPayload)
      .select("*")
      .single()

    if (ticketError || !ticket) {
      console.error("Failed ingesting Discord ticket channel:", ticketError?.message || "Unknown error")
      await audit(
        "Discord ticket ingestion failed",
        ticketError?.message || `Failed ingesting channel ${channel.id}`,
        "ticket_ingest_failed",
        channel.id
      )
      return null
    }

    if (starterMessage) {
      const { error: messageError } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: ticket.id,
          author_id: inferredUserId || `discord-channel:${channel.id}`,
          author_name: inferredUsername || channel.name || "Unknown User",
          content: starterMessage,
          attachments: [],
          message_type: "user"
        })

      if (messageError) {
        console.error("Failed inserting ingested starter ticket message:", messageError.message)
      }
    }

    await audit(
      "Discord ticket channel ingested",
      `Imported channel ${channel.id} (${channel.name}) into dashboard tickets`,
      "ticket_ingested",
      ticket.id
    )

    return ticket
  } catch (error) {
    console.error("Discord ticket ingestion failed:", error.message || error)
    await audit(
      "Discord ticket ingestion failed",
      String(error.message || error),
      "ticket_ingest_failed",
      channel?.id || null
    )
    return null
  }
}

async function ingestExistingTicketChannelsOnStartup() {
  try {
    const guild = await client.guilds.fetch(GUILD_ID)
    const channels = await guild.channels.fetch()

    const ticketChannels = [...channels.values()].filter((channel) => {
      return channel &&
        channel.type === ChannelType.GuildText &&
        channel.parentId === TICKET_CATEGORY_ID
    })

    let imported = 0
    for (const channel of ticketChannels) {
      const ticket = await ingestExistingDiscordTicketChannel(channel)
      if (ticket) imported += 1
    }

    await audit(
      "Discord ticket ingestion scan completed",
      `Scanned ${ticketChannels.length} ticket channels and imported ${imported}`,
      "ticket_ingest_scan"
    )

    console.log(`Ticket ingestion scan complete: scanned ${ticketChannels.length}, imported ${imported}`)
  } catch (error) {
    console.error("Ticket ingestion scan failed:", error.message || error)
    await audit(
      "Discord ticket ingestion scan failed",
      String(error.message || error),
      "ticket_ingest_scan_failed"
    )
  }
}

async function createDiscordTicketChannel(message, ticket) {
  try {
    const guild = message.guild
    const category = await getTicketCategoryChannel(guild)

    if (!category) {
      console.warn("No valid ticket category found for channel creation.")
      return null
    }

    const nextNumber = await getNextTicketNumber(guild)
    const channelName = formatTicketChannelName(nextNumber)

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Stoney Ticket ${ticket.id} | User ${message.author.tag} | Category ${ticket.category || "other"}`
    })

    const introLines = [
      "🌿 **Stoney Support Ticket Created**",
      `**Ticket:** ${channelName}`,
      `**User:** <@${message.author.id}>`,
      `**Category:** ${ticket.category || "other"}`,
      `**Priority:** ${ticket.priority || "medium"}`,
      "",
      `**Initial Message:**`,
      ticket.initial_message || "No initial message provided."
    ]

    await channel.send({
      content: introLines.join("\n")
    })

    const { error: updateError } = await supabase
      .from("tickets")
      .update({
        discord_thread_id: channel.id,
        updated_at: new Date().toISOString(),
        title: ticket.title || channelName
      })
      .eq("id", ticket.id)

    if (updateError) {
      console.error("Failed updating ticket with discord_thread_id:", updateError.message)
    }

    await audit(
      "Discord ticket channel created",
      `Created Discord channel ${channel.id} (${channelName}) for ticket ${ticket.id}`,
      "ticket_channel_created",
      ticket.id
    )

    return {
      channelId: channel.id,
      channelName
    }
  } catch (error) {
    console.error("Ticket channel creation failed:", error.message || error)
    await audit(
      "Discord ticket channel creation failed",
      String(error.message || error),
      "ticket_channel_create_failed",
      ticket.id
    )
    return null
  }
}

async function maybeCreateDiscordTicketChannel(message, ticket) {
  const sourceChannelId = message.channel?.id || ""
  const shouldUseConfiguredPanel =
    TICKET_PANEL_CHANNEL_IDS.length === 0 || TICKET_PANEL_CHANNEL_IDS.includes(sourceChannelId)

  if (!shouldUseConfiguredPanel) {
    return null
  }

  return createDiscordTicketChannel(message, ticket)
}

client.once("ready", async () => {
  console.log(`Bot ready as ${client.user.tag}`)
  await audit("Bot online", "Discord bot connected", "bot_ready")

  if (AUTO_SYNC_ENABLED) {
    await fullAutoSync()
    setInterval(fullAutoSync, AUTO_SYNC_INTERVAL_MINUTES * 60 * 1000)
  }

  await ingestExistingTicketChannelsOnStartup()
})

client.on("channelCreate", async (channel) => {
  try {
    if (!channel || channel.type !== ChannelType.GuildText) return
    if (channel.guild?.id !== GUILD_ID) return
    if (channel.parentId !== TICKET_CATEGORY_ID) return

    await ingestExistingDiscordTicketChannel(channel)
  } catch (error) {
    console.error("channelCreate ingestion failed:", error.message || error)
  }
})

client.on("guildMemberAdd", async (member) => {
  recentJoins.push(Date.now())

  const roleRules = await fetchRoleRules(member.guild.id)
  const row = buildMemberSyncRow(member, roleRules, true)

  await Promise.all([
    supabase.from("member_joins").insert({
      guild_id: member.guild.id,
      user_id: member.user.id,
      username: member.user.tag,
      joined_at: new Date().toISOString()
    }),
    supabase.from("guild_members").upsert(row, { onConflict: "guild_id,user_id" })
  ])

  const now = Date.now()
  const last10 = recentJoins.filter((t) => now - t <= 10000).length
  const last30 = recentJoins.filter((t) => now - t <= 30000).length

  if (last10 >= 5 || last30 >= 15) {
    const severity = last30 >= 15 ? "critical" : "warning"

    await supabase.from("raid_events").insert({
      guild_id: member.guild.id,
      join_count: Math.max(last10, last30),
      window_seconds: severity === "critical" ? 30 : 10,
      severity,
      summary: `${severity} raid alert triggered from joins`
    })

    await audit("Raid alert", `${Math.max(last10, last30)} joins detected`, "raid_alert")
  }
})

client.on("guildMemberRemove", async (member) => {
  try {
    const { error } = await supabase
      .from("guild_members")
      .update({
        in_guild: false,
        data_health: "left_guild",
        role_state: "left_guild",
        role_state_reason: "Member left or was removed from the server.",
        updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString()
      })
      .eq("guild_id", member.guild.id)
      .eq("user_id", member.user.id)

    if (error) {
      console.error("Failed to mark member as left_guild:", error.message)
    }

    await audit(
      "Member left guild",
      `${member.user.tag} left or was removed from the guild`,
      "member_left",
      member.user.id
    )
  } catch (error) {
    console.error("guildMemberRemove handling failed:", error.message || error)
  }
})

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return
  const content = message.content || ""

  const history = recentMessages.get(message.author.id) || []
  history.push({ text: content, at: Date.now() })
  const recent = history.filter((row) => Date.now() - row.at <= 15000)
  recentMessages.set(message.author.id, recent)

  const spam = spamScoreMessage(content)
  const repetitionPenalty =
    new Set(recent.map((x) => x.text.toLowerCase())).size <= 2 && recent.length >= 4 ? 3 : 0
  const totalSpam = spam.score + repetitionPenalty

  if (totalSpam >= 6) {
    await supabase.from("warns").insert({
      guild_id: message.guild.id,
      user_id: message.author.id,
      username: message.author.tag,
      reason: `Spam score ${totalSpam}: ${spam.reasons.join(", ") || "message burst"}`,
      source_message: content
    })

    await audit("Warn issued", `${message.author.tag} warned for likely spam`, "warn")
  }

  if (/verify|wallet/i.test(content)) {
    const classification = classifyTicket(content)
    const fraud = fraudScoreVerification({
      accountAgeDays: Math.floor((Date.now() - message.author.createdTimestamp) / 86400000),
      failedAttempts: 0,
      username: message.author.username
    })

    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        guild_id: message.guild.id,
        user_id: message.author.id,
        username: message.author.tag,
        title: classification.category.replaceAll("_", " "),
        category: classification.category,
        status: "open",
        priority: fraud.flagged ? "high" : "medium",
        initial_message: content,
        ai_category_confidence: classification.confidence,
        mod_suggestion: classification.category === "verification_issue"
          ? "send_verification_help"
          : "review_manually",
        mod_suggestion_confidence: classification.confidence,
        updated_at: new Date().toISOString()
      })
      .select("*")
      .single()

    if (ticketError || !ticket) {
      console.error("Failed creating ticket:", ticketError?.message || "Unknown ticket creation error")
      await audit(
        "Ticket creation failed",
        ticketError?.message || "Unknown ticket creation error",
        "ticket_create_failed"
      )
      return
    }

    const createdChannel = await maybeCreateDiscordTicketChannel(message, ticket)

    await Promise.all([
      supabase.from("ticket_messages").insert({
        ticket_id: ticket.id,
        author_id: message.author.id,
        author_name: message.author.tag,
        content,
        attachments: [],
        message_type: "user"
      }),
      audit(
        "Verification ticket created",
        `${message.author.tag} opened a verification-related ticket${createdChannel ? ` with channel ${createdChannel.channelId}` : ""}`,
        "ticket_created",
        ticket.id
      )
    ])

    if (fraud.flagged) {
      await Promise.all([
        supabase.from("verification_flags").insert({
          guild_id: message.guild.id,
          user_id: message.author.id,
          username: message.author.tag,
          score: fraud.score,
          reasons: fraud.reasons,
          flagged: true
        }),
        audit("Verification fraud flagged", `${message.author.tag} hit fraud threshold`, "verification_fraud")
      ])
    }

    try {
      if (createdChannel) {
        await message.reply(
          `Your request has been logged for staff review and a support channel has been created: <#${createdChannel.channelId}>`
        )
      } else {
        await message.reply("Your request has been logged for staff review.")
      }
    } catch (error) {
      console.error("Reply failed", error)
    }
  }
})

client.login(process.env.DISCORD_TOKEN)
