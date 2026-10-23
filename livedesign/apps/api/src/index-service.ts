// liveworkspace's index as this api reaches it (liveworkspace/docs/one-explorer.md, one-explorer-contracts.md):
// where every design is and who may open it. The grant check, the grant fetched for a caller that has none, and the
// clients are @liveworkspace/index-app's, bound here to livedesign; this file names them as the api has always
// called them.

import {
  createIndexService,
  indexApiUrl,
  linkCodeOf,
  type GrantCaller,
  type ItemGrant,
} from '@liveworkspace/index-app';
import type { GrantClaims, IndexAppClient, IndexClient } from '@liveworkspace/index-client';
import type { Env } from './types';

export { indexApiUrl, linkCodeOf };
export type { GrantCaller, GrantOutcome } from '@liveworkspace/index-app';

export const INDEX_APP = 'livedesign' as const;

export const indexService = createIndexService(INDEX_APP);

// A design grant as a request carries it.
export type DesignGrant = ItemGrant;

export const setGrantVerifierForTests = indexService.setGrantVerifierForTests;
export const clearGrantCacheForTests = indexService.clearGrantCacheForTests;

// The claims of a grant for this design, or null for a missing, forged, expired or misaddressed one.
export const verifyDesignGrant = (
  env: Pick<Env, 'INDEX_ORIGIN'>,
  token: string | null | undefined,
  designId: string,
): Promise<GrantClaims | null> => indexService.verifyGrant(env, token, designId);

export { itemGrantOf as designGrantOf } from '@liveworkspace/index-app';

export const requestGrant = indexService.requestGrant;

// The index as a caller reaches it: delegated with this app's key, or with the browser's own bearer.
export const indexFor: (env: Env, caller: GrantCaller) => IndexClient | null =
  indexService.clientFor;

// What a design pushes (design-outbox.ts): its summary, each tab's comments and actions, its Timeline events.
export const indexAppClient = (
  env: Pick<Env, 'INDEX_ORIGIN' | 'INDEX_KEY'>,
): IndexAppClient | null => indexService.appClient(env);
