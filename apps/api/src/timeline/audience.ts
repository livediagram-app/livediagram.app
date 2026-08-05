// Who should see a timeline event (spec/138 §4.1).
//
// The whole reason the scope join table exists: one event row, many
// recipients. A comment on a diagram in a twelve-person team library is
// one row plus twelve memberships, not twelve copies of the text.
//
// Kept apart from db/timeline.ts (which is pure D1 over the timeline
// tables) because resolving an audience means reading OTHER resources'
// tables — diagrams, team_members — and that dependency shouldn't leak
// into the storage layer.

import type { TimelineScopeRef } from '@livediagram/api-schema';
import type { DiagramDTO, Env } from '../types';

export function userScope(ownerId: string): TimelineScopeRef {
  return { scopeType: 'user', scopeId: ownerId };
}

export function teamScope(teamId: string): TimelineScopeRef {
  return { scopeType: 'team', scopeId: teamId };
}

export function diagramScope(diagramId: string): TimelineScopeRef {
  return { scopeType: 'diagram', scopeId: diagramId };
}

// Everyone who should see an event about this diagram: its owner, plus
// every JOINED member of its team when it lives in a team library
// (spec/35). `invited` rows are excluded — an invite grants no
// membership until it's accepted (spec/32), and it must not leak the
// contents of a library the person hasn't joined.
//
// The actor is deliberately NOT excluded. "You commented on X" belongs
// in your own history; the renderer resolves the pronoun by comparing
// actorId against the viewer, which is what lets one row serve the
// whole audience.
export async function audienceForDiagram(
  env: Env,
  diagram: Pick<DiagramDTO, 'id' | 'ownerId' | 'teamId'>,
): Promise<TimelineScopeRef[]> {
  // The owner is added before the team lookup, so a failed lookup
  // degrades to "the owner still sees it" rather than to silence.
  const owners = new Set<string>([diagram.ownerId]);
  if (diagram.teamId) {
    for (const id of await joinedMemberIds(env, diagram.teamId)) owners.add(id);
  }
  // Plus the diagram's own history, which anyone who can read the
  // diagram can read — including a share-link visitor who is in nobody's
  // user scope.
  const scopes = [...[...owners].map(userScope), diagramScope(diagram.id)];
  // …and the team's own feed, so somebody who joins next month can read
  // back what happened before they arrived. The per-member scopes above
  // are still written: they are what makes a personal feed a single
  // indexed scan instead of a union across every team you belong to.
  return diagram.teamId ? [...scopes, teamScope(diagram.teamId)] : scopes;
}

// Everyone in a team, for team-level events (a member joined, a role
// changed). Same joined-only rule, plus the team's own scope.
export async function audienceForTeam(env: Env, teamId: string): Promise<TimelineScopeRef[]> {
  const members = (await joinedMemberIds(env, teamId)).map(userScope);
  return [...members, teamScope(teamId)];
}

// Never throws.
//
// Unlike the emit itself — which every call site wraps in waitUntil and
// `record` swallows — audience resolution genuinely has to run on the
// critical path for deletes: the team link disappears with the row, so
// there is nothing left to resolve afterwards. That means a failure
// here would take down a legitimate member removal or diagram delete,
// which is exactly the trade the timeline is not allowed to make. An
// empty list costs one missing bubble.
async function joinedMemberIds(env: Env, teamId: string): Promise<string[]> {
  try {
    const res = await env.DB.prepare(
      `SELECT user_id FROM team_members
        WHERE team_id = ?1 AND status = 'joined' AND user_id IS NOT NULL`,
    )
      .bind(teamId)
      .all<{ user_id: string }>();
    return (res.results ?? []).map((r) => r.user_id);
  } catch (err) {
    console.error('timeline audience lookup failed', teamId, err);
    return [];
  }
}

// Just the team's joined admins. Declining an invite is an outcome of
// something an admin did, and the rest of the team never saw the invite
// go out, so telling everyone would be noise about a stranger.
//
// Never throws, for the same reason as joinedMemberIds.
export async function adminsForTeam(env: Env, teamId: string): Promise<TimelineScopeRef[]> {
  try {
    const res = await env.DB.prepare(
      `SELECT user_id FROM team_members
        WHERE team_id = ?1 AND status = 'joined' AND role = 'admin' AND user_id IS NOT NULL`,
    )
      .bind(teamId)
      .all<{ user_id: string }>();
    return (res.results ?? []).map((r) => userScope(r.user_id));
  } catch (err) {
    console.error('timeline admin lookup failed', teamId, err);
    return [];
  }
}

// Merge audiences without duplicating a scope. Used where an event has
// two natural audiences — an assigned action reaches the assignee AND
// everyone who can see the diagram, and those sets usually overlap.
export function mergeScopes(...groups: TimelineScopeRef[][]): TimelineScopeRef[] {
  const seen = new Map<string, TimelineScopeRef>();
  for (const group of groups) {
    for (const scope of group) seen.set(`${scope.scopeType}:${scope.scopeId}`, scope);
  }
  return [...seen.values()];
}
