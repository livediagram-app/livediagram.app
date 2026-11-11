// A team's join link (teams.ts).

import { withoutTrailingSlashes } from '@liveworkspace/api-schema/url-slashes';
import { base64url, randomSecret, sha256 } from './tokens.ts';
import {
  type Actor,
  BUMP,
  fail,
  INVITE_LINK_TTL_MS,
  isUniqueClash,
  MAX_MEMBERS_PER_TEAM,
  MAX_TEAMS_PER_ACCOUNT,
  memberGuard,
  ok,
  type Result,
  REV,
  teamEvent,
} from './shared.ts';
import { getMembership, JOINED_TEAMS, joinedTeamCount, OPEN_MEMBERS } from './reads.ts';

// --- The join link ---

// The token in a team's join link: an HMAC of its nonce under the Worker's secret. Recomputable, so an
// admin can copy the link again, but not from the table alone, which keeps only its hash.
export async function inviteLinkToken(secret: string, teamId: string, nonce: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`team-join-link:${teamId}:${nonce}`),
  );
  return base64url(new Uint8Array(mac));
}

export const joinLinkUrl = (baseUrl: string, token: string) =>
  `${withoutTrailingSlashes(baseUrl)}/join?token=${encodeURIComponent(token)}`;

export interface InviteLink {
  url: string;
  expiresAt: number;
}

// The team's join link while it is on and unexpired, else null.
export async function currentInviteLink(
  db: D1Database,
  teamId: string,
  secret: string,
  baseUrl: string,
  now = Date.now(),
): Promise<InviteLink | null> {
  const row = await db
    .prepare(
      `SELECT inviteLinkNonce, inviteLinkExpiresAt FROM team WHERE id = ? AND deletedAt IS NULL`,
    )
    .bind(teamId)
    .first<{ inviteLinkNonce: string | null; inviteLinkExpiresAt: number | null }>();
  if (!row?.inviteLinkNonce || !row.inviteLinkExpiresAt || row.inviteLinkExpiresAt <= now)
    return null;
  const token = await inviteLinkToken(secret, teamId, row.inviteLinkNonce);
  return { url: joinLinkUrl(baseUrl, token), expiresAt: row.inviteLinkExpiresAt };
}

// An admin turns the link on, or makes a new one, which ends the old one; either way it works for a
// week from now.
export async function makeInviteLink(
  db: D1Database,
  actor: Actor,
  teamId: string,
  secret: string,
  baseUrl: string,
  now = Date.now(),
): Promise<Result<InviteLink>> {
  const me = await getMembership(db, teamId, actor.id);
  if (!me) return fail(404, 'not_found');
  if (me.role !== 'admin') return fail(403, 'admin_only');
  const nonce = randomSecret();
  const token = await inviteLinkToken(secret, teamId, nonce);
  const expiresAt = now + INVITE_LINK_TTL_MS;
  await db
    .prepare(
      `UPDATE team SET inviteLinkNonce = ?, inviteLinkHash = ?, inviteLinkExpiresAt = ? WHERE id = ?`,
    )
    .bind(nonce, await sha256(token), expiresAt, teamId)
    .run();
  return ok({ url: joinLinkUrl(baseUrl, token), expiresAt });
}

export async function clearInviteLink(
  db: D1Database,
  actor: Actor,
  teamId: string,
): Promise<Result<{ id: string }>> {
  const me = await getMembership(db, teamId, actor.id);
  if (!me) return fail(404, 'not_found');
  if (me.role !== 'admin') return fail(403, 'admin_only');
  await db
    .prepare(
      `UPDATE team SET inviteLinkNonce = NULL, inviteLinkHash = NULL, inviteLinkExpiresAt = NULL WHERE id = ?`,
    )
    .bind(teamId)
    .run();
  return ok({ id: teamId });
}

async function linkedTeam(db: D1Database, token: unknown, now: number) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  return db
    .prepare(
      `SELECT t.id, t.name, t.organisation,
              (SELECT COUNT(*) FROM team_member c WHERE c.teamId = t.id AND c.status = 'joined') AS memberCount
       FROM team t WHERE t.inviteLinkHash = ? AND t.inviteLinkExpiresAt > ? AND t.deletedAt IS NULL`,
    )
    .bind(await sha256(token), now)
    .first<{ id: string; name: string; organisation: string | null; memberCount: number }>();
}

export interface JoinPreview {
  teamId: string;
  teamName: string;
  organisation: string | null;
  memberCount: number;
  // True only when the caller is signed in and already a joined member.
  alreadyMember: boolean;
}

// What a join link opens onto, before anyone signs in: the token is the credential, so naming the team
// to whoever holds it gives nothing away.
export async function previewInviteLink(
  db: D1Database,
  token: unknown,
  userId: string | null,
  now = Date.now(),
): Promise<JoinPreview | null> {
  const team = await linkedTeam(db, token, now);
  if (!team) return null;
  const alreadyMember = userId ? Boolean(await getMembership(db, team.id, userId)) : false;
  return {
    teamId: team.id,
    teamName: team.name,
    organisation: team.organisation,
    memberCount: team.memberCount,
    alreadyMember,
  };
}

// Joins the team a link names, as a member. Already in it: nothing changes. An invitation waiting
// for the caller's address is accepted in place rather than doubled.
export async function joinByInviteLink(
  db: D1Database,
  actor: Actor,
  token: unknown,
  now = Date.now(),
): Promise<
  Result<{ teamId: string; teamName: string; alreadyMember: boolean; acceptedInvite: boolean }>
> {
  const team = await linkedTeam(db, token, now);
  if (!team) return fail(404, 'invite_not_found');
  const result = { teamId: team.id, teamName: team.name };
  const joinedEvent = (memberId: string, guard?: { sql: string; args: unknown[] }) =>
    teamEvent(
      db,
      {
        id: `team_joined:${memberId}`,
        type: 'team_joined',
        teamId: team.id,
        teamName: team.name,
        actor,
        at: now,
        detail: { personId: actor.id, memberName: actor.name || actor.email, via: 'link' },
      },
      guard,
    );
  if (await getMembership(db, team.id, actor.id)) {
    return ok({ ...result, alreadyMember: true, acceptedInvite: false });
  }
  if ((await joinedTeamCount(db, actor.id)) >= MAX_TEAMS_PER_ACCOUNT) {
    return fail(409, 'team_limit_reached');
  }
  const pending = actor.email
    ? await db
        .prepare(`SELECT id FROM team_member WHERE teamId = ? AND email = ? AND status = 'invited'`)
        .bind(team.id, actor.email)
        .first<{ id: string }>()
    : null;
  if (pending) {
    const [, accepted] = await db.batch([
      db.prepare(BUMP),
      db
        .prepare(
          `UPDATE team_member SET status = 'joined', userId = ?, updatedAt = ?, rev = ${REV}
           WHERE id = ? AND status = 'invited' AND ${JOINED_TEAMS} < ?`,
        )
        .bind(actor.id, now, pending.id, actor.id, MAX_TEAMS_PER_ACCOUNT),
      joinedEvent(pending.id, memberGuard(pending.id, 'joined', now)),
    ]);
    if (accepted?.meta.changes)
      return ok({ ...result, alreadyMember: false, acceptedInvite: true });
    // Not taken: the account reached its cap since the read above, or the invitation was answered or withdrawn
    // meanwhile, and the link still lets them in.
    const refused = await refusedJoin(db, team.id, actor.id, result);
    if (refused) return refused;
  }
  const open = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM team_member WHERE teamId = ? AND status IN ('invited', 'joined')`,
    )
    .bind(team.id)
    .first<{ n: number }>();
  if ((open?.n ?? 0) >= MAX_MEMBERS_PER_TEAM) return fail(409, 'member_limit_reached');
  const memberId = crypto.randomUUID();
  let joined: D1Result[] = [];
  try {
    joined = await db.batch([
      db.prepare(BUMP),
      db
        .prepare(
          `INSERT INTO team_member (id, teamId, userId, email, role, status, invitedBy, createdAt, updatedAt, rev)
           SELECT ?, ?, ?, ?, 'member', 'joined', NULL, ?, ?, ${REV}
           WHERE ${JOINED_TEAMS} < ? AND ${OPEN_MEMBERS} < ?`,
        )
        .bind(
          memberId,
          team.id,
          actor.id,
          actor.email ?? `${actor.id}@account.invalid`,
          now,
          now,
          actor.id,
          MAX_TEAMS_PER_ACCOUNT,
          team.id,
          MAX_MEMBERS_PER_TEAM,
        ),
      joinedEvent(memberId, {
        sql: 'EXISTS (SELECT 1 FROM team_member WHERE id = ?)',
        args: [memberId],
      }),
    ]);
  } catch (err) {
    // Two joins at once by one person: the unique index lets one through, and they are in. Anything else (D1 down,
    // or a clash that left them out) is no join, never answered as one.
    if (isUniqueClash(err) && (await getMembership(db, team.id, actor.id))) {
      return ok({ ...result, alreadyMember: true, acceptedInvite: false });
    }
    throw err;
  }
  if (!joined[1]?.meta.changes) {
    return (await refusedJoin(db, team.id, actor.id, result)) ?? fail(409, 'member_limit_reached');
  }
  return ok({ ...result, alreadyMember: false, acceptedInvite: false });
}

// Why a join through the link wrote nothing: they are in already (another request let them in), or the account is
// at its team cap; null for neither.
async function refusedJoin(
  db: D1Database,
  teamId: string,
  userId: string,
  result: { teamId: string; teamName: string },
): Promise<Result<{
  teamId: string;
  teamName: string;
  alreadyMember: boolean;
  acceptedInvite: boolean;
}> | null> {
  if (await getMembership(db, teamId, userId)) {
    return ok({ ...result, alreadyMember: true, acceptedInvite: false });
  }
  if ((await joinedTeamCount(db, userId)) >= MAX_TEAMS_PER_ACCOUNT) {
    return fail(409, 'team_limit_reached');
  }
  return null;
}
