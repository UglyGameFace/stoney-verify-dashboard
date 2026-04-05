Ticket detail route wiring notes:

Target file:
- app/api/tickets/[id]/route.js

What to add:
1. Import the shared helper from lib/ticketEventFeed.
2. After loading the ticket row, fetch merged activity for that ticket id.
3. Read from ticket_events first and member_events as fallback.
4. Include the merged ticket activity array in the route response.
5. Keep the response safe when ticket_events does not exist yet.
6. Preserve current ticket response fields so the dashboard does not regress.
