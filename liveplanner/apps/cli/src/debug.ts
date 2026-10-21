// The CLI's debug lines (docs/specs/015-api/blueprints/cli.md "Observability"): `[cli] …` fingerprints on
// stderr, only under LIVEPLANNER_DEBUG=1 (CLI44), so stdout stays data and a quiet run stays quiet.

import type { CliIo } from './io';

export type DebugLog = (line: string) => void;

export function debugLog(io: CliIo, scope = 'cli'): DebugLog {
  return io.env.LIVEPLANNER_DEBUG === '1' ? (line) => io.stderr(`[${scope}] ${line}\n`) : () => {};
}
