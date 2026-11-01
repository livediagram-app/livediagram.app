// The CLI's debug lines (docs/specs/015-api/blueprints/cli.md "Observability"): @liveworkspace/cli-kit's, on
// stderr only under LIVEHUDDLE_DEBUG=1 (CLI44). A repository
// link's modules print under their own scope, `[sync] …` and `[link] …` (repository-link blueprint RL33).

import type { CliIo } from './io';
import { debugLog as debugLogOf, type DebugLog } from '@liveworkspace/cli-kit/debug';
import { PRODUCT } from './product';

export type { DebugLog };

export const debugLog = (io: CliIo, scope = 'cli'): DebugLog => debugLogOf(io, PRODUCT, scope);
