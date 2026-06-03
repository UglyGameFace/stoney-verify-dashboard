"use client";

import {
  HOME_WORKSPACE_KEYS,
  ACTIVITY_WORKSPACE_KEYS,
  MEMBERS_WORKSPACE_KEYS,
} from "@/components/dashboard/workspaceModel";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueVisibleKeys(layout, fallback, visibility) {
  const source = safeArray(layout).length ? layout : fallback;
  const seen = new Set();
  const out = [];

  for (const key of source) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (visibility?.[key] !== false) out.push(key);
  }

  return out;
}

function WorkspaceGrid({ className, layout, fallback, visibility, sections, prefix }) {
  const keys = uniqueVisibleKeys(layout, fallback, visibility);

  return (
    <div className={className}>
      {keys.map((key) => (
        <div key={`${prefix}-${key}`}>{sections?.[key] || null}</div>
      ))}
    </div>
  );
}

export default function MobileWorkspacePanels({
  activeTab,
  sectionVisibility = {},
  homeLayout = HOME_WORKSPACE_KEYS,
  activityLayout = ACTIVITY_WORKSPACE_KEYS,
  membersLayout = MEMBERS_WORKSPACE_KEYS,
  homeSections = {},
  activitySections = {},
  membersSections = {},
  ticketsPanel,
  categoriesPanel,
}) {
  return (
    <>
      <section className={`mobile-tab-panel ${activeTab === "home" ? "active" : ""}`}>
        <WorkspaceGrid
          className="dashboard-home-grid"
          layout={homeLayout}
          fallback={HOME_WORKSPACE_KEYS}
          visibility={sectionVisibility}
          sections={homeSections}
          prefix="home"
        />
      </section>

      <section className={`mobile-tab-panel ${activeTab === "tickets" ? "active" : ""}`}>
        {ticketsPanel || null}
      </section>

      <section className={`mobile-tab-panel ${activeTab === "members" ? "active" : ""}`}>
        <WorkspaceGrid
          className="dashboard-members-grid"
          layout={membersLayout}
          fallback={MEMBERS_WORKSPACE_KEYS}
          visibility={sectionVisibility}
          sections={membersSections}
          prefix="members"
        />
      </section>

      <section className={`mobile-tab-panel ${activeTab === "activity" ? "active" : ""}`}>
        <WorkspaceGrid
          className="dashboard-activity-grid"
          layout={activityLayout}
          fallback={ACTIVITY_WORKSPACE_KEYS}
          visibility={sectionVisibility}
          sections={activitySections}
          prefix="activity"
        />
      </section>

      <section className={`mobile-tab-panel ${activeTab === "categories" ? "active" : ""}`}>
        {categoriesPanel || null}
      </section>
    </>
  );
}
