// /api/share/<code> — resolve a share code to its document + role.

import { documentImageSvg } from '../document-image';
import { rowAuthor } from '../community-row';
import {
  communityLinkAccess,
  getCommunityPostByShareCode,
  getDocument,
  getDocumentSharePassword,
  getParticipant,
  getShareLink,
  getTrashedDocumentMeta,
  recordSharedAccess,
} from '../db';
import { notifyDocumentJoin } from '../email/notifications';
import { documentTrashed, forbidden, json, notFound, svgImage } from '../responses';
import { reportServerEvent } from '../server-telemetry';
import { sharePasswordStatus, type SharePasswordAttempt } from '../auth/share-access';
import {
  redactDocumentForCommunity,
  redactDocumentForReader,
  redactDocumentForScope,
} from '../redact-document';
import { sharePasswordOf, type RouteContext } from './context';

// Resolve a share code to its document + role. Used by visitors
// landing on /live/document/shared?s=<code>. Returns 404 if the
// code doesn't exist OR was revoked.
export async function handleShare(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, resolveOwner } = ctx;
  if (segments[1] !== 'share') return notFound();
  // /api/share/<code>/image.svg — live image (docs/specs/013-workspace/live-image-share.md + docs/specs/006-document/document-snapshots.md): the
  // document's cached SVG snapshot, served public-by-share-code so a bare
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
    // A Community post's link (docs/specs/025-community/community.md "Viewing a post's document"): read-only for
    // everyone, never recorded in "Shared with you", never a join email to the author. While the post is not public
    // (hidden, its document trashed or in a team library, the Community switched off) it answers 404 and nothing
    // else, decided before the trashed and password answers below so a closed link reveals nothing about its
    // document.
    if (link?.purpose === 'community') {
      const post = await getCommunityPostByShareCode(env, link.code);
      if (!post || (await communityLinkAccess(env, link.code)) !== 'public') return notFound();
      const d = await getDocument(env, link.documentId);
      if (!d) return notFound();
      return json({
        document: redactDocumentForCommunity(redactDocumentForReader(d, resolveOwner())),
        role: 'view',
        tabId: null,
        community: { postId: post.id, author: rowAuthor(post) },
      });
    }
    if (link) {
      const d = await getDocument(env, link.documentId);
      // The code is the credential: its holder hears the document was deleted
      // (docs/specs/013-workspace/trash.md), and the link works again on restore.
      if (!d) return missingSharedDocument(env, link.documentId);
      // Password gate (docs/specs/013-workspace/share-password.md): a protected document won't resolve
      // until the visitor supplies the matching X-Share-Password.
      // 401 = none supplied (show the prompt), 403 = wrong one (show
      // an error). We bail BEFORE recording the visit so a failed
      // gate doesn't seed the "Shared with you" list.
      const gate = await passwordGate(env, d.id, sharePasswordOf(request));
      if (gate) return gate;
      // Track the visit in shared_with so a "Shared with you"
      // list (#8) can surface this document later. Only record
      // when (a) the visitor identifies (Bearer or
      // X-Owner-Id) AND (b) they're not the document owner —
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
        // their shared document. Best-effort + off the response path; the
        // notify layer no-ops when email is off, the owner is a guest, or
        // they've opted out. Resolve the joiner's display name (shown to
        // the owner already in presence) for a friendlier subject.
        if (firstVisit) {
          // docs/specs/017-telemetry/telemetry.md: Document·Joined counts once per (visitor, document), here,
          // because only the server knows a visit is the first. The editor
          // used to emit it on every open of the share URL, so refreshes and
          // return visits inflated the count.
          ctx.waitUntil?.(
            reportServerEvent(env, 'Document', 'Joined', link.role === 'edit' ? 'Edit' : 'View'),
          );
          ctx.waitUntil?.(
            getParticipant(env, visitor)
              .catch(() => null)
              .then((p) => notifyDocumentJoin(env, d, p?.name ?? null))
              .catch(() => {}),
          );
        }
      }
      // A tab-scoped link (docs/specs/013-workspace/tab-scoped-share-links.md) sees its tab; the rest are locked.
      // `shareCode` (the document's OLDEST link, of any role and scope) is
      // never handed out here, not even when the visitor claims to be the
      // owner: the guest header is unproven on this route, so a harvested
      // owner id would otherwise turn a view link into that edit link. The
      // visitor already holds the code they arrived with.
      const liveDoc = redactDocumentForScope(
        { ...redactDocumentForReader(d, visitor), shareCode: null },
        link.tabId,
      );
      return json({ document: liveDoc, role: link.role, tabId: link.tabId });
    }
    // No active link resolves this code: expired, revoked, or never
    // existed. `getShareLink` (above) is the single authority — it
    // filters on expiry and carries the link's real role. A defensive
    // `diagrams.shareable` fallback used to live here, but it resolved
    // ANY code on a still-shareable document regardless of the link's
    // expiry or role and handed back a hardcoded 'edit' — an expiry +
    // view->edit escalation. Removed: an unresolved code now 404s.
    return notFound();
  }
  return notFound();
}

// Short, stale-while-revalidate cache so embeds stay close to live
// without hammering the origin on every view (the bytes themselves come
// from R2; the worker only re-renders when the document was saved since).
const SHARE_IMAGE_CACHE = 'public, max-age=30, stale-while-revalidate=300';
// A Community post's image has no stale window, so it cannot linger once the post is hidden.
const COMMUNITY_IMAGE_CACHE = 'public, max-age=30';

// Live image (docs/specs/013-workspace/live-image-share.md + docs/specs/006-document/document-snapshots.md): resolve the share code to its document
// and stream the cached SVG snapshot. Public — the share code in the URL
// is the only credential, matching a share link's "anyone with the URL"
// semantics, since an <img> can't carry a password or auth header.
//   - 404 on an unknown / revoked / expired code (getShareLink filters
//     expiry), a missing document, or an empty document (no snapshot).
//   - Password-protected shares (docs/specs/013-workspace/share-password.md) get NO image: an <img> can't
//     supply the password, so serving one would bypass the gate. The
//     Share dialog hides the live-image option while a password is set,
//     and this is the matching server-side enforcement.
async function handleShareImage(ctx: RouteContext, code: string): Promise<Response> {
  const { env, request } = ctx;
  const link = await getShareLink(env, code);
  if (!link) return notFound();
  let cacheControl = SHARE_IMAGE_CACHE;
  // A hidden Community post's image is gone with it (docs/specs/025-community/community.md "Reports and
  // moderation"), and with no stale window, so it cannot linger in a cache once the post is hidden.
  if (link.purpose === 'community') {
    if ((await communityLinkAccess(env, link.code)) !== 'public') return notFound();
    cacheControl = COMMUNITY_IMAGE_CACHE;
  }
  const d = await getDocument(env, link.documentId);
  if (!d) return missingSharedDocument(env, link.documentId);
  if (await getDocumentSharePassword(env, d.id)) return notFound();
  // `?tab=<id>` (docs/specs/013-workspace/live-image-share.md) picks a specific tab; without it we serve the
  // cached first-tab snapshot (the default, shared with the Explorer
  // thumbnail). An unknown tab id resolves to null below → 404, same as
  // an empty document, so a bad param can't leak another document's tab.
  //
  // A tab-scoped link (docs/specs/013-workspace/tab-scoped-share-links.md) always renders its own tab: with no
  // `?tab=` it picks that tab, and any other tab is a 404 before rendering.
  const asked = new URL(request.url).searchParams.get('tab');
  if (link.tabId !== null && asked !== null && asked !== link.tabId) return notFound();
  const tabId = link.tabId ?? asked;
  // A Community card image is drawn from the redacted tab, never the owner's snapshot.
  const community = link.purpose === 'community';
  const svg = await documentImageSvg(env, d, { tabId, community });
  return svg == null ? notFound() : svgImage(svg, cacheControl);
}

// Returns a 401/403 Response when the document is password-protected and
// the provided password is missing / wrong, else null (access allowed).
// The error codes mirror what the client maps to its password gate.
// Exported for the focused unit suite at routes/share.test.ts that pins
// the status-code mapping, since SharePasswordGate distinguishes 401
// (no password entered yet) from 403 (entered, wrong) and a swap would
// break the gate UI silently.
export async function passwordGate(
  env: RouteContext['env'],
  documentId: string,
  provided: SharePasswordAttempt | null,
): Promise<Response | null> {
  const status = await sharePasswordStatus(env, documentId, provided);
  if (status === 'missing') return json({ error: 'password_required' }, { status: 401 });
  if (status === 'invalid') return forbidden('password_invalid');
  return null;
}

// A live share code whose document no live row holds: in the Trash, the
// deleted state; otherwise the not-found of any dead code.
async function missingSharedDocument(
  env: RouteContext['env'],
  documentId: string,
): Promise<Response> {
  return (await getTrashedDocumentMeta(env, documentId)) ? documentTrashed() : notFound();
}
