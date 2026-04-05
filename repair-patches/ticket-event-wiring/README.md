# Ticket Event Wiring Patch Bundle

This branch adds the shared helper live at:

- `lib/ticketEventFeed.js`

Because the current GitHub connector flow in this session can create new files cleanly but is not allowing in-place overwrite commits for existing files, this folder is the clean patch bundle for the remaining dashboard wiring work.

## Intended live file updates

These are the files that should be updated using the replacement or patch snippets in this folder:

- `app/api/user/dashboard/route.js`
- `components/UserDashboardClient.js`
- `app/api/tickets/[id]/route.js`
- `app/portal/tickets/[id]/page.js`
- `components/MemberTicketThreadClient.js`

## What the wiring adds

- recent ticket activity feed on the user dashboard
- per-ticket activity wiring for the ticket details route
- portal thread activity feed support
- fallback reading from both `ticket_events` and `member_events`
- safe handling when `ticket_events` is not present yet

## Event sources

The shared helper reads from:

1. `ticket_events`
2. `member_events`

It deduplicates merged activity and filters ticket-related rows using:

- `ticket_id`
- `source_ticket_id`
- `verification_ticket_id`
- related metadata keys

## Next step

Apply the replacement files from this patch bundle into the live paths above, then merge this branch.
