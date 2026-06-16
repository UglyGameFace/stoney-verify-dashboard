export const PROFILE_PANEL_KEYS = [
  "pronouns",
  "interests",
  "pings",
  "gaming",
  "vibes",
  "privacy",
] as const;

export type ProfilePanelKey = (typeof PROFILE_PANEL_KEYS)[number];

export type ProfilePanelOption = {
  optionKey: string;
  label: string;
  description: string;
  emoji: string;
  roleName: string | null;
  privacyKind?: "public_role" | "private_choice" | "reset";
  sortOrder: number;
};

export type ProfilePanelPreset = {
  panelKey: ProfilePanelKey;
  title: string;
  description: string;
  optional: boolean;
  allowMultiple: boolean;
  maxChoices: number;
  sortOrder: number;
  options: ProfilePanelOption[];
};

export const DEFAULT_PROFILE_CUSTOMIZER_SETTINGS = {
  enabled: true,
  showAfterVerification: true,
  requireBeforeAccess: false,
  allowUserReset: true,
  auditChanges: true,
} as const;

export const DEFAULT_PROFILE_PANELS: ProfilePanelPreset[] = [
  {
    panelKey: "pronouns",
    title: "Pronouns",
    description:
      "Optional pronoun roles. Pick only what you want shown, skip it entirely, or use a privacy choice.",
    optional: true,
    allowMultiple: true,
    maxChoices: 3,
    sortOrder: 10,
    options: [
      {
        optionKey: "he_him",
        label: "He/Him",
        description: "Show He/Him pronouns on your server profile.",
        emoji: "🧢",
        roleName: "Pronouns: He/Him",
        privacyKind: "public_role",
        sortOrder: 10,
      },
      {
        optionKey: "she_her",
        label: "She/Her",
        description: "Show She/Her pronouns on your server profile.",
        emoji: "🌸",
        roleName: "Pronouns: She/Her",
        privacyKind: "public_role",
        sortOrder: 20,
      },
      {
        optionKey: "they_them",
        label: "They/Them",
        description: "Show They/Them pronouns on your server profile.",
        emoji: "✨",
        roleName: "Pronouns: They/Them",
        privacyKind: "public_role",
        sortOrder: 30,
      },
      {
        optionKey: "any_pronouns",
        label: "Any Pronouns",
        description: "Let people know any pronouns are fine.",
        emoji: "🌈",
        roleName: "Pronouns: Any",
        privacyKind: "public_role",
        sortOrder: 40,
      },
      {
        optionKey: "ask_me",
        label: "Ask Me",
        description: "Lets people know to ask instead of assuming.",
        emoji: "💬",
        roleName: "Pronouns: Ask Me",
        privacyKind: "public_role",
        sortOrder: 50,
      },
      {
        optionKey: "prefer_not_to_say",
        label: "Prefer Not to Say",
        description: "A privacy-friendly choice. This should never be required for access.",
        emoji: "🔒",
        roleName: "Pronouns: Prefer Not to Say",
        privacyKind: "private_choice",
        sortOrder: 60,
      },
    ],
  },
  {
    panelKey: "interests",
    title: "Interests",
    description: "Optional interests so members can find people into the same stuff.",
    optional: true,
    allowMultiple: true,
    maxChoices: 10,
    sortOrder: 20,
    options: [
      {
        optionKey: "gaming",
        label: "Gaming",
        description: "Games, squads, party chat, clips, and gaming talk.",
        emoji: "🎮",
        roleName: "Interest: Gaming",
        sortOrder: 10,
      },
      {
        optionKey: "music",
        label: "Music",
        description: "Music talk, playlists, artists, and aux battles.",
        emoji: "🎧",
        roleName: "Interest: Music",
        sortOrder: 20,
      },
      {
        optionKey: "anime",
        label: "Anime",
        description: "Anime, manga, recommendations, and watch parties.",
        emoji: "🍜",
        roleName: "Interest: Anime",
        sortOrder: 30,
      },
      {
        optionKey: "cars",
        label: "Cars",
        description: "Builds, repairs, parts, meets, and car talk.",
        emoji: "🏎️",
        roleName: "Interest: Cars",
        sortOrder: 40,
      },
      {
        optionKey: "deals",
        label: "Deals",
        description: "Retail flips, glitches, coupons, and bargain finds.",
        emoji: "🛒",
        roleName: "Interest: Deals",
        sortOrder: 50,
      },
      {
        optionKey: "memes",
        label: "Memes",
        description: "Memes, jokes, and unserious chaos.",
        emoji: "😂",
        roleName: "Interest: Memes",
        sortOrder: 60,
      },
    ],
  },
  {
    panelKey: "pings",
    title: "Notification Pings",
    description: "Choose only the server alerts you actually want.",
    optional: true,
    allowMultiple: true,
    maxChoices: 10,
    sortOrder: 30,
    options: [
      {
        optionKey: "announcements",
        label: "Announcements",
        description: "Important server updates.",
        emoji: "📢",
        roleName: "Ping: Announcements",
        sortOrder: 10,
      },
      {
        optionKey: "events",
        label: "Events",
        description: "Server events, giveaways, watch parties, and group activities.",
        emoji: "🎉",
        roleName: "Ping: Events",
        sortOrder: 20,
      },
      {
        optionKey: "deals",
        label: "Deals",
        description: "Deal drops, price errors, and retail alerts.",
        emoji: "🏷️",
        roleName: "Ping: Deals",
        sortOrder: 30,
      },
      {
        optionKey: "gaming",
        label: "Gaming LFG",
        description: "Looking-for-group and game night pings.",
        emoji: "🕹️",
        roleName: "Ping: Gaming",
        sortOrder: 40,
      },
    ],
  },
  {
    panelKey: "gaming",
    title: "Gaming Profile",
    description: "Optional platform/game roles for finding people to play with.",
    optional: true,
    allowMultiple: true,
    maxChoices: 12,
    sortOrder: 40,
    options: [
      {
        optionKey: "playstation",
        label: "PlayStation",
        description: "PlayStation players.",
        emoji: "🔵",
        roleName: "Platform: PlayStation",
        sortOrder: 10,
      },
      {
        optionKey: "xbox",
        label: "Xbox",
        description: "Xbox players.",
        emoji: "🟢",
        roleName: "Platform: Xbox",
        sortOrder: 20,
      },
      {
        optionKey: "pc",
        label: "PC",
        description: "PC players.",
        emoji: "🖥️",
        roleName: "Platform: PC",
        sortOrder: 30,
      },
      {
        optionKey: "mobile",
        label: "Mobile",
        description: "Mobile players.",
        emoji: "📱",
        roleName: "Platform: Mobile",
        sortOrder: 40,
      },
      {
        optionKey: "cod",
        label: "Call of Duty",
        description: "COD players and squad pings.",
        emoji: "🎯",
        roleName: "Game: Call of Duty",
        sortOrder: 50,
      },
      {
        optionKey: "fortnite",
        label: "Fortnite",
        description: "Fortnite players.",
        emoji: "🚌",
        roleName: "Game: Fortnite",
        sortOrder: 60,
      },
    ],
  },
  {
    panelKey: "vibes",
    title: "Vibes & Aesthetic",
    description: "Optional cosmetic roles for personality and color vibes.",
    optional: true,
    allowMultiple: true,
    maxChoices: 5,
    sortOrder: 50,
    options: [
      {
        optionKey: "chill",
        label: "Chill",
        description: "Low-key, relaxed energy.",
        emoji: "🌊",
        roleName: "Vibe: Chill",
        sortOrder: 10,
      },
      {
        optionKey: "night_owl",
        label: "Night Owl",
        description: "Usually online late.",
        emoji: "🦉",
        roleName: "Vibe: Night Owl",
        sortOrder: 20,
      },
      {
        optionKey: "creative",
        label: "Creative",
        description: "Art, edits, music, writing, design, or building stuff.",
        emoji: "🎨",
        roleName: "Vibe: Creative",
        sortOrder: 30,
      },
      {
        optionKey: "helper",
        label: "Helpful",
        description: "Likes helping newer members.",
        emoji: "🤝",
        roleName: "Vibe: Helpful",
        sortOrder: 40,
      },
    ],
  },
  {
    panelKey: "privacy",
    title: "Privacy & Reset",
    description: "Let members clear profile roles or choose a lower-disclosure profile.",
    optional: true,
    allowMultiple: false,
    maxChoices: 1,
    sortOrder: 60,
    options: [
      {
        optionKey: "clear_profile_roles",
        label: "Clear My Profile Roles",
        description: "Remove all optional profile roles from this server.",
        emoji: "🧹",
        roleName: null,
        privacyKind: "reset",
        sortOrder: 10,
      },
      {
        optionKey: "minimal_profile",
        label: "Minimal Profile",
        description: "I prefer not to show personal profile roles.",
        emoji: "🔕",
        roleName: "Profile: Minimal",
        privacyKind: "private_choice",
        sortOrder: 20,
      },
    ],
  },
];

export function normalizeProfilePanelKey(value: unknown): ProfilePanelKey | null {
  const key = String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  return PROFILE_PANEL_KEYS.includes(key as ProfilePanelKey) ? (key as ProfilePanelKey) : null;
}

export function getDefaultProfilePanels(): ProfilePanelPreset[] {
  return DEFAULT_PROFILE_PANELS.map((panel) => ({
    ...panel,
    options: panel.options.map((option) => ({ ...option })),
  }));
}

export function findDefaultProfilePanel(panelKey: unknown): ProfilePanelPreset | null {
  const normalized = normalizeProfilePanelKey(panelKey);
  return normalized ? getDefaultProfilePanels().find((panel) => panel.panelKey === normalized) || null : null;
}
