/*
 * Legacy single-server helper guard.
 *
 * This dashboard repository used to include a small Discord helper bot for one
 * private server. Dank Shield is now moving toward public multi-server use, so
 * this file must not silently run as the production bot.
 *
 * The public bot must live in the real Dank Shield bot service, where every
 * action is guild-scoped, setup-driven, and safe for many servers.
 */

const LEGACY_ENABLED = String(process.env.LEGACY_SINGLE_GUILD_HELPER_ENABLED || "").trim().toLowerCase() === "true"

function printGuard() {
  console.error("Dank Shield legacy helper bot is disabled.")
  console.error("")
  console.error("Why:")
  console.error("- This old helper was designed for one server only.")
  console.error("- Public Dank Shield must support many servers safely.")
  console.error("- Single GUILD_ID / TICKET_CATEGORY_ID bot logic can create cross-server mistakes.")
  console.error("")
  console.error("Use the real multi-server Dank Shield bot service for production.")
  console.error("")
  console.error("If you are intentionally doing a local legacy audit, set:")
  console.error("LEGACY_SINGLE_GUILD_HELPER_ENABLED=true")
  console.error("")
  console.error("Even with that flag, this guard does not run old ticket/member actions.")
  console.error("Move any needed behavior into the real multi-server bot with guild-scoped config first.")
}

if (!LEGACY_ENABLED) {
  printGuard()
  process.exit(1)
}

printGuard()
process.exit(1)
