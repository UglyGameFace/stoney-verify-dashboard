export type EmojiGroupId =
  | "general"
  | "safety"
  | "support"
  | "media"
  | "gaming"
  | "community"
  | "marketplace"
  | "roles"
  | "seasonal";

export type EmojiPreset = {
  emoji: string;
  label: string;
  keywords: string[];
  group: EmojiGroupId;
  safeForCritical: boolean;
};

export const EMOJI_GROUP_LABELS: Record<EmojiGroupId, string> = {
  general: "General",
  safety: "Safety",
  support: "Support",
  media: "Media",
  gaming: "Gaming",
  community: "Community",
  marketplace: "Marketplace",
  roles: "Roles",
  seasonal: "Seasonal",
};

export const EMOJI_PRESETS: EmojiPreset[] = [
  { emoji: "💬", label: "Chat", keywords: ["general", "chat", "talk", "lounge"], group: "general", safeForCritical: true },
  { emoji: "📢", label: "Announcements", keywords: ["announcements", "news", "updates"], group: "general", safeForCritical: true },
  { emoji: "📌", label: "Pinned", keywords: ["pinned", "info", "important"], group: "general", safeForCritical: true },
  { emoji: "📝", label: "Notes", keywords: ["notes", "forms", "write", "logs"], group: "general", safeForCritical: true },
  { emoji: "📋", label: "Rules / List", keywords: ["rules", "checklist", "list", "board"], group: "general", safeForCritical: true },
  { emoji: "⭐", label: "Featured", keywords: ["star", "featured", "vip", "best"], group: "general", safeForCritical: true },
  { emoji: "🔥", label: "Hot", keywords: ["fire", "hot", "trending", "popular"], group: "general", safeForCritical: false },
  { emoji: "✅", label: "Verified", keywords: ["verify", "verified", "approve", "done"], group: "general", safeForCritical: true },
  { emoji: "❌", label: "Denied", keywords: ["deny", "no", "reject", "closed"], group: "general", safeForCritical: false },
  { emoji: "⚠️", label: "Warning", keywords: ["warning", "alert", "important", "risk"], group: "general", safeForCritical: true },
  { emoji: "❓", label: "Help", keywords: ["help", "faq", "questions"], group: "general", safeForCritical: true },

  { emoji: "🛡️", label: "Shield", keywords: ["safety", "security", "moderation", "rules"], group: "safety", safeForCritical: true },
  { emoji: "🔒", label: "Locked", keywords: ["lock", "private", "secure"], group: "safety", safeForCritical: true },
  { emoji: "🔐", label: "Secure", keywords: ["secure", "permissions", "private"], group: "safety", safeForCritical: true },
  { emoji: "🚨", label: "Alert", keywords: ["mod", "alert", "report", "urgent"], group: "safety", safeForCritical: true },
  { emoji: "👮", label: "Staff", keywords: ["staff", "mods", "admin", "team"], group: "safety", safeForCritical: true },
  { emoji: "🧹", label: "Cleanup", keywords: ["cleanup", "purge", "inactive", "sweep"], group: "safety", safeForCritical: true },
  { emoji: "🧾", label: "Audit", keywords: ["audit", "logs", "receipts", "records"], group: "safety", safeForCritical: true },

  { emoji: "🎫", label: "Ticket", keywords: ["ticket", "support", "request", "helpdesk"], group: "support", safeForCritical: true },
  { emoji: "🧑‍💻", label: "Tech Support", keywords: ["support", "tech", "help", "dev"], group: "support", safeForCritical: true },
  { emoji: "🛠️", label: "Tools", keywords: ["tools", "fix", "repair", "setup"], group: "support", safeForCritical: true },
  { emoji: "📩", label: "Inbox", keywords: ["inbox", "contact", "mail", "requests"], group: "support", safeForCritical: true },
  { emoji: "📞", label: "Call", keywords: ["call", "voice", "support", "contact"], group: "support", safeForCritical: true },

  { emoji: "📸", label: "Photos", keywords: ["photos", "pics", "gallery", "media"], group: "media", safeForCritical: false },
  { emoji: "🎬", label: "Clips", keywords: ["clips", "video", "movies", "gaming clips"], group: "media", safeForCritical: false },
  { emoji: "🎥", label: "Video", keywords: ["video", "camera", "film"], group: "media", safeForCritical: false },
  { emoji: "🎵", label: "Music", keywords: ["music", "songs", "tracks", "audio"], group: "media", safeForCritical: false },
  { emoji: "🎧", label: "Listening", keywords: ["music", "headphones", "voice", "audio"], group: "media", safeForCritical: false },
  { emoji: "🖼️", label: "Gallery", keywords: ["gallery", "art", "images", "media"], group: "media", safeForCritical: false },

  { emoji: "🎮", label: "Gaming", keywords: ["gaming", "games", "play", "console"], group: "gaming", safeForCritical: false },
  { emoji: "🕹️", label: "Arcade", keywords: ["arcade", "retro", "games"], group: "gaming", safeForCritical: false },
  { emoji: "🏆", label: "Wins", keywords: ["wins", "leaderboard", "trophy", "rank"], group: "gaming", safeForCritical: false },
  { emoji: "🎯", label: "Goals", keywords: ["goals", "target", "challenges"], group: "gaming", safeForCritical: false },
  { emoji: "⚔️", label: "Battle", keywords: ["battle", "pvp", "team", "fight"], group: "gaming", safeForCritical: false },

  { emoji: "😂", label: "Memes", keywords: ["memes", "funny", "jokes"], group: "community", safeForCritical: false },
  { emoji: "👋", label: "Welcome", keywords: ["welcome", "introductions", "hello"], group: "community", safeForCritical: true },
  { emoji: "🐶", label: "Pets", keywords: ["pets", "dogs", "cats", "animals"], group: "community", safeForCritical: false },
  { emoji: "🚗", label: "Cars", keywords: ["cars", "vehicles", "rides"], group: "community", safeForCritical: false },
  { emoji: "🍕", label: "Food", keywords: ["food", "munchies", "snacks"], group: "community", safeForCritical: false },
  { emoji: "🌎", label: "World", keywords: ["world", "global", "travel", "community"], group: "community", safeForCritical: false },
  { emoji: "💡", label: "Ideas", keywords: ["ideas", "suggestions", "feedback"], group: "community", safeForCritical: true },

  { emoji: "💰", label: "Money", keywords: ["market", "sales", "money", "deals"], group: "marketplace", safeForCritical: false },
  { emoji: "🛒", label: "Shop", keywords: ["shop", "store", "market", "buy"], group: "marketplace", safeForCritical: false },
  { emoji: "🏷️", label: "Tag", keywords: ["price", "tags", "listings"], group: "marketplace", safeForCritical: false },
  { emoji: "📦", label: "Package", keywords: ["orders", "shipping", "items", "inventory"], group: "marketplace", safeForCritical: false },
  { emoji: "💎", label: "Premium", keywords: ["premium", "vip", "rare", "value"], group: "marketplace", safeForCritical: false },

  { emoji: "👥", label: "Members", keywords: ["members", "people", "roles"], group: "roles", safeForCritical: true },
  { emoji: "🔰", label: "New", keywords: ["new", "beginner", "starter"], group: "roles", safeForCritical: true },
  { emoji: "👑", label: "Owner / VIP", keywords: ["owner", "vip", "crown"], group: "roles", safeForCritical: false },
  { emoji: "🤝", label: "Partner", keywords: ["partner", "collab", "affiliate"], group: "roles", safeForCritical: false },

  { emoji: "🎄", label: "Holiday", keywords: ["holiday", "christmas", "seasonal"], group: "seasonal", safeForCritical: false },
  { emoji: "🎃", label: "Halloween", keywords: ["halloween", "spooky", "seasonal"], group: "seasonal", safeForCritical: false },
  { emoji: "🎉", label: "Party", keywords: ["party", "events", "celebrate"], group: "seasonal", safeForCritical: false },
];

export function searchEmojiPresets(query: string, limit = 24): EmojiPreset[] {
  const q = String(query || "").trim().toLowerCase();
  const max = Math.max(1, Math.min(100, Math.floor(limit || 24)));
  if (!q) return EMOJI_PRESETS.slice(0, max);

  return EMOJI_PRESETS
    .map((preset) => {
      const label = preset.label.toLowerCase();
      const keywords = preset.keywords.join(" ").toLowerCase();
      const score = label === q ? 100 : label.includes(q) ? 60 : keywords.includes(q) ? 40 : preset.emoji === q ? 100 : 0;
      return { preset, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.preset.label.localeCompare(b.preset.label))
    .slice(0, max)
    .map((row) => row.preset);
}

export function suggestEmojiForName(name: string): EmojiPreset | null {
  const plain = String(name || "").toLowerCase();
  const matches = searchEmojiPresets(plain, 1);
  if (matches[0]) return matches[0];

  const tokens = plain.split(/[^a-z0-9]+/).filter(Boolean);
  for (const token of tokens) {
    const match = searchEmojiPresets(token, 1)[0];
    if (match) return match;
  }
  return null;
}
