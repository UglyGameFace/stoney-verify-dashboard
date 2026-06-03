# Dashboard Workspace Refactor

Dank Shield dashboard is being moved from one overloaded staff home page into clear workspaces:

```text
Home       = intelligence, stats, quick actions
Tickets    = queue operations
Members    = member search, roles, snapshots, staff metrics
Activity   = audit feed, warns, raids, fraud
Categories = ticket category routing
```

## Completed

- `components/dashboard/workspaceModel.js`
  - Defines `DASHBOARD_WORKSPACE_TABS`.
  - Defines `HOME_WORKSPACE_KEYS`.
  - Defines `ACTIVITY_WORKSPACE_KEYS`.
  - Defines `MEMBERS_WORKSPACE_KEYS`.
  - Provides shared labels/metadata.

- `components/MobileBottomNav.js`
  - Removed temporary `Signals` scroll-jump behavior.
  - Added real `activity` tab metadata/icon support.

- `lib/useDashboardPreferences.js`
  - Separates `layout.home`, `layout.activity`, and `layout.members`.
  - Migrates old saved profiles where activity/warns/raids/fraud lived in Home.
  - Supports moving sections inside the Activity workspace.

- `components/dashboard/DesktopDashboardView.js`
  - Supports `activeTab === "activity"`.
  - Renders Activity Feed, Warn Intelligence, Raid Intelligence, and Fraud Intelligence from `activitySections`.

- `components/dashboard/DashboardSettingsPanel.js`
  - Exposes separate Home, Activity, and Members show/hide controls.
  - Exposes separate Home, Activity, and Members reorder controls.

- Removed temporary bridge CSS:
  - `app/activity-workspace-prep.css` deleted.
  - Layout no longer imports it.

## Remaining Work

### 1. Wire `components/DashboardClient.js`

This file is currently the main blocker because it owns:

- `MOBILE_TABS`
- `WORKSPACE_TAB_META`
- active tab state
- home section map
- mobile tab panels
- `DesktopDashboardView` props

Required changes:

```js
import {
  DASHBOARD_WORKSPACE_TABS,
  HOME_WORKSPACE_KEYS,
  ACTIVITY_WORKSPACE_KEYS,
  MEMBERS_WORKSPACE_KEYS,
  WORKSPACE_TAB_META,
} from "@/components/dashboard/workspaceModel";
```

Replace local tab constants with the shared model:

```js
const MOBILE_TABS = DASHBOARD_WORKSPACE_TABS;
```

Ensure metadata includes `activity` from `WORKSPACE_TAB_META`.

### 2. Split section maps

Current Home owns too many sections. The proper shape should be:

```js
const homeSections = {
  intelligence: <... />,
  stats: <... />,
  quickActions: <... />,
};

const activitySections = {
  activity: <AuditTimeline ... />,
  warns: <... />,
  raids: <... />,
  fraud: <... />,
};
```

Do not leave activity/warns/raids/fraud in `homeSections`.

### 3. Split layout keys

Use the separated preferences:

```js
const homeLayout = preferences?.layout?.home || HOME_WORKSPACE_KEYS;
const activityLayout = preferences?.layout?.activity || ACTIVITY_WORKSPACE_KEYS;
const membersLayout = preferences?.layout?.members || MEMBERS_WORKSPACE_KEYS;
```

### 4. Pass Activity into desktop renderer

```jsx
<DesktopDashboardView
  activeTab={activeTab}
  homeLayout={homeLayout}
  activityLayout={activityLayout}
  membersLayout={membersLayout}
  homeSections={homeSections}
  activitySections={activitySections}
  membersSections={membersSections}
  ...existingProps
/>
```

### 5. Add mobile Activity tab panel

Add a real panel between Members and Categories:

```jsx
<section className={`mobile-tab-panel ${activeTab === "activity" ? "active" : ""}`}>
  <div className="dashboard-activity-grid">
    {[...activityLayout]
      .filter((key, index, arr) => arr.indexOf(key) === index)
      .filter((key) => sectionVisibility[key] !== false)
      .map((key) => (
        <div key={`activity-${key}`}>{activitySections[key] || null}</div>
      ))}
  </div>
</section>
```

### 6. Add CSS for `.dashboard-activity-grid`

It should mirror `.dashboard-home-grid` / `.dashboard-members-grid` behavior:

```css
.dashboard-page-shell.density-compact .dashboard-activity-grid { gap: 12px; }
.dashboard-page-shell.density-comfortable .dashboard-activity-grid { gap: 16px; }
.dashboard-page-shell.density-spacious .dashboard-activity-grid { gap: 22px; }
.dashboard-activity-grid { display: grid; align-items: start; overflow: visible; }
```

### 7. Validation checklist

After wiring `DashboardClient.js`, verify:

- Bottom nav shows Home / Tickets / Members / Activity / Categories.
- Home does not render Activity Feed, Warns, Raids, or Fraud.
- Activity tab renders all four signal panels.
- Advanced Customization can hide/reorder Activity sections independently.
- Saved profiles from older builds still load.
- Desktop tabs and mobile tabs match.
- No `Signals` scroll-jump behavior remains.
- No activity bridge CSS returns.

## Recommended Follow-Up

`DashboardClient.js` should be split into smaller files before future major UI changes:

```text
components/dashboard/DashboardHomeWorkspace.js
components/dashboard/DashboardActivityWorkspace.js
components/dashboard/DashboardTicketsWorkspace.js
components/dashboard/DashboardMembersWorkspace.js
components/dashboard/DashboardCategoryWorkspace.js
components/dashboard/useDashboardTicketControls.js
components/dashboard/useDashboardMaintenanceActions.js
```

This will prevent future UI changes from requiring risky 3,000-line full-file edits.
