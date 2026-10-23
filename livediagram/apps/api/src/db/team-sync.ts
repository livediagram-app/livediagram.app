// The teams mirror (liveworkspace/docs/accounts.md "How an app keeps up"). Teams are run on
// liveworkspace.app; this app keeps a copy of each team and its JOINED members in teams +
// team_members, so its access checks stay plain joins. The copy follows liveworkspace's change feed
// from the cursor in team_sync_state: every five minutes from the cron, and at once when a caller's
// token says their teams differ from the copy.

import {
  fetchTeamChanges,
  type ClientCredentials,
  type CreatedTeam,
  type MemberChange,
  type TeamChange,
  type TeamClaim,
} from '@liveworkspace/auth-client';
import { closeMemberTeamSessions } from '../room-access-client';
import type { Env } from '../types';
import { deleteTeam, handTeamWorkToHeir } from './teams';

// Pages read per catch-up (500 changes each). A first run on a big install takes a few cron runs;
// any later run is a page at most.
export const TEAM_SYNC_MAX_PAGES = 20;

async function readCursor(env: Env): Promise<string | null> {
  const row = await env.DB.prepare('SELECT cursor FROM team_sync_state WHERE id = 1').first<{
    cursor: string | null;
  }>();
  return row?.cursor ?? null;
}

async function saveCursor(env: Env, cursor: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO team_sync_state (id, cursor, synced_at) VALUES (1, ?1, ?2)
     ON CONFLICT (id) DO UPDATE SET cursor = excluded.cursor, synced_at = excluded.synced_at`,
  )
    .bind(cursor, Date.now())
    .run();
}

async function applyTeam(env: Env, team: TeamChange): Promise<void> {
  if (team.deleted) {
    // deleteTeam hands the team's documents back to whoever made them and drops its folders.
    await deleteTeam(env, team.id);
    return;
  }
  await env.DB.prepare(
    `INSERT INTO teams (id, name, organisation, created_at, updated_at) VALUES (?1, ?2, NULL, ?3, ?4)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
  )
    .bind(team.id, team.name, team.createdAt, team.updatedAt)
    .run();
}

async function applyMember(env: Env, member: MemberChange, ctx?: ExecutionContext): Promise<void> {
  if (member.status === 'joined' && member.userId) {
    // A person rejoining has a new member id: the old row (or one with their address) goes first, so
    // the (team, user) and (team, email) unique indexes hold. Skipped when the team is unknown here,
    // which only a deleted team can be.
    await env.DB.batch([
      env.DB.prepare(
        `DELETE FROM team_members WHERE team_id = ?1 AND id != ?2 AND (user_id = ?3 OR email = ?4)`,
      ).bind(member.teamId, member.id, member.userId, member.email),
      env.DB.prepare(
        `INSERT INTO team_members (id, team_id, user_id, email, role, status, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?4, ?5, 'joined', ?6, ?7 WHERE EXISTS (SELECT 1 FROM teams WHERE id = ?2)
         ON CONFLICT (id) DO UPDATE SET user_id = excluded.user_id, email = excluded.email,
           role = excluded.role, status = 'joined', updated_at = excluded.updated_at`,
      ).bind(
        member.id,
        member.teamId,
        member.userId,
        member.email,
        member.role,
        member.createdAt,
        member.updatedAt,
      ),
    ]);
    return;
  }
  // Invitations live on liveworkspace.app, so anything but a joined member is no row here. Someone who
  // was in the team hands what they made in it on, as leaving did before (docs/specs/013-workspace/
  // team-shared-documents.md), and is put out of the team's live rooms.
  const held = await env.DB.prepare(
    `SELECT user_id FROM team_members WHERE id = ? AND status = 'joined'`,
  )
    .bind(member.id)
    .first<{ user_id: string | null }>();
  if (held?.user_id) {
    await handTeamWorkToHeir(env, member.teamId, held.user_id);
    ctx?.waitUntil(closeMemberTeamSessions(env, member.teamId, held.user_id).catch(() => {}));
  }
  await env.DB.prepare('DELETE FROM team_members WHERE id = ?').bind(member.id).run();
}

// A team liveworkspace has just made for `userId` (routes/team-create.ts), into the copy at once, so
// the Move dialog and the Explorer can file into it on the next request rather than after the next
// feed read. The same rows the feed will bring (same ids), so reading it later changes nothing.
export async function mirrorCreatedTeam(
  env: Env,
  userId: string,
  team: CreatedTeam,
  now = Date.now(),
): Promise<void> {
  const me = team.members.find((m) => m.role === 'admin') ?? team.members[0];
  await applyTeam(env, {
    id: team.id,
    name: team.name,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  });
  if (me) {
    await applyMember(env, {
      id: me.id,
      teamId: team.id,
      userId,
      email: me.email,
      role: 'admin',
      status: 'joined',
      createdAt: now,
      updatedAt: now,
    });
  }
}

let running: Promise<number> | null = null;

// Follows the feed to its end (or TEAM_SYNC_MAX_PAGES), applying teams before members so a member
// never arrives before its team. One run per isolate at a time; a caller arriving mid-run waits for
// it. Returns the changes applied.
export function syncTeams(
  env: Env,
  credentials: ClientCredentials,
  ctx?: ExecutionContext,
): Promise<number> {
  running ??= (async () => {
    let applied = 0;
    let cursor = await readCursor(env);
    for (let page = 0; page < TEAM_SYNC_MAX_PAGES; page++) {
      const changes = await fetchTeamChanges(credentials, cursor);
      for (const team of changes.teams) await applyTeam(env, team);
      for (const member of changes.members) await applyMember(env, member, ctx);
      applied += changes.teams.length + changes.members.length;
      if (changes.cursor !== cursor) await saveCursor(env, changes.cursor);
      cursor = changes.cursor;
      if (!changes.more) break;
    }
    return applied;
  })().finally(() => {
    running = null;
  });
  return running;
}

// The claim's cap at liveworkspace: a longer list was cut short, so it can't be compared.
const TEAMS_CLAIM_MAX = 50;
const SEEN_MAX = 1000;
// The claim each account was last caught up with, per isolate. Every signed-in request compares
// against it, so the steady state is a field-by-field walk that allocates nothing: about 2 µs at
// 49 teams, where building and sorting strings cost 178 µs.
const seen = new Map<string, TeamClaim[]>();

// liveworkspace sends the claim ordered by team id, so the same teams compare equal in order.
function sameClaim(a: readonly TeamClaim[], b: readonly TeamClaim[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.id !== y.id || x.role !== y.role || x.name !== y.name) return false;
  }
  return true;
}

// A caller's token says which teams they're in. When that differs from the mirror (they made, joined
// or left one a moment ago), catch the mirror up before the request reads it. Never throws: a failed
// catch-up leaves the mirror for the cron, at worst five minutes behind.
export async function catchUpTeams(
  env: Env,
  credentials: ClientCredentials | null,
  userId: string,
  claim: TeamClaim[] | null,
  ctx?: ExecutionContext,
): Promise<void> {
  if (!credentials || !claim || claim.length >= TEAMS_CLAIM_MAX) return;
  const last = seen.get(userId);
  if (last && sameClaim(last, claim)) return;
  try {
    const mirror = async () =>
      (
        await env.DB.prepare(
          `SELECT t.id, t.name, m.role FROM teams t
             JOIN team_members m ON m.team_id = t.id AND m.user_id = ? AND m.status = 'joined'
             ORDER BY t.id`,
        )
          .bind(userId)
          .all<TeamClaim>()
      ).results ?? [];
    // Joining a run already under way can miss this caller's change, if that run read the feed
    // before the change was on it: a second run, after it, reads the feed again. Two at most.
    for (let run = 0; run < 2 && !sameClaim(await mirror(), claim); run++) {
      const applied = await syncTeams(env, credentials, ctx);
      console.info('[team-sync] caught up on a claim', { applied });
    }
    if (seen.size >= SEEN_MAX) seen.clear();
    seen.set(userId, claim);
  } catch (err) {
    console.error('[team-sync] catch-up failed', err);
  }
}
