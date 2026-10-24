// The api client a command uses (blueprint CLI45): @liveworkspace/cli-kit's, sending liveplanner's client header and
// User-Agent.

import type { CliIo } from './io';
import type { DebugLog } from './debug';
import { transport as transportOf, type Transport } from '@liveworkspace/cli-kit/transport';
import { PRODUCT } from './product';

export type { Transport };

export const transport = (io: CliIo, apiBase: string, log: DebugLog): Transport =>
  transportOf(io, apiBase, log, PRODUCT);
