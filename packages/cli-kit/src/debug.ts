// A CLI's debug lines (blueprint "Observability"): `[cli] …` fingerprints on stderr, only under <PREFIX>_DEBUG=1
// (CLI44), so stdout stays data and a quiet run stays quiet. A module may print under its own scope (`[sync] …`).

import type { CliIo } from './io';
import type { CliProduct } from './product';

export type DebugLog = (line: string) => void;

export function debugLog(
  io: CliIo,
  product: Pick<CliProduct, 'envPrefix'>,
  scope = 'cli',
): DebugLog {
  return io.env[`${product.envPrefix}_DEBUG`] === '1'
    ? (line) => io.stderr(`[${scope}] ${line}\n`)
    : () => {};
}
