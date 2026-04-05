MemberTicketThreadClient wiring notes:

Target file:
- components/MemberTicketThreadClient.js

What to add:
1. Accept a ticketActivity prop.
2. Render a clean activity timeline using the normalized event rows.
3. Keep thread messages and activity visually distinct.
4. Show actor_name, title, description, created_at, and channel_name when present.
5. Use compact spacing for mobile so the thread remains readable.
6. Do not break current reply and transcript behaviors.
