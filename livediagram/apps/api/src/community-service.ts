// livediagram's side of the liveworkspace Community service (liveworkspace/docs/specs/007-community/community.md; docs/specs/025-community/
// community.md). The posts, likes, copies and reports live there; each canvas keeps its own post's link
// (document-room/community-post.ts), and tells the service what only it knows: who may publish, where its canvas
// stands, and who copied it. Every call carries COMMUNITY_KEY as a bearer token and names this app.

import {
  COMMUNITY_API_URL,
  COMMUNITY_APP_HEADER,
  COMMUNITY_KEY_HEADER,
  sha256Hex,
  type CommunityAppPostResponse,
  type CommunityAppPublish,
} from '@livediagram/api-schema';
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

// The page's community key, passed on to My Shares so its hearts show as that browser left them.
export function communityKeyHeaders(request: Request): Record<string, string> {
  const key = request.headers.get(COMMUNITY_KEY_HEADER);
  return key ? { [COMMUNITY_KEY_HEADER]: key } : {};
}
