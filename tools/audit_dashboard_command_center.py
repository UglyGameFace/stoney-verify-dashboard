from __future__ import annotations

"""Audit the Dank Shield dashboard command-center UX contract.

This is a static guard. It does not replace browser testing, but it catches the
most common regressions that made the dashboard feel worse than Ticket Tool:
confusing setup flow, forms acting required, weak mobile accessibility, tablet
landscape bloat, muddy light mode, auth-refresh reload loops, and no clear
bot/server truth model.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PACKAGE = ROOT / "package.json"
LAYOUT = ROOT / "app" / "layout.js"
SERVERS_PAGE = ROOT / "app" / "servers" / "page.tsx"
READABILITY = ROOT / "app" / "readability.css"
COMMAND_CENTER_CSS = ROOT / "app" / "command-center-v2.css"
TABLET_LANDSCAPE_CSS = ROOT / "app" / "tablet-landscape-fix.css"
LANDSCAPE_AUTH_RESCUE_CSS = ROOT / "app" / "landscape-auth-rescue.css"
SIDEBAR = ROOT / "components" / "Sidebar.tsx"
SETUP_SHELL = ROOT / "components" / "dashboard" / "SetupWorkspaceShell.tsx"
SETUP_CHECKLIST = ROOT / "components" / "dashboard" / "SetupLaunchChecklist.tsx"
STANDARD = ROOT / "docs" / "DASHBOARD_COMMAND_CENTER_V2.md"

REQUIRED_STANDARD_MARKERS = [
    "Is the bot connected?",
    "Is this server ready?",
    "What do I press next?",
    "Forms are optional",
    "Basic ticket panels must work without forms",
    "phone landscape",
    "tablet landscape",
    "visually impaired",
    "Ticket Tool comparison target",
]

REQUIRED_READABILITY_MARKERS = [
    "Dank Shield readability layer",
    "min-height: 56px",
    "@media (max-width: 1024px)",
    "@media (max-width: 720px)",
]

REQUIRED_COMMAND_CENTER_CSS_MARKERS = [
    "Dank Shield Command Center V2",
    "--ccv2-tap: 56px",
    "@media (orientation: landscape)",
    "prefers-reduced-motion",
    "prefers-contrast",
]

REQUIRED_TABLET_LANDSCAPE_MARKERS = [
    "Dank Shield tablet landscape fix",
    "--tablet-rail",
    "grid-template-columns: repeat(3, minmax(0, 1fr))",
    "-webkit-line-clamp: 2",
    "body > .quick-appearance-dock",
]

REQUIRED_LANDSCAPE_AUTH_RESCUE_MARKERS = [
    "Emergency landscape/auth UX rescue",
    ".quick-appearance-card",
    "100dvh",
    "html[data-dashboard-appearance=\"light\"]",
    "body > .quick-appearance-dock",
]

REQUIRED_SIDEBAR_MARKERS = [
    "Command Center",
    "Setup Flow",
    "Change Server",
    "Choose Server",
    "min-height: 48px",
]

REQUIRED_SETUP_MARKERS = [
    "Forms / Direct Flow",
    "severity: \"recommended\"",
    "Direct flow or smart defaults available",
    "Forms are optional",
]

FORBIDDEN_SETUP_PATTERNS = [
    "Forms are required",
    "forms are required",
    "Finish forms before tickets work",
]

FORBIDDEN_SERVERS_PAGE_PATTERNS = [
    "refreshPageSessionIfNeeded(\"/servers\")",
]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def require(label: str, text: str, marker: str, failures: list[str]) -> None:
    if marker not in text:
        failures.append(f"{label} missing marker: {marker}")


def forbid(label: str, text: str, marker: str, failures: list[str]) -> None:
    if marker in text:
        failures.append(f"{label} contains forbidden marker: {marker}")


def main() -> int:
    failures: list[str] = []

    package = read(PACKAGE)
    layout = read(LAYOUT)
    servers_page = read(SERVERS_PAGE)
    readability = read(READABILITY)
    command_center_css = read(COMMAND_CENTER_CSS)
    tablet_landscape_css = read(TABLET_LANDSCAPE_CSS)
    landscape_auth_rescue_css = read(LANDSCAPE_AUTH_RESCUE_CSS)
    sidebar = read(SIDEBAR)
    setup_shell = read(SETUP_SHELL)
    setup_checklist = read(SETUP_CHECKLIST)
    standard = read(STANDARD)

    for path in (
        PACKAGE,
        LAYOUT,
        SERVERS_PAGE,
        READABILITY,
        COMMAND_CENTER_CSS,
        TABLET_LANDSCAPE_CSS,
        LANDSCAPE_AUTH_RESCUE_CSS,
        SIDEBAR,
        SETUP_SHELL,
        SETUP_CHECKLIST,
        STANDARD,
    ):
        if not path.exists():
            failures.append(f"missing required file: {path.relative_to(ROOT)}")

    require("package.json", package, '"typecheck": "tsc --noEmit --pretty false"', failures)
    require("layout", layout, 'import "@/app/readability.css"', failures)
    require("layout", layout, 'import "@/app/command-center-v2.css"', failures)
    require("layout", layout, 'import "@/app/tablet-landscape-fix.css"', failures)
    require("layout", layout, 'import "@/app/landscape-auth-rescue.css"', failures)

    for marker in REQUIRED_STANDARD_MARKERS:
        require("dashboard command-center standard", standard, marker, failures)

    for marker in REQUIRED_READABILITY_MARKERS:
        require("readability.css", readability, marker, failures)

    for marker in REQUIRED_COMMAND_CENTER_CSS_MARKERS:
        require("command-center-v2.css", command_center_css, marker, failures)

    for marker in REQUIRED_TABLET_LANDSCAPE_MARKERS:
        require("tablet-landscape-fix.css", tablet_landscape_css, marker, failures)

    for marker in REQUIRED_LANDSCAPE_AUTH_RESCUE_MARKERS:
        require("landscape-auth-rescue.css", landscape_auth_rescue_css, marker, failures)

    for marker in REQUIRED_SIDEBAR_MARKERS:
        require("Sidebar", sidebar, marker, failures)

    setup_text = setup_shell + "\n" + setup_checklist
    for marker in REQUIRED_SETUP_MARKERS:
        require("setup flow", setup_text, marker, failures)

    for marker in FORBIDDEN_SETUP_PATTERNS:
        forbid("setup flow", setup_text, marker, failures)

    for marker in FORBIDDEN_SERVERS_PAGE_PATTERNS:
        forbid("servers page", servers_page, marker, failures)

    if "Boolean(categoryCheck?.ok) && Boolean(formCheck?.ok)" in setup_checklist:
        failures.append("SetupLaunchChecklist still makes panel commands depend on forms_configured; forms must be optional")

    if failures:
        print("Dashboard command-center audit failed:")
        for failure in failures:
            print(" -", failure)
        return 1

    print("Dashboard command-center audit passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
