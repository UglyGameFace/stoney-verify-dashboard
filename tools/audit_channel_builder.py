#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

FILES = [
    'lib/channel-style/unicode-styles.ts',
    'lib/channel-style/emoji-presets.ts',
    'lib/channel-style/accessibility-warnings.ts',
    'lib/channel-style/format-channel-name.ts',
    'lib/channel-style/channel-builder-planner.ts',
    'components/channel-style/ChannelBuilderDryRunClient.tsx',
    'app/dashboard/[guildId]/channel-builder/page.tsx',
    'app/api/channel-builder/dry-run/route.ts',
    'app/api/channel-builder/channels/route.ts',
    'app/api/channel-builder/preflight/route.ts',
    'app/api/channel-builder/queue/route.ts',
    'app/api/channel-builder/undo/route.ts',
    'app/api/channel-builder/jobs/[jobId]/route.ts',
]

CHECKS = {
    'components/Sidebar.tsx': ['Channel Builder', 'Step 2: Channel Builder'],
    'components/channel-style/ChannelBuilderDryRunClient.tsx': [
        'Scan existing channels',
        'Queue approved job',
        'Undo this Channel Builder job',
        'rollbackAvailable',
    ],
    'app/api/channel-builder/preflight/route.ts': [
        'requireDashboardStaffSession',
        'selected_server_mismatch',
        'buildChannelBuilderDryRun',
        '/channel-builder/preflight',
        'queueable',
        'validation_errors',
    ],
    'app/api/channel-builder/queue/route.ts': [
        'requireDashboardStaffSession',
        'selected_server_mismatch',
        'buildChannelBuilderDryRun',
        'currentChannelId',
        '/channel-builder/preflight',
        'bot_preflight_failed',
        'preflight: botResponse.preflight || botPreflight.preflight',
    ],
    'app/api/channel-builder/undo/route.ts': [
        'requireDashboardStaffSession',
        'selected_server_mismatch',
        'sourceJobId',
    ],
    'lib/channel-style/channel-builder-planner.ts': [
        'currentChannelId',
        'rename_without_channel_id',
        'duplicate_target_name',
    ],
}


def main() -> int:
    for path in FILES:
        if not (ROOT / path).exists():
            print(f'missing {path}', file=sys.stderr)
            return 1
    for path, snippets in CHECKS.items():
        target = ROOT / path
        text = target.read_text(encoding='utf-8')
        for snippet in snippets:
            if snippet not in text:
                print(f'{path} missing {snippet}', file=sys.stderr)
                return 1
    print('Channel Builder audit passed')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
