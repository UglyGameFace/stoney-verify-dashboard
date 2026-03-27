# Repair patches

These are drop-in replacement source files for the dashboard repair work.

## Replace these files

- `components/DashboardClient.js` <- `DashboardClient.fixed.js`
- `app/api/discord/member-details/route.js` <- `member-details.route.fixed.js`

## What these fixes address

- mobile/profile scroll and overlay issues
- member profile modal locking and contained scrolling
- recent joins fallback when `member_joins` is empty
- profile entry-path passthrough for stored member fields like:
  - `invited_by`
  - `invited_by_name`
  - `vouched_by`
  - `vouched_by_name`
  - `approved_by`
  - `approved_by_name`
  - `join_method`
  - `entry_method`
  - `verification_source`
  - `invite_code`

## Important note

If “How They Got In” is still sparse after replacing these files, your bot/database still is not writing enough entry-path fields onto the member row. The UI can only show what exists in storage.
