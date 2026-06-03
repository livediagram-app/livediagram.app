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
//   canReadDiagram: owner, OR ANY valid share code (view or edit)
//   that maps to this diagram. Reads must be open to view-role
//   visitors: a view-only share link exists precisely so
//   stakeholders can see the diagram (spec/04), and tab content is
//   fetched lazily per tab (spec/13), so the per-tab GET is the
//   only path a viewer has to that content. Mirrors the read check
//   the image route applies (a share code for the diagram,
//   regardless of role).

import { getDiagramSharePassword, getShareLink } from '../db';
import type { Env } from '../types';

// Share-password gate (spec/24). When a diagram has a password, every
// share-code-based access must carry the matching X-Share-Password.
// Owners never reach here (their identity short-circuits both helpers
// above this call). The `sharePassword` arg defaults to null so the
// 5-arg call sites + existing tests fail CLOSED on a protected diagram
// rather than silently bypassing the gate.
async function sharePasswordOk(
  env: Env,
  diagramId: string,
  provided: string | null,
): Promise<boolean> {
  const required = await getDiagramSharePassword(env, diagramId);
  if (!required) return true;
  return provided != null && provided === required;
}

export async function canEditDiagram(
  env: Env,
  diagramId: string,
  owner: string | null,
  shareCode: string | null,
  ownerId: string,
  sharePassword: string | null = null,
): Promise<boolean> {
  if (owner && owner === ownerId) return true;
  if (!shareCode) return false;
  const link = await getShareLink(env, shareCode);
  if (!link) return false;
  if (link.diagramId !== diagramId) return false;
  if (link.role !== 'edit') return false;
  return sharePasswordOk(env, diagramId, sharePassword);
}

export async function canReadDiagram(
  env: Env,
  diagramId: string,
  owner: string | null,
  shareCode: string | null,
  ownerId: string,
  sharePassword: string | null = null,
): Promise<boolean> {
  if (owner && owner === ownerId) return true;
  if (!shareCode) return false;
  const link = await getShareLink(env, shareCode);
  if (!link || link.diagramId !== diagramId) return false;
  return sharePasswordOk(env, diagramId, sharePassword);
}
