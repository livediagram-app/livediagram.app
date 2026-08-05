// Team + invite events (spec/138 §4.4).
//
// Teams are Clerk-only (spec/32), so nothing here ever reaches a guest
// scope. Team events go to the whole joined team rather than just the
// actor: "who is in this with me" is the question these answer, and it
// is a question every member has.

import type { TimelineScopeRef } from '@livediagram/api-schema';
import type { Env } from '../types';
import { adminsForTeam, audienceForTeam, mergeScopes, userScope } from './audience';
import { record } from './record';

type TeamRef = { id: string; name: string };

export async function recordTeamCreated(env: Env, team: TeamRef, actorId: string): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'team',
      sourceId: team.id,
      eventType: 'team_created',
      title: 'Team Created',
      description: team.name,
      snapshot: { teamId: team.id, teamName: team.name },
    },
    [userScope(actorId)],
  );
}

// An invite is created against an EMAIL ADDRESS, so at emit time there
// may be nobody to scope it to — the invitee's owner id is unknown
// until they sign in and the lazy email-claim step connects the row
// (spec/32). Hence the null-tolerant signature: with an id we scope it
// now, without one we emit scope-less and `attachInviteToNewMember`
// below adds the membership later, keeping the ORIGINAL sent-at date so
// the invite appears on their Timeline dated when it was actually sent.
export async function recordInviteReceived(
  env: Env,
  team: TeamRef,
  member: { id: string; userId: string | null },
  invitedBy: string,
  sentAt: number,
): Promise<void> {
  await record(
    env,
    {
      actorId: invitedBy,
      sourceType: 'team',
      sourceId: member.id,
      eventType: 'team_invite_received',
      title: 'Invited to a Team',
      description: team.name,
      occurredAt: sentAt,
      snapshot: { teamId: team.id, teamName: team.name, memberId: member.id },
    },
    member.userId ? [userScope(member.userId)] : [],
  );
}

export async function recordInviteAccepted(
  env: Env,
  team: TeamRef,
  actorId: string,
  actorName: string | null,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'team',
      sourceId: `${team.id}:${actorId}`,
      eventType: 'team_invite_accepted',
      title: 'Joined a Team',
      description: team.name,
      snapshot: { teamId: team.id, teamName: team.name, actorName },
    },
    // Resolved AFTER the status flip, so the new member is already in
    // the joined set and sees their own arrival.
    await audienceForTeam(env, team.id),
  );
}

// Declining tells the admins, not the whole team — it's an outcome of
// something an admin did, and the rest of the team never saw the invite.
export async function recordInviteDeclined(
  env: Env,
  team: TeamRef,
  declinedBy: string | null,
  declinedByName: string | null,
): Promise<void> {
  await record(
    env,
    {
      actorId: declinedBy,
      sourceType: 'team',
      sourceId: `${team.id}:${declinedBy ?? 'unknown'}:declined`,
      eventType: 'team_invite_declined',
      title: 'Invite Declined',
      description: declinedByName ? `${declinedByName} · ${team.name}` : team.name,
      snapshot: { teamId: team.id, teamName: team.name, actorName: declinedByName },
    },
    await adminsForTeam(env, team.id),
  );
}

export async function recordMemberJoined(
  env: Env,
  team: TeamRef,
  member: { userId: string; name: string | null },
): Promise<void> {
  await record(
    env,
    {
      actorId: member.userId,
      sourceType: 'team',
      sourceId: `${team.id}:${member.userId}:joined`,
      eventType: 'team_member_joined',
      title: 'Member Joined',
      description: member.name
        ? `${member.name} joined ${team.name}`
        : `Someone joined ${team.name}`,
      snapshot: { teamId: team.id, teamName: team.name, memberName: member.name },
    },
    await audienceForTeam(env, team.id),
  );
}

// Resolve the audience BEFORE the row is deleted, or the person
// leaving never sees their own departure and the read misses them.
export async function recordMemberLeft(
  env: Env,
  team: TeamRef,
  member: { userId: string | null; name: string | null },
  audience: Awaited<ReturnType<typeof audienceForTeam>>,
): Promise<void> {
  await record(
    env,
    {
      actorId: member.userId,
      sourceType: 'team',
      sourceId: `${team.id}:${member.userId ?? 'unknown'}:left`,
      eventType: 'team_member_left',
      title: 'Member Left',
      description: member.name ? `${member.name} left ${team.name}` : `Someone left ${team.name}`,
      snapshot: { teamId: team.id, teamName: team.name, memberName: member.name },
    },
    audience,
  );
}

export async function recordMemberRemoved(
  env: Env,
  team: TeamRef,
  member: { userId: string | null; name: string | null },
  actorId: string,
  audience: Awaited<ReturnType<typeof audienceForTeam>>,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'team',
      sourceId: `${team.id}:${member.userId ?? 'unknown'}:removed`,
      eventType: 'team_member_removed',
      title: 'Member Removed',
      description: member.name ? `${member.name} · ${team.name}` : team.name,
      snapshot: { teamId: team.id, teamName: team.name, memberName: member.name },
    },
    // The removed person sees it too — being removed from a team
    // without a trace is exactly the kind of silent change this feed
    // exists to surface.
    mergeScopes(audience, member.userId ? [userScope(member.userId)] : []),
  );
}

export async function recordRoleChanged(
  env: Env,
  team: TeamRef,
  member: { userId: string | null; name: string | null },
  fromRole: string,
  toRole: string,
  actorId: string,
): Promise<void> {
  const who = member.name ?? 'A member';
  await record(
    env,
    {
      actorId,
      sourceType: 'team',
      sourceId: `${team.id}:${member.userId ?? 'unknown'}:role`,
      eventType: 'team_role_changed',
      title: 'Role Changed',
      // The transition lives in the description; the title stays the
      // generic category so a busy day stacks cleanly.
      description: `${who}: ${titleCaseRole(fromRole)} → ${titleCaseRole(toRole)}`,
      snapshot: { teamId: team.id, teamName: team.name, memberName: member.name, fromRole, toRole },
    },
    await audienceForTeam(env, team.id),
  );
}

function titleCaseRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// The other half of `recordInviteReceived` (spec/138 §4.4).
//
// An invite is addressed to an EMAIL, so when it's created there may be
// no owner id to scope the event to. The lazy email-claim step in
// teams.ts fills in `team_members.user_id` on the caller's first
// authenticated read; this runs straight after it and hands the caller
// every invite event that just became theirs.
//
// One INSERT ... SELECT rather than a read-then-write loop: the join
// from the scope-less event rows to the freshly-claimed membership rows
// is the whole query, and OR IGNORE makes running it on every list
// request free after the first.
export async function attachClaimedInviteEvents(env: Env, userId: string): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO timeline_event_scopes (event_id, scope_type, scope_id, added_at)
       SELECT e.id, 'user', ?1, ?2
         FROM timeline_events e
         JOIN team_members m ON m.id = e.source_id
        WHERE e.source_type = 'team'
          AND e.event_type = 'team_invite_received'
          AND m.user_id = ?1`,
    )
      .bind(userId, Date.now())
      .run();
  } catch (err) {
    console.error('timeline invite claim failed', err);
  }
}

export async function recordTeamRenamed(
  env: Env,
  team: TeamRef,
  previousName: string,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'team',
      sourceId: team.id,
      eventType: 'team_renamed',
      title: 'Team Renamed',
      description: `${previousName} → ${team.name}`,
      snapshot: { teamId: team.id, teamName: team.name, previousName },
    },
    await audienceForTeam(env, team.id),
  );
}

// The audience has to be resolved BEFORE the team goes: its member rows
// are deleted with it, so afterwards there is nobody left to tell.
export async function recordTeamDeleted(
  env: Env,
  team: TeamRef,
  actorId: string,
  audience: TimelineScopeRef[],
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'team',
      sourceId: team.id,
      eventType: 'team_deleted',
      title: 'Team Deleted',
      description: team.name,
      // No teamId, so the row can't link at a team that no longer
      // exists — the same structural guard the diagram tombstone uses.
      snapshot: { teamName: team.name },
    },
    audience,
  );
}

// Admins only. A shareable join link is a credential: whether one is
// live is an administrative fact, not team news, and telling every
// member it exists is a nudge to go and find it.
export async function recordInviteLinkToggled(
  env: Env,
  team: TeamRef,
  enabled: boolean,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'team',
      sourceId: `${team.id}:invite-link`,
      eventType: enabled ? 'team_invite_link_enabled' : 'team_invite_link_disabled',
      title: enabled ? 'Invite Link Turned On' : 'Invite Link Turned Off',
      description: team.name,
      snapshot: { teamId: team.id, teamName: team.name },
    },
    await adminsForTeam(env, team.id),
  );
}
