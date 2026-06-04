# Panel Action Bot Contract

The dashboard setup doctor can show copyable Discord commands today. One-click panel publish/doctor should only be enabled after the bot consumer supports the queued actions below.

## Why this contract exists

We do **not** want dashboard buttons that insert commands the bot ignores. Ignored commands become stuck queue items and make setup health worse.

## Required `bot_commands.action` values

Add these actions to the bot command consumer:

```text
post_ticket_panel
run_ticket_panel_doctor
```

## `post_ticket_panel` payload

```json
{
  "channel_id": "DISCORD_CHANNEL_ID",
  "mode": "post",
  "requested_from": "dashboard_setup_doctor"
}
```

Bot behavior:

1. Verify the guild matches the command row `guild_id`.
2. Verify the bot can see/send/embed/use components in `channel_id`.
3. Build the ticket panel from dashboard `ticket_categories` for that guild.
4. Post or update the panel in the target channel.
5. Write `status=completed` with a result payload containing:

```json
{
  "panel_message_id": "MESSAGE_ID",
  "channel_id": "CHANNEL_ID",
  "category_count": 4
}
```

If anything fails, write `status=failed` and a clear `error` value.

## `run_ticket_panel_doctor` payload

```json
{
  "channel_id": "DISCORD_CHANNEL_ID_OR_NULL",
  "requested_from": "dashboard_setup_doctor"
}
```

Bot behavior:

1. Verify bot permissions in the selected guild.
2. Verify configured ticket categories are valid.
3. Verify configured form/question data is valid.
4. Verify panel message exists if `channel_id` is provided.
5. Verify command queue is not stuck.
6. Write `status=completed` with a result payload containing:

```json
{
  "ok": true,
  "checks": [
    { "key": "bot_permissions", "ok": true, "detail": "Can send embeds/components" },
    { "key": "categories", "ok": true, "detail": "4 categories ready" },
    { "key": "forms", "ok": true, "detail": "4 categories covered" }
  ]
}
```

## Dashboard enablement rule

Do not expose one-click Publish/Doctor as the primary action until the bot consumer confirms both actions above. Until then, the dashboard should keep showing copyable slash commands:

```text
/ticket-panel post
/ticket-panel doctor
```

## Setup health detection

`/api/setup/health` currently looks at `bot_commands.action` values that include `panel` and `doctor`. Once the bot supports the new actions, those rows will naturally feed setup health.
