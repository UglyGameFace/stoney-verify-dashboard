# Dank Shield Dashboard Command Center V2

_Last updated: 2026-06-12_

This is the product standard for making the Dank Shield dashboard easier, faster, clearer, and more accessible than Ticket Tool without copying Ticket Tool.

## Product goal

The dashboard must answer three questions immediately:

```text
Is the bot connected?
Is this server ready?
What do I press next?
```

A new server owner should not have to understand internal bot setup, command history, Discord role hierarchy, forms, Supabase, or Ticket Tool migration details before they can post a working support panel.

## Required first-screen workflow

The first staff screen after login must follow this order:

```text
Choose Server
Bot Installed / Online
Setup Health
Next Fix
Post or Test Panel
```

Home and Server pages must not duplicate each other. Home is the command center for the selected server. Servers is only for choosing or inviting the bot.

## Public command center sections

The dashboard should group work into a small set of owner-friendly sections:

```text
Setup Health
Tickets
Verification
Protection
Logs
Members
Dashboard Sync
```

Do not start with a wall of settings. Start with health, blockers, and the next best action.

## Accessibility floor

The dashboard must stay usable for visually impaired users, tired users, mobile users, tablet users, and landscape users.

Minimum visual standard:

```text
Body text: 16px or larger
Important labels: 18px or larger
Buttons and selects: 56px touch target on mobile/tablet
Sidebar links: 48px minimum
Primary actions: large, high contrast, obvious
Focus rings: visible on keyboard navigation
Reduced motion: honored
High contrast: honored
```

Avoid tiny low-contrast helper text as the only source of meaning.

## Device layouts

### Desktop and large landscape

Use a stable command-center layout:

```text
Left: navigation and selected server
Center: setup health and main work
Right or below: live preview, fixes, logs, recent activity
```

### Tablet landscape

Keep navigation visible or provide a clear compact rail. Do not force users into a narrow phone layout while they are holding a tablet sideways.

### Tablet portrait and phone portrait

Use one task per screen:

```text
Server
Health
Tickets
Verification
Protection
Launch
```

No horizontal scrolling. No tiny icon-only critical actions.

### Phone landscape

Use a compact split view when there is enough width, otherwise stack content with sticky bottom actions.

## Forms rule

Forms are optional.

Basic ticket panels must work without forms. The dashboard may recommend forms, but it must never block basic ticket setup just because no form questions exist.

Preferred language:

```text
Forms are optional. Basic ticket panels work without forms.
```

Bad language:

```text
Finish forms before tickets work.
```

## Categories vs menu options rule

Always separate these concepts:

```text
Discord Categories
Actual Discord channel folders such as ACTIVE TICKETS or TICKET ARCHIVE.
```

```text
Ticket Menu Options
Choices members click, such as Support, Appeal, Report User, or Verification.
```

Never use category language when you mean menu options.

## Bot install detection rule

Do not show "Install bot first" unless the dashboard truly knows the bot is absent from that server.

Preferred states:

```text
Bot installed
Bot online
Bot role position OK
Missing permission: Manage Roles
Could not confirm bot status — retry
```

Avoid false warnings after the bot is already active.

## Primary action rule

Every command-center screen should have one obvious primary action:

```text
Continue Setup
Fix Missing Permission
Post Ticket Panel
Test Ticket Flow
Open Dashboard Sync
```

Do not put destructive actions beside normal actions. Delete, reset, and overwrite actions belong in a danger zone with confirmation.

## Ticket Tool comparison target

Ticket Tool is fast for experienced admins because it groups settings into cards. Dank Shield should keep that speed, but improve it with:

```text
larger text
higher contrast
one clear next action
real setup health
bot-dashboard sync truth
mobile/tablet layouts
forms optional by default
public-safe permissions
```

## Launch gate

Before calling the dashboard public-ready, run:

```text
npm run typecheck
npm run ux:audit
npm run build
```

Then complete a live test on:

```text
phone portrait
phone landscape
tablet portrait
tablet landscape
desktop landscape
```
