Portal ticket page wiring notes:

Target file:
- app/portal/tickets/[id]/page.js

What to add:
1. Read ticket activity from the ticket details route payload.
2. Pass the activity array down to the thread client component.
3. Keep existing ticket rendering unchanged.
4. Show the activity feed above or beside the thread on desktop, and stacked on mobile.
5. Preserve responsive behavior so cards do not overlap or clip.
