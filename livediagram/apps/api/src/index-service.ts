// liveworkspace's index as this api reaches it (liveworkspace/docs/one-explorer.md, one-explorer-contracts.md):
// where every canvas is filed and who may open it. The grant check, the grant fetched for a caller that has none,
// and the clients are @liveworkspace/index-app's, bound here to livediagram.

import {
  createIndexService,
  indexApiUrl,
  linkCodeOf,
  type GrantCaller,
  type GrantOutcome,
} from '@liveworkspace/index-app';
import type { IndexAppClient, IndexClient, ShareAccess } from '@liveworkspace/index-client';
import type { Env } from './types';

export { indexApiUrl, linkCodeOf };
export type { GrantCaller, GrantOutcome, ItemGrant } from '@liveworkspace/index-app';

export const INDEX_APP = 'livediagram' as const;

export const indexService = createIndexService(INDEX_APP);

export const setGrantVerifierForTests = indexService.setGrantVerifierForTests;
export const clearGrantCacheForTests = indexService.clearGrantCacheForTests;

export const requestGrant = (
  env: Env,
  caller: GrantCaller,
  documentId: string,
  share: ShareAccess | null,
): Promise<GrantOutcome> => indexService.requestGrant(env, caller, documentId, share);

// The index as a caller reaches it: delegated with this app's key, or with the browser's own bearer. Null when no
// index is configured.
export const indexFor = (env: Env, caller: GrantCaller): IndexClient | null =>
  indexService.clientFor(env, caller);

// What a document pushes (document-outbox.ts): its summary, each tab's comments and actions, its Timeline events.
export const indexAppClient = (
  env: Pick<Env, 'INDEX_ORIGIN' | 'INDEX_KEY'>,
): IndexAppClient | null => indexService.appClient(env);
