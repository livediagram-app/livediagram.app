// /api/share/<code> — resolve a share code to its project + role.

import { LEVEL_TELEMETRY_TYPE } from '@liveplanner/api-schema';
import { projectImageSvg } from '../project-image';
import {
  getProject,
  getProjectSharePassword,
  getParticipant,
  getShareLink,
  getTrashedProjectMeta,
  recordSharedAccess,
} from '../db';
import { notifyProjectJoin } from '../email/notifications';
import { projectTrashed, forbidden, json, notFound, svgImage } from '../responses';
import { reportServerEvent } from '../server-telemetry';
import { sharePasswordStatus, type SharePasswordAttempt } from '../auth/share-access';
import { redactProjectForReader, redactProjectForScope } from '../redact-project';
import { sharePasswordOf, type RouteContext } from './context';
import { handleSharePreview } from './share-preview';

// Resolve a share code to its project + role. Used by visitors
// landing on /live/project/shared?s=<code>. Returns 404 if the
// code doesn't exist OR was revoked.
export async function handleShare(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, resolveOwner } = ctx;
  if (segments[1] !== 'share') return notFound();
  // /api/share/<code>/image.svg — live image (docs/specs/013-workspace/live-image-share.md + docs/specs/006-project/project-snapshots.md): the
  // project's cached SVG snapshot, served public-by-share-code so a bare
  // <img> in a README / wiki / Notion can embed it with no auth header.
  if (segments.length === 4 && segments[3] === 'image.svg' && request.method === 'GET') {
    return handleShareImage(ctx, segments[2]!);
  }
  // /api/share/<code>/card and /image.png: what a link preview reads (docs/specs/013-workspace/share-link-previews.md).
  const preview = await handleSharePreview(ctx);
  if (preview) return preview;
  if (segments.length !== 3) return notFound();
  const code = segments[2]!;
  if (request.method === 'GET') {
    // Resolve through share_links (the single authority): it filters on
    // expiry and carries the code's real role (edit vs view) back to the
    // visitor. A null result = expired / revoked / unknown → 404 below.
    const link = await getShareLink(env, code);
    if (link) {
      const d = await getProject(env, link.projectId);
      // The code is the credential: its holder hears the project was deleted
      // (docs/specs/013-workspace/trash.md), and the link works again on restore.
      if (!d) return missingSharedProject(env, link.projectId);
      // Password gate (docs/specs/013-workspace/share-password.md): a protected project won't resolve
      // until the visitor supplies the matching X-Share-Password.
      // 401 = none supplied (show the prompt), 403 = wrong one (show
      // an error). We bail BEFORE recording the visit so a failed
      // gate doesn't seed the "Shared with you" list.
      const gate = await passwordGate(env, d.id, sharePasswordOf(request));
      if (gate) return gate;
      // Track the visit in shared_with so a "Shared with you"
      // list (#8) can surface this project later. Only record
      // when (a) the visitor identifies (Bearer or
      // X-Owner-Id) AND (b) they're not the project owner —
      // an owner opening their own share link shouldn't
      // appear in their own Shared list. Failure is silent;
      // resolving the share code is the user-visible thing,
      // tracking is a nice-to-have.
      const visitor = resolveOwner();
      if (visitor && visitor !== d.ownerId) {
        const firstVisit = await recordSharedAccess(
          env,
          visitor,
          d.id,
          link.role,
          link.tabId,
          link.code,
        ).catch(() => false);
        // docs/specs/014-identity/profile-and-email-notifications.md: tell the owner the first time a new person opens
        // their shared project. Best-effort + off the response path; the
        // notify layer no-ops when email is off, the owner is a guest, or
        // they've opted out, and throttles per project. Resolve the joiner's
        // display name (shown to the owner already in presence) for a
        // friendlier subject.
        if (firstVisit) {
          // docs/specs/017-telemetry/telemetry.md: Project·Joined counts once per (visitor, project), here,
          // because only the server knows a visit is the first. The editor
          // used to emit it on every open of the share URL, so refreshes and
          // return visits inflated the count.
          ctx.waitUntil?.(
            reportServerEvent(env, 'Project', 'Joined', LEVEL_TELEMETRY_TYPE[link.role]),
          );
          // Only a verified visitor emails: a guest's X-Owner-Id is unproven
          // and free to mint, so each fresh one would be another "first
          // visit" and another email carrying a name the visitor chose.
          if (ctx.verifiedUserId && visitor === ctx.verifiedUserId) {
            ctx.waitUntil?.(
              getParticipant(env, visitor)
                .catch(() => null)
                .then((p) => notifyProjectJoin(env, d, p?.name ?? null))
                .catch(() => {}),
            );
          }
        }
      }
      // A tab-scoped link (docs/specs/013-workspace/tab-scoped-share-links.md) sees its tab; the rest are locked.
      // `shareCode` (the project's OLDEST link, of any role and scope) is
      // never handed out here, not even when the visitor claims to be the
      // owner: the guest header is unproven on this route, so a harvested
      // owner id would otherwise turn a view link into that edit link. The
      // visitor already holds the code they arrived with.
      const liveDoc = redactProjectForScope(
        { ...redactProjectForReader(d, visitor), shareCode: null },
        link.tabId,
      );
      return json({ project: liveDoc, role: link.role, tabId: link.tabId });
    }
    // No active link resolves this code: expired, revoked, or never
    // existed. `getShareLink` (above) is the single authority — it
    // filters on expiry and carries the link's real role. A defensive
    // `diagrams.shareable` fallback used to live here, but it resolved
    // ANY code on a still-shareable project regardless of the link's
    // expiry or role and handed back a hardcoded 'edit' — an expiry +
    // view->edit escalation. Removed: an unresolved code now 404s.
    return notFound();
  }
  return notFound();
}

// Short, stale-while-revalidate cache so embeds stay close to live
// without hammering the origin on every view (the bytes themselves come
// from R2; the worker only re-renders when the project was saved since).
const SHARE_IMAGE_CACHE = 'public, max-age=30, stale-while-revalidate=300';

// Live image (docs/specs/013-workspace/live-image-share.md + docs/specs/006-project/project-snapshots.md): resolve the share code to its project
// and stream the cached SVG snapshot. Public — the share code in the URL
// is the only credential, matching a share link's "anyone with the URL"
// semantics, since an <img> can't carry a password or auth header.
//   - 404 on an unknown / revoked / expired code (getShareLink filters
//     expiry), a missing project, or an empty project (no snapshot).
//   - Password-protected shares (docs/specs/013-workspace/share-password.md) get NO image: an <img> can't
//     supply the password, so serving one would bypass the gate. The
//     Share dialog hides the live-image option while a password is set,
//     and this is the matching server-side enforcement.
async function handleShareImage(ctx: RouteContext, code: string): Promise<Response> {
  const { env, request } = ctx;
  const link = await getShareLink(env, code);
  if (!link) return notFound();
  const d = await getProject(env, link.projectId);
  if (!d) return missingSharedProject(env, link.projectId);
  if (await getProjectSharePassword(env, d.id)) return notFound();
  // `?tab=<id>` (docs/specs/013-workspace/live-image-share.md) picks a specific tab; without it we serve the
  // cached first-tab snapshot (the default, shared with the Explorer
  // thumbnail). An unknown tab id resolves to null below → 404, same as
  // an empty project, so a bad param can't leak another project's tab.
  //
  // A tab-scoped link (docs/specs/013-workspace/tab-scoped-share-links.md) always renders its own tab: with no
  // `?tab=` it picks that tab, and any other tab is a 404 before rendering.
  const asked = new URL(request.url).searchParams.get('tab');
  if (link.tabId !== null && asked !== null && asked !== link.tabId) return notFound();
  const tabId = link.tabId ?? asked;
  const svg = await projectImageSvg(env, d, tabId);
  return svg == null ? notFound() : svgImage(svg, SHARE_IMAGE_CACHE);
}

// Returns a 401/403 Response when the project is password-protected and
// the provided password is missing / wrong, else null (access allowed).
// The error codes mirror what the client maps to its password gate.
// Exported for the focused unit suite at routes/share.test.ts that pins
// the status-code mapping, since SharePasswordGate distinguishes 401
// (no password entered yet) from 403 (entered, wrong) and a swap would
// break the gate UI silently.
export async function passwordGate(
  env: RouteContext['env'],
  projectId: string,
  provided: SharePasswordAttempt | null,
): Promise<Response | null> {
  const status = await sharePasswordStatus(env, projectId, provided);
  if (status === 'missing') return json({ error: 'password_required' }, { status: 401 });
  if (status === 'invalid') return forbidden('password_invalid');
  return null;
}

// A live share code whose project no live row holds: in the Trash, the
// deleted state; otherwise the not-found of any dead code.
async function missingSharedProject(
  env: RouteContext['env'],
  projectId: string,
): Promise<Response> {
  return (await getTrashedProjectMeta(env, projectId)) ? projectTrashed() : notFound();
}
