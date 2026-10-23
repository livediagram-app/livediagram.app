// The team invitations waiting for an account (liveworkspace/docs/accounts.md "The API",
// `POST /api/account/internal/invitations`), for an app's Invites view and its sidebar badge. They are
// answered on liveworkspace.app (/account/teams); an app only shows them.
//
// The Explorer asks on every load, so the answer is remembered per isolate for a short while
// (INVITATIONS_TTL_MS) and calls for the same account at the same moment share one request. The memory
// is bounded (INVITATIONS_CACHE_MAX accounts, the oldest forgotten first).

import type { ClientCredentials } from './oauth';

export interface PendingInvitation {
  // The invitation's member row id on liveworkspace.
  id: string;
  teamId: string;
  teamName: string;
  organisation: string | null;
  // Joined members of the team now.
  memberCount: number;
  role: 'admin' | 'member';
  invitedByName: string | null;
  // When it was sent (ms since the epoch).
  createdAt: number;
}

// How long an account's answer is kept. Short: an invitation answered on liveworkspace.app leaves the
// app's list within this, and a new one shows within it.
export const INVITATIONS_TTL_MS = 30_000;
// Accounts remembered per isolate.
export const INVITATIONS_CACHE_MAX = 500;

type Entry = { at: number; invitations: Promise<PendingInvitation[]> };
const cache = new Map<string, Entry>();

// For tests: forget every remembered answer.
export function __resetInvitationsCache(): void {
  cache.clear();
}

async function fetchInvitations(
  credentials: ClientCredentials,
  userId: string,
  fetcher: typeof fetch,
): Promise<PendingInvitation[]> {
  const base = credentials.accountsUrl.replace(/\/+$/, '');
  const response = await fetcher(`${base}/api/account/internal/invitations`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${credentials.clientId}:${credentials.clientSecret}`)}`,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) throw new Error(`invitations failed: ${response.status}`);
  const { invitations } = (await response.json()) as { invitations?: unknown };
  return Array.isArray(invitations) ? (invitations as PendingInvitation[]) : [];
}

// The invitations waiting for `userId` (an account id the app has verified), newest first. Throws
// when liveworkspace can't be reached or refuses; a failure is not remembered.
export function pendingInvitationsFor(
  credentials: ClientCredentials,
  userId: string,
  opts: { fetcher?: typeof fetch; now?: number } = {},
): Promise<PendingInvitation[]> {
  const now = opts.now ?? Date.now();
  const key = `${credentials.accountsUrl} ${credentials.clientId} ${userId}`;
  const held = cache.get(key);
  if (held && now - held.at < INVITATIONS_TTL_MS) return held.invitations;
  if (held) cache.delete(key);
  const invitations = fetchInvitations(credentials, userId, opts.fetcher ?? fetch);
  cache.set(key, { at: now, invitations });
  invitations.catch(() => {
    if (cache.get(key)?.invitations === invitations) cache.delete(key);
  });
  // Maps keep insertion order, so the first key is the oldest.
  while (cache.size > INVITATIONS_CACHE_MAX) cache.delete(cache.keys().next().value!);
  return invitations;
}
