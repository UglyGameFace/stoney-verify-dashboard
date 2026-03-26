const LEGACY_CATEGORY_ALIASES = {
  verification: [
    "verification_issue",
    "verification issue",
    "verify_issue",
    "verify issue",
    "verification",
    "verify",
  ],
  appeal: [
    "appeal",
    "ban appeal",
    "timeout appeal",
    "appeals",
  ],
  report: [
    "report",
    "report_issue",
    "report issue",
    "incident",
    "report incident",
    "report / incident",
  ],
  partnership: [
    "partnership",
    "partner",
    "collab",
    "collaboration",
  ],
  question: [
    "question",
    "questions",
    "help question",
  ],
  general: [
    "general",
    "general support",
    "support",
    "help",
  ],
  custom: [],
};

const COD_SERVICE_ALIASES = [
  "cod",
  "call of duty",
  "cod service",
  "cod services",
  "cod recovery",
  "recoveries",
  "recovery",
  "challenge lobby",
  "challenge lobbies",
  "modded lobby",
  "modded lobbies",
  "unlock all",
  "prestige",
  "rank unlock",
  "account recovery",
  "older cod",
  "old cod",
  "legacy cod",
  "bo1",
  "bo2",
  "bo3",
  "black ops 1",
  "black ops 2",
  "black ops 3",
  "mw2",
  "mw3",
  "modern warfare 2",
  "modern warfare 3",
  "waw",
  "world at war",
  "zombies rank",
  "camo unlock",
  "camo service",
  "dark matter",
  "diamond camo",
  "bot lobby",
];

const TOKEN_EXPANSIONS = [
  [/\\bbo1\\b/g, " black ops 1 bo1 "],
  [/\\bbo2\\b/g, " black ops 2 bo2 "],
  [/\\bbo3\\b/g, " black ops 3 bo3 "],
  [/\\bmw2\\b/g, " modern warfare 2 mw2 "],
  [/\\bmw3\\b/g, " modern warfare 3 mw3 "],
  [/\\bwaw\\b/g, " world at war waw "],
  [/\\bcl\\b/g, " challenge lobby cl "],
  [/\\bu\\s*a\\b/g, " unlock all ua "],
];

export function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  let text = normalizeString(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of TOKEN_EXPANSIONS) {
    text = text.replace(pattern, replacement);
  }

  return text.replace(/\s+/g, " ").trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  return [...new Set(values.map((v) => normalizeString(v)).filter(Boolean))];
}

function containsAny(haystack, needles) {
  const cleanHaystack = normalizeText(haystack);
  if (!cleanHaystack) return false;
  return needles.some((needle) => {
    const cleanNeedle = normalizeText(needle);
    return cleanNeedle ? cleanHaystack.includes(cleanNeedle) : false;
  });
}

function categoryLooksLikeCodService(category) {
  const haystack = [
    category?.name,
    category?.slug,
    category?.description,
    category?.button_label,
    category?.intake_type,
    ...safeArray(category?.match_keywords),
  ].join(" ");

  return containsAny(haystack, COD_SERVICE_ALIASES);
}

function getLegacyAliases(category) {
  const slug = normalizeText(category?.slug);
  const intake = normalizeText(category?.intake_type);
  const name = normalizeText(category?.name);

  const aliasSet = new Set();

  for (const key of [slug, intake, name]) {
    const list = LEGACY_CATEGORY_ALIASES[key] || [];
    for (const item of list) {
      aliasSet.add(normalizeText(item));
    }
  }

  if (categoryLooksLikeCodService(category)) {
    for (const item of COD_SERVICE_ALIASES) {
      aliasSet.add(normalizeText(item));
    }
  }

  return [...aliasSet];
}

function normalizeKeywords(category) {
  const baseKeywords = safeArray(category?.match_keywords);
  const extras = [
    category?.name,
    category?.slug,
    category?.button_label,
    category?.intake_type,
    ...getLegacyAliases(category),
  ];

  return uniqueStrings([...baseKeywords, ...extras]).map((item) =>
    normalizeText(item)
  );
}

function buildTicketSearchText(ticket) {
  const parts = [
    ticket?.title,
    ticket?.subject,
    ticket?.category,
    ticket?.raw_category,
    ticket?.username,
    ticket?.closed_reason,
    ticket?.reason,
    ticket?.mod_suggestion,
    ticket?.description,
    ticket?.message,
    ticket?.content,
    ticket?.body,
    ticket?.initial_message,
    ticket?.channel_name,
    ticket?.matched_category_name,
    ticket?.matched_category_slug,
    ticket?.matched_intake_type,
  ];

  return normalizeText(parts.filter(Boolean).join(" "));
}

function reasonHasCodLegacySignals(searchText) {
  return containsAny(searchText, [
    "cod",
    "call of duty",
    "bo1",
    "bo2",
    "bo3",
    "black ops 1",
    "black ops 2",
    "black ops 3",
    "mw2",
    "mw3",
    "modern warfare 2",
    "modern warfare 3",
    "waw",
    "world at war",
    "challenge lobby",
    "challenge lobbies",
    "modded lobby",
    "modded lobbies",
    "unlock all",
    "account recovery",
    "recovery",
    "recoveries",
    "older cod",
    "old cod",
    "legacy cod",
    "prestige",
    "rank unlock",
    "camo unlock",
    "zombies rank",
    "bot lobby",
  ]);
}

function scoreCategoryMatch(ticket, category) {
  const searchText = buildTicketSearchText(ticket);
  const categoryName = normalizeText(category?.name);
  const categorySlug = normalizeText(category?.slug);
  const intakeType = normalizeText(category?.intake_type);
  const keywords = normalizeKeywords(category);
  const legacyAliases = getLegacyAliases(category);
  const codCategory = categoryLooksLikeCodService(category);

  let score = 0;
  const reasons = [];

  if (!searchText) {
    return { score: 0, reasons: [] };
  }

  if (categoryName && searchText.includes(categoryName)) {
    score += 60;
    reasons.push(`name:${categoryName}`);
  }

  if (categorySlug && searchText.includes(categorySlug.replace(/-/g, " "))) {
    score += 55;
    reasons.push(`slug:${categorySlug}`);
  }

  if (intakeType && searchText.includes(intakeType)) {
    score += 20;
    reasons.push(`intake:${intakeType}`);
  }

  for (const alias of legacyAliases) {
    if (alias && searchText.includes(alias)) {
      score += 70;
      reasons.push(`legacy:${alias}`);
    }
  }

  for (const keyword of keywords) {
    if (!keyword) continue;

    if (searchText.includes(keyword)) {
      const keywordWordCount = keyword.split(/\s+/).filter(Boolean).length;
      const keywordLengthBoost = Math.min(keyword.length, 24);

      score += 18 + keywordWordCount * 4 + Math.floor(keywordLengthBoost / 6);
      reasons.push(`keyword:${keyword}`);
    }
  }

  if (reasonHasCodLegacySignals(searchText) && codCategory) {
    score += 180;
    reasons.push("cod-legacy-signal");
  }

  const existingCategory = normalizeText(ticket?.category);
  if (existingCategory) {
    if (categoryName && existingCategory === categoryName) {
      score += 80;
      reasons.push("existing-category-name");
    }
    if (categorySlug && existingCategory === categorySlug) {
      score += 80;
      reasons.push("existing-category-slug");
    }
    if (legacyAliases.includes(existingCategory)) {
      score += 95;
      reasons.push("existing-legacy-category");
    }
  }

  return { score, reasons };
}

export function matchTicketToCategory(ticket, categories = []) {
  const usableCategories = safeArray(categories).filter(
    (category) => normalizeString(category?.name) || normalizeString(category?.slug)
  );

  if (!usableCategories.length) {
    return {
      matched: null,
      reason: "no-categories",
      score: 0,
      reasons: [],
    };
  }

  const scored = usableCategories
    .map((category) => {
      const result = scoreCategoryMatch(ticket, category);
      return {
        category,
        score: result.score,
        reasons: result.reasons,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      const aOrder = Number(a?.category?.sort_order ?? 9999);
      const bOrder = Number(b?.category?.sort_order ?? 9999);
      if (aOrder !== bOrder) return aOrder - bOrder;

      if (Boolean(b?.category?.is_default) !== Boolean(a?.category?.is_default)) {
        return b?.category?.is_default ? 1 : -1;
      }

      return String(a?.category?.name || "").localeCompare(
        String(b?.category?.name || "")
      );
    });

  const best = scored[0];

  if (best && best.score > 0) {
    return {
      matched: best.category,
      reason: best.reasons[0] || "keyword-match",
      score: best.score,
      reasons: best.reasons,
    };
  }

  const fallback = usableCategories.find((category) => Boolean(category?.is_default));

  if (fallback) {
    return {
      matched: fallback,
      reason: "default-category",
      score: 1,
      reasons: ["default-category"],
    };
  }

  return {
    matched: null,
    reason: "no-match",
    score: 0,
    reasons: [],
  };
}

export function enrichTicketWithMatchedCategory(ticket, categories = []) {
  const result = matchTicketToCategory(ticket, categories);
  const matched = result.matched;
  const rawCategory = normalizeString(ticket?.category) || null;

  if (!matched) {
    return {
      ...ticket,
      raw_category: rawCategory,
      matched_category_id: null,
      matched_category_name: null,
      matched_category_slug: null,
      matched_intake_type: null,
      matched_category_reason: result.reason || null,
      matched_category_score: result.score || 0,
      matched_category_keywords: [],
    };
  }

  return {
    ...ticket,
    raw_category: rawCategory,
    matched_category_id: matched.id || null,
    matched_category_name: matched.name || null,
    matched_category_slug: matched.slug || null,
    matched_intake_type: matched.intake_type || null,
    matched_category_reason: result.reason || null,
    matched_category_score: result.score || 0,
    matched_category_keywords: Array.isArray(matched.match_keywords)
      ? matched.match_keywords
      : [],
    category: ticket?.category || matched.slug || matched.name || null,
  };
}
