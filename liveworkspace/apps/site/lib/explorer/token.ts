// Who the Explorer asks the index as (liveworkspace/docs/site.md "The Explorer"): the token accounts hands this
// site for its session's account, or for the browser's guest (GET /api/auth/workspace-token, same origin). One
// request per page load, then one a minute before each runs out; callers waiting meanwhile share it.
//
// On an app's own address (page-app.ts) the page is that app's, so it asks as the app does: the account the app's
// session names, else the app's guest token (its handoff when it has none), both of which the index accepts.

import type { AppName } from '@liveworkspace/sites';
import { ACCOUNT_ROUTE } from '@liveworkspace/sites/workspace-proxy';
import { appAccount, appGuestTokens } from './app-session';
import { pageApp } from './page-app';

export type WorkspaceIdentity = {
  token: string;
  kind: 'account' | 'guest';
  // `user_…` or `guest_…`.
  sub: string;
  expiresAt: number;
};

export const WORKSPACE_TOKEN_URL = '/api/auth/workspace-token';
// Asked for again this long before it runs out.
const RENEW_BEFORE_MS = 60_000;

let current: WorkspaceIdentity | null = null;
let pending: Promise<WorkspaceIdentity | null> | null = null;

async function appIdentity(app: AppName): Promise<WorkspaceIdentity | null> {
  const account = await appAccount();
  if (account) {
    return {
      token: account.token,
      kind: 'account',
      sub: account.sub || subOf(account.token),
      expiresAt: account.expiresAt,
    };
  }
  // Waits for good while the page leaves for the app's guest handoff, which comes back here.
  const guest = await appGuestTokens(app).ensureGuestToken();
  return guest
    ? { token: guest.token, kind: 'guest', sub: guest.id, expiresAt: guest.expiresAt }
    : null;
}

/** A token's `sub`, read without checking it (the index checks it on every request). */
function subOf(token: string): string {
  try {
    const part = token.split('.')[1] ?? '';
    const claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as {
      sub?: unknown;
    };
    return typeof claims.sub === 'string' ? claims.sub : '';
  } catch {
    return '';
  }
}

function fetchIdentity(): Promise<WorkspaceIdentity | null> {
  const app = pageApp();
  if (app) return appIdentity(app);
  return fetch(WORKSPACE_TOKEN_URL, { credentials: 'same-origin', cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) return null;
      const body = (await res.json()) as Partial<WorkspaceIdentity>;
      if (typeof body.token !== 'string' || typeof body.sub !== 'string') return null;
      return {
        token: body.token,
        kind: body.kind === 'account' ? 'account' : 'guest',
        sub: body.sub,
        expiresAt: typeof body.expiresAt === 'number' ? body.expiresAt : Date.now() + 5 * 60_000,
      } satisfies WorkspaceIdentity;
    })
    .catch(() => null);
}

/** The person's identity, fresh enough to use; null when accounts can't answer. */
export function workspaceIdentity(now = Date.now()): Promise<WorkspaceIdentity | null> {
  if (current && current.expiresAt - RENEW_BEFORE_MS > now) return Promise.resolve(current);
  pending ??= fetchIdentity().then((identity) => {
    pending = null;
    if (identity) current = identity;
    return identity;
  });
  return pending;
}

/** The bearer for the index and the apps' APIs. */
export async function workspaceToken(): Promise<string | null> {
  return (await workspaceIdentity())?.token ?? null;
}

const ACCOUNT_PATH = ACCOUNT_ROUTE.target;

/** `fetch` for liveworkspace's account API (`/api/account/…`). On liveworkspace.app, as it is: the session's cookie
 *  answers it. On an app's address, the app's router forwards it from `/api/workspace/account/…`, and the person is
 *  named by this page's token (the accounts Worker's bearer door), since liveworkspace's cookie never reaches there. */
export const accountFetch: typeof fetch = async (input, init) => {
  const path = typeof input === 'string' ? input : null;
  if (!pageApp() || !path || (path !== ACCOUNT_PATH && !path.startsWith(`${ACCOUNT_PATH}/`))) {
    return fetch(input, init);
  }
  const token = await workspaceToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${ACCOUNT_ROUTE.prefix}${path.slice(ACCOUNT_PATH.length)}`, {
    ...init,
    headers,
    credentials: 'omit',
  });
};

/** For tests: forget the cached identity. */
export function resetWorkspaceIdentity() {
  current = null;
  pending = null;
}

/** The teams an account's token names (its `teams` claim); none for a guest. */
export function teamsOfToken(token: string | null): { id: string; name: string }[] {
  const part = token?.split('.')[1];
  if (!part) return [];
  try {
    const claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as {
      teams?: unknown;
    };
    if (!Array.isArray(claims.teams)) return [];
    return claims.teams.flatMap((team: unknown) => {
      const t = team as { id?: unknown; name?: unknown };
      return typeof t?.id === 'string' && typeof t.name === 'string'
        ? [{ id: t.id, name: t.name }]
        : [];
    });
  } catch {
    return [];
  }
}
