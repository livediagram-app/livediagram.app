// Reply and Resolve on another app's thread from an app's Inbox (liveworkspace/docs/specs/004-index/inbox-reading.md
// "Cross-app verbs"). An app's own token is addressed to its own API alone, so the Inbox trades it, through the
// accounts' bearer door (`GET <account>/workspace-token`, by the app's router), for the workspace token every app's API
// takes: 15 minutes, never past the bearer, and only while its session is live. One trade at a time, kept until a
// minute before it runs out; a refusal (a guest, a signed-out session) answers null and the verb fails as any refused
// call does.

import type { App } from '@liveworkspace/index-client';
import { siteOfApp, siteUrlHere } from '@liveworkspace/sites';
import type { InboxApi } from './inbox-actions';

/** The workspace token, or null when none can be had. */
export type WorkspaceTokenSource = () => Promise<string | null>;

/** Asked for again this long before it runs out. */
export const WORKSPACE_TOKEN_RENEW_MS = 60_000;

export type WorkspaceTokenSourceOptions = {
  /** The bearer door's route, through this app's router: `/api/workspace/account/workspace-token`. */
  url: string;
  /** The app's own bearer for the person, read when a trade goes out. */
  bearer: () => Promise<string | null>;
  fetch?: typeof fetch;
  now?: () => number;
};

export function createWorkspaceTokenSource({
  url,
  bearer,
  fetch: doFetch,
  now = Date.now,
}: WorkspaceTokenSourceOptions): WorkspaceTokenSource {
  let held: { token: string; until: number; from: string } | null = null;
  let pending: Promise<string | null> | null = null;
  return async () => {
    const own = await bearer();
    if (!own) return null;
    // Held for the same bearer only: a person who signed in as someone else trades again.
    if (held && held.from === own && now() < held.until - WORKSPACE_TOKEN_RENEW_MS)
      return held.token;
    pending ??= (async () => {
      try {
        const res = await (doFetch ?? fetch)(url, {
          headers: { authorization: `Bearer ${own}` },
          credentials: 'omit',
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { token?: unknown; expiresAt?: unknown };
        if (typeof body.token !== 'string' || typeof body.expiresAt !== 'number') return null;
        held = { token: body.token, until: body.expiresAt, from: own };
        return body.token;
      } catch {
        return null;
      } finally {
        pending = null;
      }
    })();
    return pending;
  };
}

/** Another app's API as the person, by the workspace token, on that app's address as this page reaches it. */
export function crossAppInboxApi(
  app: App,
  token: WorkspaceTokenSource,
  doFetch?: typeof fetch,
): InboxApi {
  return async (path, init) => {
    const bearer = await token();
    if (!bearer) return new Response(null, { status: 401 });
    const headers = new Headers({ authorization: `Bearer ${bearer}` });
    if (init.body !== undefined) headers.set('content-type', 'application/json');
    return (doFetch ?? fetch)(`${siteUrlHere(siteOfApp(app))}/api${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'omit',
      signal: init.signal,
    });
  };
}
