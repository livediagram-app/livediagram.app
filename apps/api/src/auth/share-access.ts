// The share-side access rules every diagram gate is built from: who counts
// as the owner, which share codes belong to a diagram, and the share-password
// check (spec/24). The REST gates (diagram-access.ts), the share-code resolve
// (routes/share.ts), and the realtime-room upgrade (routes/diagram-room-routes.ts)
// all compose these, so a rule change lands in one place rather than drifting
// between three copies. Kept apart from diagram-access.ts so the room route
// can reuse the rules while its tests stub the whole-request gates.

import type { ShareLink } from '@livediagram/api-schema';
import { getDiagramSharePassword, getShareLink } from '../db';
import type { Env } from '../types';
import { timingSafeEqual } from './timing-safe';

// The personal-diagram owner rule. The hybrid `owner` id (Clerk sub OR the
// unsigned X-Owner-Id guest header, or the room's `?o=`) is trusted ONLY on a
// personal diagram, where a guest id is an unguessable UUID. A TEAM diagram's
// owner id is a Clerk id deliberately visible to every teammate, so a removed
// member could present it; team access goes through verified membership.
export function isPersonalOwner(
  owner: string | null,
  ownerId: string,
  teamId: string | null,
): boolean {
  return !teamId && !!owner && owner === ownerId;
}

// Resolves a share code to its link, but only when the link is for THIS
// diagram: the diagram-id match stops a code for a different diagram leaking
// access through. Null for a missing code, an unknown / revoked one, or a
// mismatch.
export async function shareLinkForDiagram(
  env: Env,
  shareCode: string | null,
  diagramId: string,
): Promise<ShareLink | null> {
  if (!shareCode) return null;
  const link = await getShareLink(env, shareCode);
  return link && link.diagramId === diagramId ? link : null;
}

// Share-password check (spec/24). `ok` when the diagram has no password or the
// provided one matches (compared in constant time); otherwise `missing` (none
// sent) or `invalid` (sent, wrong). The share-code resolve maps the two
// failures to 401 / 403 for the client's password gate; every other caller
// only asks whether it is `ok`.
export type SharePasswordStatus = 'ok' | 'missing' | 'invalid';

export async function sharePasswordStatus(
  env: Env,
  diagramId: string,
  provided: string | null,
): Promise<SharePasswordStatus> {
  const required = await getDiagramSharePassword(env, diagramId);
  if (!required) return 'ok';
  if (provided == null) return 'missing';
  return (await timingSafeEqual(provided, required)) ? 'ok' : 'invalid';
}

export async function sharePasswordOk(
  env: Env,
  diagramId: string,
  provided: string | null,
): Promise<boolean> {
  return (await sharePasswordStatus(env, diagramId, provided)) === 'ok';
}
