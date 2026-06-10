// /api/share/<code> — resolve a share code to its diagram + role.

import { getDiagram, getDiagramSharePassword, getShareLink, recordSharedAccess } from '../db';
import { json, notFound } from '../responses';
import { timingSafeEqual } from '../auth/timing-safe';
import type { DiagramDTO } from '../types';
import { sharePasswordOf, type RouteContext } from './context';

// A share-link visitor never needs the owner's id, and exposing it here
// is what lets an observer learn a guest's owner-id and (formerly) claim
// its data via /api/migrate. Blank it for everyone but the owner opening
// their own link. The client only reads ownerId to compute isOwner, which
// is correctly false for a blanked id. Defence-in-depth on top of the
// signature requirement on /api/migrate (spec/04).
function redactOwner(d: DiagramDTO, visitor: string | null): DiagramDTO {
  return visitor && visitor === d.ownerId ? d : { ...d, ownerId: '' };
}

// Resolve a share code to its diagram + role. Used by visitors
// landing on /live/diagram/shared?s=<code>. Returns 404 if the
// code doesn't exist OR was revoked.
export async function handleShare(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, resolveOwner } = ctx;
  if (!(segments[1] === 'share' && segments.length === 3)) return notFound();
  const code = segments[2]!;
  if (request.method === 'GET') {
    // Primary: resolve through share_links so the code's role
    // (edit vs view) is carried back to the visitor.
    // Defensive fallback: a second share_links lookup gated on
    // diagrams.shareable so a code on a revoked-then-rewritten
    // diagram still 404s. Both legs query share_links — the
    // legacy diagrams.share_code column was dropped in
    // migration 0008.
    const link = await getShareLink(env, code);
    if (link) {
      const d = await getDiagram(env, link.diagramId);
      if (!d) return notFound();
      // Password gate (spec/24): a protected diagram won't resolve
      // until the visitor supplies the matching X-Share-Password.
      // 401 = none supplied (show the prompt), 403 = wrong one (show
      // an error). We bail BEFORE recording the visit so a failed
      // gate doesn't seed the "Shared with you" list.
      const gate = await passwordGate(env, d.id, sharePasswordOf(request));
      if (gate) return gate;
      // Track the visit in shared_with so a "Shared with you"
      // list (#8) can surface this diagram later. Only record
      // when (a) the visitor identifies (Bearer or
      // X-Owner-Id) AND (b) they're not the diagram owner —
      // an owner opening their own share link shouldn't
      // appear in their own Shared list. Failure is silent;
      // resolving the share code is the user-visible thing,
      // tracking is a nice-to-have.
      const visitor = resolveOwner();
      if (visitor && visitor !== d.ownerId) {
        await recordSharedAccess(env, visitor, d.id, link.role).catch(() => {});
      }
      return json({ diagram: redactOwner(d, visitor), role: link.role });
    }
    // No active link resolves this code: expired, revoked, or never
    // existed. `getShareLink` (above) is the single authority — it
    // filters on expiry and carries the link's real role. A defensive
    // `diagrams.shareable` fallback used to live here, but it resolved
    // ANY code on a still-shareable diagram regardless of the link's
    // expiry or role and handed back a hardcoded 'edit' — an expiry +
    // view->edit escalation. Removed: an unresolved code now 404s.
    return notFound();
  }
  return notFound();
}

// Returns a 401/403 Response when the diagram is password-protected and
// the provided password is missing / wrong, else null (access allowed).
// The error codes mirror what the client maps to its password gate.
// Exported for the focused unit suite at routes/share.test.ts that pins
// the status-code mapping, since SharePasswordGate distinguishes 401
// (no password entered yet) from 403 (entered, wrong) and a swap would
// break the gate UI silently.
export async function passwordGate(
  env: RouteContext['env'],
  diagramId: string,
  provided: string | null,
): Promise<Response | null> {
  const required = await getDiagramSharePassword(env, diagramId);
  if (!required) return null;
  if (provided == null) return json({ error: 'password_required' }, { status: 401 });
  if (!(await timingSafeEqual(provided, required)))
    return json({ error: 'password_invalid' }, { status: 403 });
  return null;
}
