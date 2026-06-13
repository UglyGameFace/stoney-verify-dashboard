#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
ROUTE = ROOT / "app/api/user/tickets/create/route.js"
CLIENT = ROOT / "components/UserDashboardClient.js"

ROUTE_SNIPPETS = [
    "bot_commands",
    "create_ticket",
    "findOpenTicket",
    "findRecentCreateCommand",
    "ticket_already_open",
    "ticket_create_already_queued",
    "requested_by: viewer.discord_id",
    "category_slug",
    "member_snapshot",
    "dashboard_context",
]
CLIENT_SNIPPETS = [
    "/api/user/tickets/create",
    "existing_ticket",
    "existing_command",
    "pollForCreatedTicket",
]


def main() -> int:
    for path in (ROUTE, CLIENT):
        if not path.exists():
            print(f"missing {path.relative_to(ROOT)}", file=sys.stderr)
            return 1

    route_text = ROUTE.read_text(encoding="utf-8")
    for snippet in ROUTE_SNIPPETS:
        if snippet not in route_text:
            print(f"ticket create route missing {snippet}", file=sys.stderr)
            return 1

    client_text = CLIENT.read_text(encoding="utf-8")
    for snippet in CLIENT_SNIPPETS:
        if snippet not in client_text:
            print(f"dashboard client missing {snippet}", file=sys.stderr)
            return 1

    print("User ticket create route audit passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
