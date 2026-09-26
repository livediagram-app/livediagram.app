// Per-request access checks for diagram routes. Both helpers run
// inside the fetch handler in index.ts, gating reads + writes
// before the underlying D1 / R2 work is dispatched. Lifted into
// their own module so the access policy has one canonical home,
// and so it has a testable surface (the route handler that calls
// these is itself hard to unit-test because of the D1 binding).
//
// Two roles, two checks:
//
//   canEditDiagram: owner of the diagram, OR a Bearer / X-Owner-Id
//   identity that holds an edit-role share link for this diagram.
//   The diagram-id match on the link prevents a stale code for a
//   different diagram leaking write access through.
//
//   Both additionally allow a JOINED member of the diagram's team
//   (spec/35): a team's shared library grants edit to its members,
//   checked against the verified caller identity. Invited (not yet
//   accepted) members get nothing, consistent with spec/32.
//
//   canReadDiagram: owner, OR ANY valid share code (view or edit)
//   that maps to this diagram. Reads must be open to view-role
//   visitors: a view-only share link exists precisely so
//   stakeholders can see the diagram (spec/04), and tab content is
//   fetched lazily per tab (spec/13), so the per-tab GET is the
//   only path a viewer has to that content. Mirrors the read check
//   the image route applies (a share code for the diagram,
//   regardless of role).

import { getMembership } from '../db';
import type { Env } from '../types';
import { isPersonalOwner, shareLinkForDiagram, sharePasswordOk } from './share-access';

// Joined-member check for team diagrams (spec/35). `caller` MUST be the
// VERIFIED Clerk user id (never the unsigned X-Owner-Id header): a team
// owner/member id is a Clerk id deliberately shared among teammates, so
// trusting an attacker-supplied id here would let a removed member (or
// anyone who learned a member's id) forge access. Guests (callerId null)
// can never be members.
async function isJoinedTeamMember(
  env: Env,
  teamId: string | null,
  caller: string | null,
): Promise<boolean> {
  if (!teamId || !caller) return false;
  const membership = await getMembership(env, teamId, caller);
  return membership?.status === 'joined';
}

// `owner` is the hybrid identity (Clerk sub OR unsigned X-Owner-Id guest
// header); `callerId` is the VERIFIED Clerk user id (null for guests).
// For a personal diagram the hybrid `owner` path is safe (a guest id is
// an unguessable UUID). For a TEAM diagram the identity must be verified,
// because owner/member ids are Clerk ids shared among the team — so the
// header path is disabled there and only `callerId` + share codes count.
// The two exported checks differ only in the share-link role they accept:
// edit needs an edit-role link, read takes either role.
async function canAccessDiagram(
  needsEdit: boolean,
  env: Env,
  diagramId: string,
  owner: string | null,
  shareCode: string | null,
  ownerId: string,
  sharePassword: string | null,
  teamId: string | null,
  callerId: string | null,
): Promise<boolean> {
  // Membership alone for a team diagram. The owner of a team diagram is a
  // joined member while they're in the team; once they leave or are removed,
  // owning the row must not keep it open to them (spec/35).
  if (isPersonalOwner(owner, ownerId, teamId)) return true;
  if (await isJoinedTeamMember(env, teamId, callerId)) return true;
  const link = await shareLinkForDiagram(env, shareCode, diagramId);
  if (!link) return false;
  if (needsEdit && link.role !== 'edit') return false;
  // Share-password gate (spec/24): every share-code-based access must carry
  // the matching X-Share-Password. `sharePassword` defaults to null so the
  // 5-arg call sites + existing tests fail CLOSED on a protected diagram
  // rather than silently bypassing the gate.
  return sharePasswordOk(env, diagramId, sharePassword);
}

export async function canEditDiagram(
  env: Env,
  diagramId: string,
  owner: string | null,
  shareCode: string | null,
  ownerId: string,
  sharePassword: string | null = null,
  teamId: string | null = null,
  callerId: string | null = null,
): Promise<boolean> {
  return canAccessDiagram(
    true,
    env,
    diagramId,
    owner,
    shareCode,
    ownerId,
    sharePassword,
    teamId,
    callerId,
  );
}

export async function canReadDiagram(
  env: Env,
  diagramId: string,
  owner: string | null,
  shareCode: string | null,
  ownerId: string,
  sharePassword: string | null = null,
  teamId: string | null = null,
  callerId: string | null = null,
): Promise<boolean> {
  return canAccessDiagram(
    false,
    env,
    diagramId,
    owner,
    shareCode,
    ownerId,
    sharePassword,
    teamId,
    callerId,
  );
}
