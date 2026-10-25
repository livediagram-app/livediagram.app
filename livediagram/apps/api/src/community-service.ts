// livediagram's side of the liveworkspace Community service (liveworkspace/docs/community.md; docs/specs/025-community/
// community.md). The posts, likes, copies and reports live there; this api keeps the documents and their community
// links (db/community-links.ts), and tells the service what only it knows: who may publish, where each post's document
// stands, and who copied it. Every call carries COMMUNITY_KEY as a bearer token and names this app.
//
// The sync keeps the two in step. Right after a change to a document (trash, restore, purge, a move into or out of a
// team, a share password, an account deleted) the change's own request sends that document's state; a cron sends
// whatever is still pending every minute and pulls the posts the service hid after reports, so a hidden post's link
// closes within the minute.

import {
  COMMUNITY_API_URL,
  COMMUNITY_APP_HEADER,
  COMMUNITY_KEY_HEADER,
  COMMUNITY_SYNC_MAX,
  sha256Hex,
  type CommunityAppHiddenResponse,
  type CommunityAppPostResponse,
  type CommunityAppPublish,
  type CommunityAppSync,
} from '@livediagram/api-schema';
import {
  latestCommunityHide,
  markCommunityHidden,
  markCommunitySynced,
  pendingCommunitySync,
} from './db/community-links';
import type { Env } from './types';

export const COMMUNITY_APP = 'livediagram.app';

// Whether this deploy talks to the service at all: a deployment without the key has no Community.
export function communityServiceConfigured(env: Pick<Env, 'COMMUNITY_KEY'>): boolean {
  return Boolean(env.COMMUNITY_KEY);
}

// One call to the service's app routes. Throws when it cannot be reached; the caller decides what that means.
export async function communityService(
  env: Env,
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<Response> {
  const base = env.COMMUNITY_URL || COMMUNITY_API_URL;
  return fetch(`${base}/app${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${env.COMMUNITY_KEY ?? ''}`,
      [COMMUNITY_APP_HEADER]: COMMUNITY_APP,
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

// The post a document has, as its owner sees it, or null.
export async function getServicePost(
  env: Env,
  documentId: string,
  ownerId: string,
): Promise<CommunityAppPostResponse['post']> {
  const res = await communityService(
    env,
    `/documents/${encodeURIComponent(documentId)}?owner=${encodeURIComponent(ownerId)}`,
  );
  if (!res.ok) throw new Error(`community service answered ${res.status}`);
  const body: CommunityAppPostResponse = await res.json();
  return body.post;
}

export function publishServicePost(
  env: Env,
  documentId: string,
  publish: CommunityAppPublish,
): Promise<Response> {
  return communityService(env, `/documents/${encodeURIComponent(documentId)}`, {
    method: 'PUT',
    body: publish,
  });
}

export function removeServicePost(
  env: Env,
  documentId: string,
  ownerId: string,
): Promise<Response> {
  return communityService(
    env,
    `/documents/${encodeURIComponent(documentId)}?owner=${encodeURIComponent(ownerId)}`,
    { method: 'DELETE' },
  );
}

// Who copied, as the service counts them: a one-way hash, since a guest's owner id is its credential.
export async function copierHash(ownerId: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(`community-copier:${ownerId}`));
}

// A copy taken through a Community post's link counts toward its copy count (docs/specs/025-community/community.md
// "Likes"). Best effort and off the response path: a failure is logged, never the copy's.
export async function countCommunityCopy(
  env: Env,
  documentId: string,
  copierId: string,
  ip: string,
): Promise<void> {
  if (!communityServiceConfigured(env)) return;
  try {
    await communityService(env, '/copies', {
      method: 'POST',
      body: { document: documentId, copier: await copierHash(copierId), ip },
    });
  } catch (err) {
    console.warn('[community] copy count failed', err);
  }
}

// An account deleted: the copies it took stop counting. Best effort, like the copy itself.
export async function forgetCommunityCopier(env: Env, ownerId: string): Promise<void> {
  if (!communityServiceConfigured(env)) return;
  try {
    await communityService(env, '/copiers/forget', {
      method: 'POST',
      body: { copier: await copierHash(ownerId) },
    });
  } catch (err) {
    console.warn('[community] forget copier failed', err);
  }
}

// A guest's work moved to their account: their copies are the account's, one copier for a post both copied.
export async function mergeCommunityCopier(env: Env, fromId: string, toId: string): Promise<void> {
  if (!communityServiceConfigured(env)) return;
  try {
    await communityService(env, '/copiers/merge', {
      method: 'POST',
      body: { from: await copierHash(fromId), to: await copierHash(toId) },
    });
  } catch (err) {
    console.warn('[community] merge copier failed', err);
  }
}

// Send the service whatever has changed about the posts' documents: one document's (right after a change to it) or
// every pending one (the cron), a batch at a time. Then, on the cron, hear which posts it hid after reports. Never
// throws: what fails stays pending for the next run.
export async function syncCommunity(env: Env, documentId?: string): Promise<void> {
  if (!communityServiceConfigured(env)) return;
  try {
    for (let round = 0; round < SYNC_ROUNDS; round++) {
      const pending = await pendingCommunitySync(env, COMMUNITY_SYNC_MAX, documentId);
      if (pending.length === 0) break;
      const sync: CommunityAppSync = { documents: [], gone: [] };
      for (const { documentId: document, state } of pending) {
        if (state === 'gone') sync.gone.push(document);
        else sync.documents.push({ document, state });
      }
      const res = await communityService(env, '/sync', { method: 'POST', body: sync });
      if (!res.ok) throw new Error(`community sync answered ${res.status}`);
      await markCommunitySynced(env, pending);
      if (pending.length < COMMUNITY_SYNC_MAX) break;
    }
    if (documentId) return;
    const since = await latestCommunityHide(env);
    const res = await communityService(env, `/hidden?since=${since}`);
    if (!res.ok) throw new Error(`community hidden answered ${res.status}`);
    const body: CommunityAppHiddenResponse = await res.json();
    await markCommunityHidden(env, body.hidden);
  } catch (err) {
    console.warn('[community] sync failed', err);
  }
}

// A run sends at most this many batches; a bigger backlog finishes on the next.
const SYNC_ROUNDS = 10;

// The page's community key, passed on to My Shares so its hearts show as that browser left them.
export function communityKeyHeaders(request: Request): Record<string, string> {
  const key = request.headers.get(COMMUNITY_KEY_HEADER);
  return key ? { [COMMUNITY_KEY_HEADER]: key } : {};
}
