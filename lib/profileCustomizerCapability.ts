const TRUE_VALUES = new Set(["1", "true", "yes", "y", "on", "enabled"]);

function clean(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function profileCustomizerBotCommandsEnabled(): boolean {
  return TRUE_VALUES.has(clean(process.env.PROFILE_CUSTOMIZER_BOT_COMMANDS_ENABLED));
}

export function profileCustomizerBotCommandsUnavailablePayload() {
  return {
    ok: false,
    error: "Profile Customizer bot actions are not enabled on this deployment yet.",
    error_code: "profile_customizer_bot_actions_disabled",
    retryable: false,
    needsBotWorkerUpgrade: true,
    how_to_fix:
      "Deploy the production bot worker handlers for post_profile_customizer_panel, sync_profile_roles, and reset_member_profile_roles, then set PROFILE_CUSTOMIZER_BOT_COMMANDS_ENABLED=true for the dashboard deployment.",
  };
}
