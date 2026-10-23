// Who the Explorer asks the index as (liveworkspace/docs/site.md "The Explorer"): the token accounts hands this
// site for its session's account, or for the browser's guest (GET /api/auth/workspace-token, same origin). One
// request per page load, then one a minute before each runs out; callers waiting meanwhile share it.

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

function fetchIdentity(): Promise<WorkspaceIdentity | null> {
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
