UserDashboardClient wiring notes:

1. Accept recentTicketEvents from the dashboard API payload.
2. Render a Recent Ticket Activity card on both desktop and mobile layouts.
3. Use the shared normalized fields from lib/ticketEventFeed:
   - id
   - created_at
   - title
   - description
   - event_type
   - event_family
   - ticket_id
   - actor_name
   - channel_name
4. Keep the card compact and scroll-safe on mobile.
5. Link each event back to the matching ticket when ticket_id is present.
6. Show a friendly empty state when there are no ticket events yet.
