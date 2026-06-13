#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "components/dashboard/DashboardDeepLinkBridge.tsx": [
        "TAB_ALIASES",
        '"test-ticket-flow": "tickets"',
        "URLSearchParams",
        "window.location.hash",
        "activateTab",
        "hashchange",
        "popstate",
    ],
    "components/dashboard/SetupLaunchChecklist.tsx": [
        "isTicketTabCheck",
        "normalizeActionHref",
        "/?tab=tickets#tickets",
        "Open Ticket Tab",
    ],
    "app/layout.js": [
        "DashboardDeepLinkBridge",
        "React.createElement(DashboardDeepLinkBridge, null)",
    ],
}


def main() -> int:
    for rel, snippets in FILES.items():
        path = ROOT / rel
        if not path.exists():
            print(f"missing {rel}", file=sys.stderr)
            return 1
        text = path.read_text(encoding="utf-8")
        for snippet in snippets:
            if snippet not in text:
                print(f"{rel} missing {snippet}", file=sys.stderr)
                return 1
    print("Dashboard deep link audit passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
