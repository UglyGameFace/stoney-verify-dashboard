# Repair patches

These are the clean drop-in replacement source files for the member profile repair work.

## Included in this clean patch bundle

- `app/api/discord/member-details/route.js` <- `member-details.route.fixed.js`

## Already updated on main

- `components/dashboard/MemberSnapshot.tsx`

## What this clean bundle fixes

- member profile modal locking and contained scrolling
- passthrough of stored member fields in the member-details route
- better profile rendering for stored entry-path data such as:
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

If “How They Got In” is still sparse after replacing the route file, your bot/database is still not writing enough entry-path fields onto the member row. The UI can only show what exists in storage.
