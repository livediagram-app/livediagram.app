// Decline tokens for team invites (docs/specs/013-workspace/teams.md "Declining from the email"). Every invite
// email carries its own token, `<member id>.<secret>`; only the SHA-256 hash of the secret is stored, in the
// row's space-separated `decline_token_hashes` (migration 0095). A token is single-purpose: it reads that one
// invite's team name and state, and declines it. Nothing else accepts it.

import type { TeamMemberStatus } from '@livediagram/api-schema';
import { timingSafeEqual } from '../auth/timing-safe';
import type { Env } from '../types';
import { memberStatus } from './teams';

// docs/specs/013-workspace/teams.md: the invite plus its three reminders each carry one token. Verification reads
// no more than this many hashes, whatever the column holds, so a check costs a bounded number of compares.
export const DECLINE_TOKEN_MAX_HASHES = 4;

// 32 random bytes, base64url without padding: 43 characters, 256 bits.
const SECRET_BYTES = 32;
const TOKEN_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
  );
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

export type DeclineToken = { token: string; hash: string };

// A fresh token for one invite and the hash to store for it. The caller stores the hash (in the invite's
// INSERT, or with the reminder's sent stamp) and puts the token in the email; the token is never stored.
export async function mintDeclineToken(memberId: string): Promise<DeclineToken> {
  const secret = base64url(crypto.getRandomValues(new Uint8Array(SECRET_BYTES)));
  return { token: `${memberId}.${secret}`, hash: await sha256Hex(secret) };
}

export type DeclineTarget = {
  memberId: string;
  teamId: string;
  teamName: string;
  userId: string | null;
  email: string | null;
  status: TeamMemberStatus;
};

type DeclineRow = {
  id: string;
  team_id: string;
  user_id: string | null;
  email: string | null;
  status: string | null;
  decline_token_hashes: string | null;
  name: string;
};

// The invite a token names, or null for every failure alike (malformed, unknown id, no hashes, no match), so the
// open endpoint never says whether an id exists. Every stored hash is compared, in constant time, with no early
// exit on a match.
export async function resolveDeclineToken(env: Env, token: string): Promise<DeclineTarget | null> {
  const match = TOKEN_PATTERN.exec(token);
  if (!match) return null;
  const [, memberId, secret] = match;
  const row = await env.DB.prepare(
    `SELECT m.id, m.team_id, m.user_id, m.email, m.status, m.decline_token_hashes, t.name
       FROM team_members m JOIN teams t ON t.id = m.team_id
      WHERE m.id = ?`,
  )
    .bind(memberId)
    .first<DeclineRow>();
  const stored = (row?.decline_token_hashes ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, DECLINE_TOKEN_MAX_HASHES);
  if (!row || stored.length === 0) return null;
  const presented = await sha256Hex(secret!);
  let matched = false;
  for (const hash of stored) {
    if (await timingSafeEqual(presented, hash)) matched = true;
  }
  if (!matched) return null;
  return {
    memberId: row.id,
    teamId: row.team_id,
    teamName: row.name,
    userId: row.user_id,
    email: row.email,
    status: memberStatus(row.status),
  };
}

// The invitee's no (docs/specs/013-workspace/teams.md): an 'invited' row becomes 'declined'. Guarded in the
// write, so of a decline racing an accept (or a second decline) exactly one wins; true only for the request
// that flipped it, which is the one that tells the admins. Shared by the email link and the in-app Decline.
export async function declineTeamInvite(env: Env, memberId: string): Promise<boolean> {
  const res = await env.DB.prepare(
    `UPDATE team_members SET status = 'declined', updated_at = ? WHERE id = ? AND status = 'invited'`,
  )
    .bind(Date.now(), memberId)
    .run();
  return res.meta.changes === 1;
}

// The invite's current status, for the answer after a decline that lost a race.
export async function teamInviteStatus(
  env: Env,
  memberId: string,
): Promise<TeamMemberStatus | null> {
  const row = await env.DB.prepare('SELECT status FROM team_members WHERE id = ?')
    .bind(memberId)
    .first<{ status: string | null }>();
  return row ? memberStatus(row.status) : null;
}
