export const DASHBOARD_WORKSPACE_TABS = ["home", "tickets", "members", "activity", "categories"];

export const HOME_WORKSPACE_KEYS = ["intelligence", "stats", "quickActions"];

export const ACTIVITY_WORKSPACE_KEYS = ["activity", "warns", "raids", "fraud"];

export const MEMBERS_WORKSPACE_KEYS = [
  "freshEntrants",
  "memberSnapshot",
  "staffMetrics",
  "roleHierarchy",
  "memberSearch",
];

export const WORKSPACE_TAB_META = {
  home: {
    label: "Home",
    eyebrow: "Moderation Workspace",
    title: "Command Home",
    subtitle:
      "Start with setup health, live pressure, and the actions staff need first.",
  },
  tickets: {
    label: "Tickets",
    eyebrow: "Ticket Operations",
    title: "Live Ticket Queue",
    subtitle:
      "Claim, filter, repair, and review tickets without mixing maintenance into the main dashboard.",
  },
  members: {
    label: "Members",
    eyebrow: "Member Intelligence",
    title: "Member Investigation Desk",
    subtitle:
      "Search people, inspect history, roles, fresh joins, and staff metrics in one focused workspace.",
  },
  activity: {
    label: "Activity",
    eyebrow: "Signals + Audit",
    title: "Activity + Risk Signals",
    subtitle:
      "Audit logs, warning intelligence, raid signals, and fraud indicators live here instead of cluttering Home.",
  },
  categories: {
    label: "Categories",
    eyebrow: "Routing + Intake",
    title: "Category Routing Lab",
    subtitle:
      "Tune category logic and jump straight into the ticket flows those categories feed.",
  },
};

export function getVisibleKeys(keys, visibility = {}) {
  return Array.from(new Set(keys)).filter((key) => visibility?.[key] !== false);
}

export function splitHomeAndActivityKeys(homeLayout = []) {
  const normalized = Array.from(new Set(Array.isArray(homeLayout) ? homeLayout : []));
  const home = normalized.filter((key) => HOME_WORKSPACE_KEYS.includes(key));
  const activity = normalized.filter((key) => ACTIVITY_WORKSPACE_KEYS.includes(key));

  return {
    home: home.length ? home : HOME_WORKSPACE_KEYS,
    activity: activity.length ? activity : ACTIVITY_WORKSPACE_KEYS,
  };
}
