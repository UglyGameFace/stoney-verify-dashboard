const CATEGORY_RULES = {
  verification_issue: ["verify", "verification", "wallet", "cant verify", "can't verify", "role not showing"],
  appeal: ["appeal", "timeout", "mute", "warn", "ban appeal"],
  bug_report: ["bug", "glitch", "broken", "not working", "error"],
  payment_issue: ["payment", "refund", "chargeback", "purchase"],
  server_help: ["help", "how do i", "where is", "support", "question"]
}

const SPAM_PATTERNS = [
  /free nitro/i,
  /steam gift/i,
  /@everyone|@here/i,
  /(https?:\/\/\S+)/i,
  /(.)\1{10,}/i
]

export function classifyTicket(text = "") {
  const source = text.toLowerCase()
  let bestCategory = "other"
  let bestScore = 0

  for (const [category, terms] of Object.entries(CATEGORY_RULES)) {
    let score = 0
    for (const term of terms) {
      if (source.includes(term)) score += 1
    }
    if (score > bestScore) {
      bestCategory = category
      bestScore = score
    }
  }

  const confidence = Number(Math.min(0.55 + bestScore * 0.11, 0.96).toFixed(2))
  return { category: bestCategory, confidence, autoApplied: confidence >= 0.86 }
}

export function spamScoreMessage(text = "") {
  const clean = text.trim()
  let score = 0
  const reasons = []

  if (clean.length > 850) {
    score += 2
    reasons.push("very_long_message")
  }

  const words = clean.split(/\s+/).filter(Boolean)
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()))
  if (words.length > 12 && uniqueWords.size / words.length < 0.4) {
    score += 3
    reasons.push("word_repetition")
  }

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(clean)) {
      score += 3
      reasons.push(`pattern:${pattern}`)
    }
  }

  return {
    score,
    reasons,
    spam: score >= 5,
    confidence: Number(Math.min(0.46 + score * 0.08, 0.98).toFixed(2))
  }
}

export function suggestModerationAction(text = "") {
  const classification = classifyTicket(text)
  const spam = spamScoreMessage(text)

  if (spam.spam && spam.confidence >= 0.8) {
    return { suggestion: "warn_user", confidence: spam.confidence, reason: "Likely spam", mode: "automatic_allowed" }
  }

  if (classification.category === "verification_issue") {
    return { suggestion: "send_verification_help", confidence: classification.confidence, reason: "Likely verification request", mode: "manual_or_auto" }
  }

  if (classification.category === "appeal") {
    return { suggestion: "route_to_appeals_staff", confidence: classification.confidence, reason: "Appeal language", mode: "manual_recommended" }
  }

  return { suggestion: "review_manually", confidence: classification.confidence, reason: "Low certainty", mode: "manual_only" }
}

export function fraudScoreVerification(input = {}) {
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
  if ((input.sameAvatarMatches || 0) >= 3) {
    score += 2
    reasons.push("shared_avatar_cluster")
  }
  if (/^[a-z]+\d{4,}$/i.test(input.username || "")) {
    score += 2
    reasons.push("bot_like_name_pattern")
  }

  return {
    score,
    reasons,
    flagged: score >= 6,
    confidence: Number(Math.min(0.5 + score * 0.06, 0.97).toFixed(2))
  }
}
