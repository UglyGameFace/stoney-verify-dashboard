User dashboard route wiring notes:

1. Import fetchRecentTicketEventsForUser from lib/ticketEventFeed.
2. After openTicket is computed, load recentTicketEvents using guildId, viewer.discord_id, and recentTickets ids.
3. Return recentTicketEvents in the JSON response body.
