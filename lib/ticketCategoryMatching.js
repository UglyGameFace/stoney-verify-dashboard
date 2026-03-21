export function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return normalizeString(value).toLowerCase();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  return [...new Set(values.map((v) => normalizeString(v)).filter(Boolean))];
}

function normalizeKeywords(category) {
  const baseKeywords = safeArray(category?.match_keywords);
  const extras = [
    category?.name,
    category?.slug,
    category?.button_label,
    category?.intake_type,
  ];

  return uniqueStrings([...baseKeywords, ...extras]).map((item) =>
    item.toLowerCase()
  );
}

function buildTicketSearchText(ticket) {
  const parts = [
    ticket?.title,
    ticket?.subject,
    ticket?.category,
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
  ];

  return normalizeText(parts.filter(Boolean).join(" "));
}

function scoreCategoryMatch(ticket, category) {
  const searchText = buildTicketSearchText(ticket);
  const categoryName = normalizeText(category?.name);
  const categorySlug = normalizeText(category?.slug);
  const intakeType = normalizeText(category?.intake_type);
  const keywords = normalizeKeywords(category);

  let score = 0;
  let reasons = [];

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

  for (const keyword of keywords) {
    if (!keyword) continue;

    if (searchText.includes(keyword)) {
      const keywordWordCount = keyword.split(/\s+/).filter(Boolean).length;
      const keywordLengthBoost = Math.min(keyword.length, 24);

      score += 18 + keywordWordCount * 4 + Math.floor(keywordLengthBoost / 6);
      reasons.push(`keyword:${keyword}`);
    }
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

  if (!matched) {
    return {
      ...ticket,
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
