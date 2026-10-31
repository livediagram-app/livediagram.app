// An app Worker's side of the Community service (liveworkspace/docs/specs/007-community/community.md "App routes"):
// the calls every app's api makes to the service's `/app/*` routes, the copier hash, and the app's own off switch.
// The posts, likes, copies and reports live at the service; each app keeps its documents and tells the service what
// only it knows: who may publish, where a document stands, and who copied it. Every call carries the app's
// COMMUNITY_KEY as a bearer token and names the app. Server-side only (the `./app` entry), so no page loads it.

import type { CommunityApp } from '../apps';
import { COMMUNITY_KEY_HEADER } from '../post';
import {
  COMMUNITY_API_URL,
  COMMUNITY_APP_HEADER,
  type CommunityAppPostResponse,
  type CommunityAppPublish,
  type CommunityAppSync,
} from '../service';

// What an app's api Worker reads to reach the service ("Configuring an app").
export type CommunityAppEnv = {
  // The app's own off switch: false, 0 or off turns its Community off; unset leaves it on.
  COMMUNITY_ENABLED?: string;
  // The service's API; unset means production's.
  COMMUNITY_URL?: string;
  // The app's key on the service (a secret); unset, the app has no Community to publish to.
  COMMUNITY_KEY?: string;
};

const OFF = new Set(['false', '0', 'off']);

// The app's remote off switch ("Turning the Community off"): read on every request, so changing the variable takes
// effect without a redeploy.
export function communityEnabled(env: Pick<CommunityAppEnv, 'COMMUNITY_ENABLED'>): boolean {
  return !OFF.has(env.COMMUNITY_ENABLED?.trim().toLowerCase() ?? '');
}

// Whether this deploy talks to the service at all: a deployment without the key has no Community.
export function communityServiceConfigured(env: Pick<CommunityAppEnv, 'COMMUNITY_KEY'>): boolean {
  return Boolean(env.COMMUNITY_KEY);
}

// Both at once: the Community is on and has a service to stand on (`communityEnabled` in /api/capabilities).
export function communityOn(env: CommunityAppEnv): boolean {
  return communityEnabled(env) && communityServiceConfigured(env);
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Who copied, as the service counts them: a one-way hash, since a guest's owner id is its credential.
export async function copierHash(ownerId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`community-copier:${ownerId}`),
  );
  return hex(digest);
}

// The page's community key, passed on to My Shares so its hearts show as that browser left them.
export function communityKeyHeaders(request: Request): Record<string, string> {
  const key = request.headers.get(COMMUNITY_KEY_HEADER);
  return key ? { [COMMUNITY_KEY_HEADER]: key } : {};
}

export type CommunityAppCall = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export type CommunityAppClient = {
  readonly app: CommunityApp;
  // One call to the service's app routes. Throws when it cannot be reached; the caller decides what that means.
  call(env: CommunityAppEnv, path: string, init?: CommunityAppCall): Promise<Response>;
  // The post a document has, as its owner sees it, or null. Throws on any answer but 200.
  getPost(
    env: CommunityAppEnv,
    documentId: string,
    ownerId: string,
  ): Promise<CommunityAppPostResponse['post']>;
  publishPost(
    env: CommunityAppEnv,
    documentId: string,
    publish: CommunityAppPublish,
  ): Promise<Response>;
  removePost(env: CommunityAppEnv, documentId: string, ownerId: string): Promise<Response>;
  // Where documents stand, and the ones gone for good.
  sync(env: CommunityAppEnv, sync: CommunityAppSync): Promise<Response>;
  // A copy taken through a post's link counts toward its copy count. Best effort and off the response path: a
  // failure is logged, never the copy's.
  countCopy(env: CommunityAppEnv, documentId: string, copierId: string, ip: string): Promise<void>;
  // An account deleted: the copies it took stop counting. Best effort, like the copy itself.
  forgetCopier(env: CommunityAppEnv, ownerId: string): Promise<void>;
  // A guest's work moved to their account: their copies are the account's, one copier for a post both copied.
  mergeCopier(env: CommunityAppEnv, fromId: string, toId: string): Promise<void>;
};

const doc = (documentId: string) => `/documents/${encodeURIComponent(documentId)}`;
const owner = (ownerId: string) => `?owner=${encodeURIComponent(ownerId)}`;

// The client one app's api uses: every call names `app`.
export function communityAppClient(app: CommunityApp): CommunityAppClient {
  const call: CommunityAppClient['call'] = (env, path, init = {}) =>
    fetch(`${env.COMMUNITY_URL || COMMUNITY_API_URL}/app${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${env.COMMUNITY_KEY ?? ''}`,
        [COMMUNITY_APP_HEADER]: app,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

  // A best-effort write: skipped without a service, and a failure only logged.
  const bestEffort = async (
    env: CommunityAppEnv,
    what: string,
    path: string,
    body: () => Promise<unknown>,
  ): Promise<void> => {
    if (!communityServiceConfigured(env)) return;
    try {
      await call(env, path, { method: 'POST', body: await body() });
    } catch (err) {
      console.warn(`[community] ${what} failed`, err);
    }
  };

  return {
    app,
    call,
    async getPost(env, documentId, ownerId) {
      const res = await call(env, `${doc(documentId)}${owner(ownerId)}`);
      if (!res.ok) throw new Error(`community service answered ${res.status}`);
      const body: CommunityAppPostResponse = await res.json();
      return body.post;
    },
    publishPost: (env, documentId, publish) =>
      call(env, doc(documentId), { method: 'PUT', body: publish }),
    removePost: (env, documentId, ownerId) =>
      call(env, `${doc(documentId)}${owner(ownerId)}`, { method: 'DELETE' }),
    sync: (env, sync) => call(env, '/sync', { method: 'POST', body: sync }),
    countCopy: (env, documentId, copierId, ip) =>
      bestEffort(env, 'copy count', '/copies', async () => ({
        document: documentId,
        copier: await copierHash(copierId),
        ip,
      })),
    forgetCopier: (env, ownerId) =>
      bestEffort(env, 'forget copier', '/copiers/forget', async () => ({
        copier: await copierHash(ownerId),
      })),
    mergeCopier: (env, fromId, toId) =>
      bestEffort(env, 'merge copier', '/copiers/merge', async () => ({
        from: await copierHash(fromId),
        to: await copierHash(toId),
      })),
  };
}
