// The livehuddle source the dashboard's checks scan (metric-emitters.test.ts, event-explanation.test.ts): every
// app and package but the MCP server, the CLI and the verbs only they use, which livehuddle drops (Work Tracker
// #562, #563), so their events get no charts (liveworkspace/docs/specs/008-telemetry/telemetry.md "Adding an app").
// Read from the folders, so the list holds whether those are still there or gone.

import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const REPO = resolve(__dirname, '../../../../../../livehuddle');

// The dashboard reads events, it never emits them, so the telemetry app is skipped as well.
export const SKIP = join(REPO, 'apps', 'telemetry');

const DROPPED = new Set(['apps/mcp', 'apps/cli', 'packages/agent-verbs']);

export const SCAN_ROOTS: string[] = ['apps', 'packages'].flatMap((dir) =>
  readdirSync(join(REPO, dir))
    .map((name) => `${dir}/${name}`)
    .filter((root) => !DROPPED.has(root) && statSync(join(REPO, root)).isDirectory()),
);
