// What a host offers (blueprint "Capabilities", CLI8): from GET <host>/api/capabilities, cached an hour per
// profile. @liveworkspace/cli-kit's, for livedocuments, whose hosts name the format they store `documentFormat`.

import * as kit from '@liveworkspace/cli-kit/capabilities';
import type { DebugLog } from '../debug';
import type { CliIo } from '@liveworkspace/cli-kit/io';
import { PRODUCT } from '../product';
import type { Profile } from './profiles';

export { CAPABILITIES_CACHE_TTL_MS } from '@liveworkspace/cli-kit/capabilities';

export const loadCapabilities = (
  io: CliIo,
  profile: Profile,
  log: DebugLog,
): Promise<kit.HostCapabilities<'documentFormat'>> =>
  kit.loadCapabilities(io, PRODUCT, 'documentFormat', profile, log);
