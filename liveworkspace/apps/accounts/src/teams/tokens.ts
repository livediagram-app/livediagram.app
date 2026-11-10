// The secrets behind team links (teams.ts), and declining an invitation from its email.

import type { SettingsApp } from '../settings.ts';
import { teamScopes } from '../index-timeline.ts';
import {
  appOrNull,
  BUMP,
  fail,
  INVITER_APP,
  memberGuard,
  type MemberStatus,
  ok,
  type Result,
  REV,
  teamEvent,
} from './shared.ts';

// --- Tokens ---

export function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const randomSecret = () => base64url(crypto.getRandomValues(new Uint8Array(32)));

export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64url(new Uint8Array(bytes));
}

// Compares two strings without stopping at the first difference, so the time taken says nothing
// about how much of a guess was right.
function sameString(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// --- Declining from the email ---

// Each invitation email (and each reminder) carries its own decline token, "<member id>.<secret>".
// Only the secret's hash is kept, on the row; the token can decline that one invitation and read what
// became of it, nothing else.
export async function newDeclineToken(memberId: string): Promise<{ token: string; hash: string }> {
  const secret = randomSecret();
  return { token: `${memberId}.${secret}`, hash: await sha256(secret) };
}

export type DeclineStatus = 'invited' | 'declined' | 'expired' | 'joined';

interface DeclineRow {
  id: string;
  teamId: string;
  teamName: string;
  email: string;
  status: MemberStatus;
  expiredAt: number | null;
  declineTokenHashes: string;
  inviterApp: string | null;
}

// The invitation a decline token names, or null for any token that doesn't match one (unknown,
// malformed, or an invitation an admin removed or replaced), all alike.
async function declineRow(db: D1Database, token: unknown): Promise<DeclineRow | null> {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1 || token.length > 200) return null;
  const memberId = token.slice(0, dot);
  const row = await db
    .prepare(
      `SELECT m.id, m.teamId, t.name AS teamName, m.email, m.status, m.expiredAt, m.declineTokenHashes,
              ${INVITER_APP} AS inviterApp
       FROM team_member m JOIN team t ON t.id = m.teamId
       WHERE m.id = ? AND t.deletedAt IS NULL AND m.status != 'removed'`,
    )
    .bind(memberId)
    .first<DeclineRow>();
  if (!row?.declineTokenHashes) return null;
  const presented = await sha256(token.slice(dot + 1));
  let match = false;
  for (const hash of row.declineTokenHashes.split(' '))
    match = sameString(hash, presented) || match;
  return match ? row : null;
}

const declineStatus = (row: DeclineRow): DeclineStatus =>
  row.status === 'declined'
    ? row.expiredAt === null
      ? 'declined'
      : 'expired'
    : (row.status as DeclineStatus);

export async function readDeclineToken(
  db: D1Database,
  token: unknown,
): Promise<{ teamName: string; status: DeclineStatus } | null> {
  const row = await declineRow(db, token);
  return row ? { teamName: row.teamName, status: declineStatus(row) } : null;
}

// Declines the invitation a token names. Saying no twice changes nothing; an expired invitation
// stays expired; a membership can't be undone this way. `declined` is true only for the request that
// turned it down, so only that one tells the admins.
export async function declineByToken(
  db: D1Database,
  token: unknown,
  now = Date.now(),
): Promise<
  Result<{
    teamId: string;
    teamName: string;
    email: string;
    status: 'declined' | 'expired';
    declined: boolean;
    inviterApp: SettingsApp | null;
  }>
> {
  const row = await declineRow(db, token);
  if (!row) return fail(404, 'invite_not_found');
  const status = declineStatus(row);
  if (status === 'joined') return fail(409, 'already_joined');
  const base = {
    teamId: row.teamId,
    teamName: row.teamName,
    email: row.email,
    inviterApp: appOrNull(row.inviterApp),
  };
  if (status !== 'invited') return ok({ ...base, status, declined: false });
  const [, changed] = await db.batch<unknown>([
    db.prepare(BUMP),
    db
      .prepare(
        `UPDATE team_member SET status = 'declined', updatedAt = ?, rev = ${REV}
         WHERE id = ? AND status = 'invited'`,
      )
      .bind(now, row.id),
    // From the email's link, signed in or not: named by the address invited.
    teamEvent(
      db,
      {
        id: `team_declined:${row.id}`,
        type: 'team_declined',
        teamId: row.teamId,
        teamName: row.teamName,
        actor: { id: null, name: row.email },
        at: now,
        scopes: teamScopes(row.teamId, []),
        detail: { memberName: row.email },
      },
      memberGuard(row.id, 'declined', now),
    ),
  ]);
  const declined = ((changed as { meta?: { changes?: number } })?.meta?.changes ?? 0) > 0;
  return ok({ ...base, status: 'declined', declined });
}
