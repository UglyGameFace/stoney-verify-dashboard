# Profile Customizer

Profile Customizer is the optional post-verification self-role/profile system for Dank Shield.

It is intentionally **not** a verification gate. Members should be able to verify, enter the server, and then optionally personalize their server profile.

## Product behavior

Recommended member flow:

1. Member joins.
2. Member completes verification.
3. Dank Shield grants normal verified access.
4. Dank Shield points the member to the optional Profile Customizer panel.
5. Member may choose pronouns, interests, ping roles, gaming/platform roles, vibe roles, or clear profile roles.

Default rule: **do not force personal identity disclosure before access**.

## Default panels

The centralized preset list lives in `lib/profileCustomizer.ts`.

Default panels:

- `pronouns` — optional pronoun roles with privacy-friendly choices.
- `interests` — hobby/community discovery roles.
- `pings` — notification opt-in roles.
- `gaming` — platform/game roles.
- `vibes` — cosmetic/personality roles.
- `privacy` — clear profile roles / minimal profile controls.

## Database contract

Migration file:

- `supabase/20260616_profile_customizer.sql`

Tables:

- `profile_customizer_settings`
- `profile_role_panels`
- `profile_role_options`
- `member_profile_role_choices`

Important safety fields:

- `show_after_verification` defaults to `true`.
- `require_before_access` defaults to `false`.
- `allow_user_reset` defaults to `true`.
- `audit_changes` defaults to `true`.

## Dashboard API

Route:

- `GET /api/profile-customizer/defaults`
- `POST /api/profile-customizer/defaults`

`GET` returns current stored settings/panels/options plus the central defaults.

`POST` seeds the default optional panels/options for the selected guild. It does not make pronouns required and does not block member access.

## Bot command bridge

The dashboard command queue now supports:

- `post_profile_customizer_panel`
- `sync_profile_roles`
- `reset_member_profile_roles`

These are defined in `lib/botCommands.ts`.

The production bot service should process these actions guild-scoped through `bot_commands`, then update:

- `profile_role_panels.channel_id`
- `profile_role_panels.message_id`
- `profile_customizer_settings.channel_id`
- `profile_customizer_settings.panel_message_id`
- `member_profile_role_choices`

## Production bot requirements

The real multi-server bot runtime must:

1. Read panels/options by `guild_id`.
2. Create missing Discord roles only when the server manager explicitly chooses that setup action.
3. Never require pronoun selection for access by default.
4. Support a `Prefer Not to Say` pronoun option.
5. Support a `Clear My Profile Roles` reset action.
6. Apply roles only if the bot role is above the target role.
7. Fail safely with clear staff-facing errors if permissions or role hierarchy are wrong.
8. Audit profile changes when `audit_changes=true`.
9. Keep all actions guild-scoped.
10. Avoid deleting user-created roles unless the server manager explicitly asks for cleanup.

## UI placement

Recommended channel names:

- `#customize-profile`
- `#roles-and-pronouns`
- `#start-here-optional`

Recommended panel copy:

> Customize your server profile if you want. Pronouns, interests, pings, games, and vibe roles are optional. You can skip this, change it later, or clear your profile roles anytime.

## Setup checklist

- Run `npm run migrate` with `SUPABASE_DB_URL` set.
- Seed default panels with `POST /api/profile-customizer/defaults` from a signed-in dashboard staff session.
- Add a dashboard control that selects the post-verification profile channel.
- Queue `post_profile_customizer_panel` for that selected channel.
- Implement the command in the production bot worker.
- Run a role hierarchy check before role creation/assignment.
- Test with at least two guilds to confirm no cross-server leakage.
