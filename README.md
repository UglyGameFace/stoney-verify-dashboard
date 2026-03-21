# Stoney Verify Dashboard V3.8

A production-oriented dashboard and Discord bot system for managing verification, tickets, moderation workflows, member visibility, and role sync for the Stoney Verify server.

---

## Overview

Stoney Verify Dashboard is split into two connected parts:

- **Dashboard** — a Next.js app used by staff and members
- **Bot** — a Discord bot worker that processes queued actions, creates ticket channels, syncs members, and keeps dashboard state accurate

The system is designed so staff get a full moderation/control experience, while average users only see a safe personal dashboard with their own verification and ticket information.

---

## Feature Highlights

### Staff Dashboard
- Discord OAuth authentication
- live ticket queue and ticket actions
- member search and member snapshots
- role hierarchy viewer
- moderation helpers
- raid / fraud / audit visibility
- ticket categories and category mapping
- transcript-aware delete flow
- role sync and member reconcile tools

### Member Dashboard
- personal verification status
- personal ticket history
- member-safe support categories
- dashboard-triggered support requests
- user-safe refresh flow for ticket visibility

### Bot / Worker System
- command queue processing through `bot_commands`
- Discord ticket channel creation
- ticket close / reopen / assign / delete support
- transcript handling
- active ticket channel sync
- member sync
- role member sync
- departed member reconciliation

### Platform / Ops
- Supabase persistence
- environment validation
- migration support
- Vercel-ready dashboard deployment
- bot runtime separated from dashboard runtime

---

## Architecture

### Dashboard
The dashboard is responsible for:

- Discord OAuth login
- staff-only views and tools
- member-safe personal dashboard views
- ticket category management
- queueing bot actions through database commands
- rendering ticket/member/state data from Supabase

### Bot
The bot is responsible for:

- polling `bot_commands`
- executing queued actions
- creating Discord ticket channels
- syncing ticket state back to the database
- managing member and role sync tasks
- transcript-aware ticket deletion flows

### Database
Supabase stores:

- tickets
- ticket categories
- bot commands
- member state
- roles and role rules
- audit logs
- verification records
- moderation-related state

---

## Ticket Flow

Dashboard-created tickets follow this flow:

1. a user or staff action queues a `create_ticket` command in `bot_commands`
2. the Discord bot worker picks up that command
3. the bot creates the Discord ticket channel
4. the bot inserts or updates the matching row in `tickets`
5. the dashboard reads from `tickets` and shows the result to the correct viewer

This allows the dashboard and bot to stay loosely coupled while still keeping ticket state visible in the UI.

---

## Project Structure

```text
app/
  api/
    dashboard/
    ticket-categories/
    user/
  page.js

components/
  DashboardClient.js
  UserDashboardClient.js
  Topbar.js
  AuthStatus.js

lib/
  auth-server.js
  env.js
  priority.js
  supabase-server.js
  useDashboardPreferences.js

bot/
  workers / services / sync flows
