// liveworkspace's index as this api reaches it (liveworkspace/docs/one-explorer.md, one-explorer-contracts.md):
// where every document is and who may open it. The grant check, the grant fetched for a caller that has none, and the
// clients are @liveworkspace/index-app's, bound here to livedocuments; this file names them as the api has always
// called them.

import {
  createIndexService,
  indexApiUrl,
  linkCodeOf,
  type GrantCaller,
  type GrantOutcome,
  type ItemGrant,
} from '@liveworkspace/index-app';
import type {
  IndexAppClient,
  IndexClient,
  ShareAccess,
} from '@liveworkspace/index-client';
import type { Env } from './types';

export { indexApiUrl, linkCodeOf };
export type { GrantCaller, GrantOutcome } from '@liveworkspace/index-app';

export const INDEX_APP = 'livedocuments' as const;

export const indexService = createIndexService(INDEX_APP);

// A document grant as a request carries it.
export type DocumentGrant = ItemGrant;

export const setGrantVerifierForTests = indexService.setGrantVerifierForTests;
export const clearGrantCacheForTests = indexService.clearGrantCacheForTests;

export { itemGrantOf as documentGrantOf } from '@liveworkspace/index-app';

export const requestGrant = (
  env: Env,
  caller: GrantCaller,
  documentId: string,
  share: ShareAccess | null,
): Promise<GrantOutcome> => indexService.requestGrant(env, caller, documentId, share);

// The index as a caller reaches it: delegated with this app's key, or with the browser's own bearer.
export const indexFor: (env: Env, caller: GrantCaller) => IndexClient | null =
  indexService.clientFor;

// What a document pushes (document-outbox.ts): its summary, each tab's comments and actions, its Timeline events.
export const indexAppClient = (
  env: Pick<Env, 'INDEX_ORIGIN' | 'INDEX_KEY'>,
): IndexAppClient | null => indexService.appClient(env);
