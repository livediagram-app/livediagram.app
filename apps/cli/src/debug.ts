// The CLI's debug lines (docs/specs/015-api/blueprints/cli.md "Observability"): `[cli] …` fingerprints on
// stderr, only under LIVEDIAGRAM_DEBUG=1 (CLI44), so stdout stays data and a quiet run stays quiet. A repository
// link's modules print under their own scope, `[sync] …` and `[link] …` (repository-link blueprint RL33).

import type { CliIo } from './io';

export type DebugLog = (line: string) => void;

export function debugLog(io: CliIo, scope = 'cli'): DebugLog {
  return io.env.LIVEDIAGRAM_DEBUG === '1' ? (line) => io.stderr(`[${scope}] ${line}\n`) : () => {};
}
