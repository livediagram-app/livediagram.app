// /api/share/<code> — resolve a share code to its diagram + role.

import {
  getDiagram,
  getDiagramSharePassword,
  getParticipant,
  getShareLink,
  recordSharedAccess,
} from '../db';
import { notifyDiagramJoin } from '../email/notifications';
import { forbidden, json, notFound, svgImage } from '../responses';
import { reportServerEvent } from '../server-telemetry';
import { sharePasswordStatus } from '../auth/share-access';
import { getDiagramTabImageSvg, getDiagramThumbnailSvg } from '../thumbnail';
import { redactOwnerId } from '../redact-owner';
import { sharePasswordOf, type RouteContext } from './context';

// Resolve a share code to its diagram + role. Used by visitors
// landing on /live/diagram/shared?s=<code>. Returns 404 if the
// code doesn't exist OR was revoked.
export async function handleShare(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, resolveOwner } = ctx;
  if (segments[1] !== 'share') return notFound();
  // /api/share/<code>/image.svg — live image (spec/54 + spec/67): the
  // diagram's cached SVG snapshot, served public-by-share-code so a bare
  // <img> in a README / wiki / Notion can embed it with no auth header.
  if (segments.length === 4 && segments[3] === 'image.svg' && request.method === 'GET') {
    return handleShareImage(ctx, segments[2]!);
  }
  if (segments.length !== 3) return notFound();
  const code = segments[2]!;
  if (request.method === 'GET') {
    // Resolve through share_links (the single authority): it filters on
    // expiry and carries the code's real role (edit vs view) back to the
    // visitor. A null result = expired / revoked / unknown → 404 below.
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
        const firstVisit = await recordSharedAccess(env, visitor, d.id, link.role).catch(
          () => false,
        );
        // spec/65: tell the owner the first time a new person opens
        // their shared diagram. Best-effort + off the response path; the
        // notify layer no-ops when email is off, the owner is a guest, or
        // they've opted out. Resolve the joiner's display name (shown to
        // the owner already in presence) for a friendlier subject.
        if (firstVisit) {
          // spec/22: Diagram·Joined counts once per (visitor, diagram), here,
          // because only the server knows a visit is the first. The editor
          // used to emit it on every open of the share URL, so refreshes and
          // return visits inflated the count.
          ctx.waitUntil?.(
            reportServerEvent(env, 'Diagram', 'Joined', link.role === 'edit' ? 'Edit' : 'View'),
          );
          ctx.waitUntil?.(
            getParticipant(env, visitor)
              .catch(() => null)
              .then((p) => notifyDiagramJoin(env, d, p?.name ?? null))
              .catch(() => {}),
          );
        }
      }
      return json({ diagram: redactOwnerId(d, visitor), role: link.role });
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

// Live image (spec/54 + spec/67): resolve the share code to its diagram
// and stream the cached SVG snapshot. Public — the share code in the URL
// is the only credential, matching a share link's "anyone with the URL"
// semantics, since an <img> can't carry a password or auth header.
//   - 404 on an unknown / revoked / expired code (getShareLink filters
//     expiry), a missing diagram, or an empty diagram (no snapshot).
//   - Password-protected shares (spec/24) get NO image: an <img> can't
//     supply the password, so serving one would bypass the gate. The
//     Share dialog hides the live-image option while a password is set,
//     and this is the matching server-side enforcement.
// Short, stale-while-revalidate cache so embeds stay close to live
// without hammering the origin on every view (the bytes themselves come
// from R2; the worker only re-renders when the diagram was saved since).
async function handleShareImage(ctx: RouteContext, code: string): Promise<Response> {
  const { env, request } = ctx;
  const link = await getShareLink(env, code);
  if (!link) return notFound();
  const d = await getDiagram(env, link.diagramId);
  if (!d) return notFound();
  if (await getDiagramSharePassword(env, d.id)) return notFound();
  // `?tab=<id>` (spec/54) picks a specific tab; without it we serve the
  // cached first-tab snapshot (the default, shared with the Explorer
  // thumbnail). An unknown tab id resolves to null below → 404, same as
  // an empty diagram, so a bad param can't leak another diagram's tab.
  const tabId = new URL(request.url).searchParams.get('tab');
  const svg = tabId
    ? await getDiagramTabImageSvg(env, d, tabId)
    : await getDiagramThumbnailSvg(env, d);
  return svg == null ? notFound() : svgImage(svg, 'public, max-age=30, stale-while-revalidate=300');
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
  const status = await sharePasswordStatus(env, diagramId, provided);
  if (status === 'missing') return json({ error: 'password_required' }, { status: 401 });
  if (status === 'invalid') return forbidden('password_invalid');
  return null;
}
