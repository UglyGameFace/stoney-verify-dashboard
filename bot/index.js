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

async function fullAutoSync() {
  try {
    const guild = await client.guilds.fetch(GUILD_ID)
    const fetchedRoles = await guild.roles.fetch()
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
        const roleNames = member.roles.cache
          .sort((a, b) => b.position - a.position)
          .map((role) => role.name)
          .filter((name) => name !== "@everyone")

        for (const roleId of member.roles.cache.keys()) {
          if (roleId !== guild.id) {
            roleCounts.set(roleId, (roleCounts.get(roleId) || 0) + 1)
          }
        }

        return {
          guild_id: guild.id,
          user_id: member.user.id,
          username: member.user.globalName || member.user.username,
          nickname: member.nickname,
          avatar_hash: member.user.avatar,
          avatar_url: member.user.displayAvatarURL(),
          roles: roleNames,
          top_role: roleNames[0] || null,
          joined_at: member.joinedAt ? member.joinedAt.toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
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
})

client.on("guildMemberAdd", async (member) => {
  recentJoins.push(Date.now())

  const roles = member.roles.cache
    .sort((a, b) => b.position - a.position)
    .map((role) => role.name)
    .filter((name) => name !== "@everyone")

  await Promise.all([
    supabase.from("member_joins").insert({
      guild_id: member.guild.id,
      user_id: member.user.id,
      username: member.user.tag,
      joined_at: new Date().toISOString()
    }),
    supabase.from("guild_members").upsert({
      guild_id: member.guild.id,
      user_id: member.user.id,
      username: member.user.globalName || member.user.username,
      nickname: member.nickname,
      avatar_hash: member.user.avatar,
      avatar_url: member.user.displayAvatarURL(),
      roles,
      top_role: roles[0] || null,
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "guild_id,user_id" })
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
