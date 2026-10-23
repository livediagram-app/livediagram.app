// Per-request access checks for design routes. Both helpers run
// inside the fetch handler in index.ts, gating reads + writes
// before the underlying D1 / R2 work is dispatched. Lifted into
// their own module so the access policy has one canonical home,
// and so it has a testable surface (the route handler that calls
// these is itself hard to unit-test because of the D1 binding).
//
// Two roles, two checks:
//
//   canEditDesign: owner of the design, OR a Bearer / X-Owner-Id
//   identity that holds an edit-role share link for this design.
//   The design-id match on the link prevents a stale code for a
//   different design leaking write access through.
//
//   Both additionally allow a JOINED member of the design's team
//   (docs/specs/013-workspace/team-shared-designs.md): a team's shared library grants edit to its members,
//   checked against the verified caller identity. Invited (not yet
//   accepted) members get nothing, consistent with docs/specs/013-workspace/teams.md.
//
//   canReadDesign: owner, OR ANY valid share code (view or edit)
//   that maps to this design. Reads must be open to view-role
//   visitors: a view-only share link exists precisely so
//   stakeholders can see the design (docs/specs/014-identity/auth-and-guest-access.md), and tab content is
//   fetched lazily per tab (docs/specs/006-design/per-tab-storage.md), so the per-tab GET is the
//   only path a viewer has to that content. Mirrors the read check
//   the image route applies (a share code for the design,
//   regardless of role).

import { levelAtLeast, type AccessLevel } from '@livedesign/api-schema';
import { getMembership } from '../db';
import type { Env, ShareRole } from '../types';
import {
  isPersonalOwner,
  shareLinkForDesign,
  sharePasswordOk,
  type SharePasswordAttempt,
} from './share-access';

// Joined-member check for team designs (docs/specs/013-workspace/team-shared-designs.md). `caller` MUST be the
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

// What a caller holds on a design: a role, the one tab it is confined to
// (docs/specs/013-workspace/tab-scoped-share-links.md), and the share code that granted it. `tabScope` is
// null for the owner, a joined team member and an All-tabs link; `shareCode`
// is null for the owner and a team member, who need no code.
export type DesignGrant = {
  role: ShareRole;
  tabScope: string | null;
  shareCode: string | null;
};

// `owner` is the hybrid identity (Clerk sub OR unsigned X-Owner-Id guest
// header); `callerId` is the VERIFIED Clerk user id (null for guests).
// For a personal design the hybrid `owner` path is safe (a guest id is
// an unguessable UUID). For a TEAM design the identity must be verified,
// because owner/member ids are Clerk ids shared among the team, so the
// header path is disabled there and only `callerId` + share codes count.
//
// The doors that can narrow what they return to one tab (the design
// fetch, copy, thumbnails, images, the room) ask for the
// grant itself and apply its scope.
export async function resolveDesignGrant(
  env: Env,
  designId: string,
  owner: string | null,
  shareCode: string | null,
  ownerId: string,
  sharePassword: SharePasswordAttempt | null = null,
  teamId: string | null = null,
  callerId: string | null = null,
): Promise<DesignGrant | null> {
  // Membership alone for a team design. The owner of a team design is a
  // joined member while they're in the team; once they leave or are removed,
  // owning the row must not keep it open to them (docs/specs/013-workspace/team-shared-designs.md).
  if (isPersonalOwner(owner, ownerId, teamId)) return FULL_EDIT;
  if (await isJoinedTeamMember(env, teamId, callerId)) return FULL_EDIT;
  const link = await shareLinkForDesign(env, shareCode, designId);
  if (!link) return null;
  // Share-password gate (docs/specs/013-workspace/share-password.md): every share-code-based access must carry
  // the matching X-Share-Password. `sharePassword` defaults to null so the
  // short call sites fail CLOSED on a protected design rather than silently
  // bypassing the gate.
  if (!(await sharePasswordOk(env, designId, sharePassword))) return null;
  return { role: link.role, tabScope: link.tabId, shareCode: link.code };
}

const FULL_EDIT: DesignGrant = { role: 'edit', tabScope: null, shareCode: null };

// The two boolean gates. `targetTabId` names the tab the request touches;
// omitted, the request is design-level, and a tab-scoped link grants
// nothing there. Failing closed means a door nobody taught about scopes
// refuses a scoped visitor rather than handing them the whole design.
async function canAccessDesign(
  needs: AccessLevel,
  env: Env,
  designId: string,
  owner: string | null,
  shareCode: string | null,
  ownerId: string,
  sharePassword: SharePasswordAttempt | null,
  teamId: string | null,
  callerId: string | null,
  targetTabId: string | undefined,
): Promise<boolean> {
  const grant = await resolveDesignGrant(
    env,
    designId,
    owner,
    shareCode,
    ownerId,
    sharePassword,
    teamId,
    callerId,
  );
  if (!grant) return false;
  // The ladder (docs/specs/013-workspace/share-roles.md): every level holds everything below it.
  if (!levelAtLeast(grant.role, needs)) return false;
  return grant.tabScope === null || grant.tabScope === targetTabId;
}

export async function canEditDesign(
  env: Env,
  designId: string,
  owner: string | null,
  shareCode: string | null,
  ownerId: string,
  sharePassword: SharePasswordAttempt | null = null,
  teamId: string | null = null,
  callerId: string | null = null,
  targetTabId?: string,
): Promise<boolean> {
  return canAccessDesign(
    'edit',
    env,
    designId,
    owner,
    shareCode,
    ownerId,
    sharePassword,
    teamId,
    callerId,
    targetTabId,
  );
}

export async function canReadDesign(
  env: Env,
  designId: string,
  owner: string | null,
  shareCode: string | null,
  ownerId: string,
  sharePassword: SharePasswordAttempt | null = null,
  teamId: string | null = null,
  callerId: string | null = null,
  targetTabId?: string,
): Promise<boolean> {
  return canAccessDesign(
    'view',
    env,
    designId,
    owner,
    shareCode,
    ownerId,
    sharePassword,
    teamId,
    callerId,
    targetTabId,
  );
}

// The Participant door (docs/specs/013-workspace/share-roles.md): Plan cards, Sheet cells. A Viewer is refused; a
// Participant and an Editor pass.
export async function canParticipateDesign(
  env: Env,
  designId: string,
  owner: string | null,
  shareCode: string | null,
  ownerId: string,
  sharePassword: SharePasswordAttempt | null = null,
  teamId: string | null = null,
  callerId: string | null = null,
  targetTabId?: string,
): Promise<boolean> {
  return canAccessDesign(
    'participate',
    env,
    designId,
    owner,
    shareCode,
    ownerId,
    sharePassword,
    teamId,
    callerId,
    targetTabId,
  );
}
