// /api/documents/<id>/share* — the share-link family (docs/specs/014-identity/auth-and-guest-access.md + docs/specs/013-workspace/share-password.md
// + docs/specs/013-workspace/share-link-expiry.md), split out of document-subresource-routes.ts the same way
// the placement route owns document-placement-route.ts: list / mint /
// bulk-revoke, the share password, revoking one code (with the room
// broadcast so hydrated visitors hard-redirect), and re-arming an
// expiring link.

import type { ShareLinkExpiry } from '@livediagram/api-schema';
import { MAX_PASSWORD_LEN } from '../limits';
import {
  createShareLink,
  deleteShareLink,
  extendShareLink,
  generateShareCode,
  getCommunityPostForDocument,
  getDocumentSharePassword,
  getShareLinkIncludingExpired,
  listShareLinks,
  rescopeShareLink,
  retractTimelineWarning,
  setDocumentShare,
  setDocumentSharePassword,
} from '../db';
import { emailEnabled } from '../email/client';
import { notifyFirstShare } from '../email/notifications';
import { badRequest, conflict, json, noContent, notFound } from '../responses';
import type { ShareRole } from '../types';
import { broadcastShareOp } from '../room-client';
import { recordShareLinkCreated } from '../timeline';
import { requireOwnedDocument, type RouteContext } from './context';

// Returns null when the request isn't a share route.
export async function handleDocumentShareRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  // /api/documents/<id>/share — owner-only.
  //   GET     — list every share link for this document.
  //   POST    — mint a new link. Body: { role: 'edit' | 'view' }
  //   DELETE  — revoke every link (back-compat with the
  //             single-code era).
  if (segments.length === 4 && segments[3] === 'share') {
    const id = segments[2]!;
    const access = await requireOwnedDocument(ctx, id);
    if (access instanceof Response) return access;

    if (request.method === 'GET') {
      // Owner-only response, so it's safe to return the share password
      // in the clear — this is how the Share dialog shows it (docs/specs/013-workspace/share-password.md).
      const links = await listShareLinks(env, id);
      const password = await getDocumentSharePassword(env, id);
      return json({ links, password });
    }
    if (request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        role?: ShareRole;
        expiry?: ShareLinkExpiry;
        tabId?: unknown;
      };
      // Reject a garbage role rather than silently granting edit (the prior
      // `=== 'view' ? 'view' : 'edit'` turned any typo into an edit link).
      // An OMITTED role still defaults to 'edit', the documented behaviour.
      if (body.role !== undefined && body.role !== 'view' && body.role !== 'edit') {
        return badRequest('invalid role');
      }
      const role: ShareRole = body.role === 'view' ? 'view' : 'edit';
      // Expiry (docs/specs/013-workspace/share-link-expiry.md): unknown / missing value falls back to the
      // pre-expiry behaviour, a link that works until revoked.
      const expiry: ShareLinkExpiry =
        body.expiry === 'week' || body.expiry === 'month' || body.expiry === 'sixMonths'
          ? body.expiry
          : 'never';
      // Scope (docs/specs/013-workspace/tab-scoped-share-links.md): one of this document's tabs, or All tabs.
      const tabId = parseScope(body.tabId, access.tabs);
      if (tabId === INVALID_SCOPE) return badRequest('invalid tab');
      const code = generateShareCode();
      const link = await createShareLink(env, id, code, role, expiry, tabId);
      // docs/specs/013-workspace/timeline.md §4.3: owner-only. Who a document is shared with is the
      // owner's business — a team member seeing "a link was created"
      // learns nothing they can act on.
      ctx.waitUntil?.(recordShareLinkCreated(env, access, role, access.ownerId));
      // docs/specs/014-identity/transactional-email.md (#6): a first-ever share link is a milestone. Best-effort,
      // off the response path; claimFirstShare dedups so it fires only once.
      if (emailEnabled(env)) {
        ctx.waitUntil?.(notifyFirstShare(env, access.ownerId));
      }
      return json({ link }, { status: 201 });
    }
    if (request.method === 'DELETE') {
      // Bulk-revoke: drop every link AND flip legacy shareable
      // off so the live app stops opening the room.
      const links = await listShareLinks(env, id);
      for (const link of links) await deleteShareLink(env, link.code);
      await setDocumentShare(env, id, false);
      // Every link is gone, so the pending "expires soon" warning has
      // nothing left to warn about. It's keyed on the DOCUMENT (one warning
      // per document, not per link), so retracting it here is exact.
      await retractTimelineWarning(env, 'document', id, 'share_link_expiring');

      return json({ shareable: false, shareCode: null });
    }
  }

  // /api/documents/<id>/share-password — owner-only get/set of the
  // document's optional share password (docs/specs/013-workspace/share-password.md). PUT body
  // { password: string | null }; null / empty clears it.
  if (segments.length === 4 && segments[3] === 'share-password') {
    const id = segments[2]!;
    const access = await requireOwnedDocument(ctx, id);
    if (access instanceof Response) return access;

    if (request.method === 'PUT') {
      const body = (await request.json().catch(() => ({}))) as { password?: string | null };
      const password = typeof body.password === 'string' ? body.password : null;
      if (password !== null && password.length > MAX_PASSWORD_LEN) {
        return badRequest('password too long');
      }
      // A share password and a Community post exclude each other (docs/specs/025-community/community.md): a public
      // post cannot ask its visitors for a password.
      if (password?.trim() && (await getCommunityPostForDocument(env, id))) {
        return conflict('community_published');
      }
      await setDocumentSharePassword(env, id, password);
      // Echo back the stored value (normalised: whitespace-only ->
      // null) so the dialog reflects exactly what gates access.
      return json({ password: await getDocumentSharePassword(env, id) });
    }
  }

  // /api/documents/<id>/share/<code> — revoke one specific link.
  if (segments.length === 5 && segments[3] === 'share') {
    const id = segments[2]!;
    const code = segments[4]!;
    const access = await requireOwnedDocument(ctx, id);
    if (access instanceof Response) return access;

    if (request.method === 'DELETE') {
      // The ownership check above is on the URL's document; the delete is by
      // code alone. Without this, owning ANY document let you revoke any link
      // whose code you had seen. Same guard as /extend below.
      const existing = await getShareLinkIncludingExpired(env, code);
      // A Community post's link is not the owner's to revoke here: Remove From Community does that
      // (docs/specs/025-community/community.md).
      if (!existing || existing.documentId !== id || existing.purpose === 'community') {
        return notFound();
      }
      await deleteShareLink(env, code);
      // Same retraction as the bulk revoke above. Deliberately not conditional
      // on this being the document's LAST expiring link: the warning is per
      // document, and the daily expiry sweep re-emits whatever is still inside
      // its window, so the worst case is a day of silence rather than a
      // deadline the owner has already dealt with.
      await retractTimelineWarning(env, 'document', id, 'share_link_expiring');
      // Tell every connected peer in this document's room that the code just
      // got revoked: its holders hard-redirect out, and the room closes their
      // sockets. The persistence above is the authoritative revoke.
      await broadcastShareOp(env, id, { kind: 'share-revoked', code });
      return noContent();
    }
    // PUT: rescope the link (docs/specs/013-workspace/tab-scoped-share-links.md). Body { tabId: string | null };
    // the code stays, and its holders reload into the new scope.
    if (request.method === 'PUT') {
      const existing = await getShareLinkIncludingExpired(env, code);
      // A post covers every tab (docs/specs/025-community/community.md), so its link is never rescoped.
      if (!existing || existing.documentId !== id || existing.purpose === 'community') {
        return notFound();
      }
      const body = (await request.json().catch(() => ({}))) as { tabId?: unknown };
      if (!('tabId' in body)) return badRequest('invalid tab');
      const tabId = parseScope(body.tabId, access.tabs);
      if (tabId === INVALID_SCOPE) return badRequest('invalid tab');
      const link = await rescopeShareLink(env, code, tabId);
      if (!link) return notFound();
      ctx.waitUntil?.(broadcastShareOp(env, id, { kind: 'share-rescoped', code }));
      return json({ link });
    }
  }

  // /api/documents/<id>/share/<code>/extend — re-arm an expiring link
  // for another round of its creation-time duration (docs/specs/013-workspace/share-link-expiry.md).
  // Owner-only; works whether the link is currently active or expired
  // (extending an active link pushes the deadline out from now); 400
  // on a never-expiring link (nothing to extend).
  if (segments.length === 6 && segments[3] === 'share' && segments[5] === 'extend') {
    const id = segments[2]!;
    const code = segments[4]!;
    const access = await requireOwnedDocument(ctx, id);
    if (access instanceof Response) return access;

    if (request.method === 'POST') {
      const existing = await getShareLinkIncludingExpired(env, code);
      if (!existing || existing.documentId !== id) return notFound();
      const link = await extendShareLink(env, code);
      if (!link) return badRequest('link never expires');
      // The deadline moved out, so the standing warning quotes a date that is
      // no longer true. Retract rather than re-date it: emitTimelineEvent
      // resolves a conflict with occurred_at = MAX(old, new), which can only
      // push a warning later, and the new deadline may be outside the sweep's
      // window entirely (in which case there should be no warning at all).
      await retractTimelineWarning(env, 'document', id, 'share_link_expiring');
      return json({ link });
    }
  }
  return null;
}

// A link's scope from a request body (docs/specs/013-workspace/tab-scoped-share-links.md): null or absent
// is All tabs; a string must name one of the document's own tabs. Anything
// else is INVALID_SCOPE, which the routes answer with 400 invalid tab.
const INVALID_SCOPE = Symbol('invalid scope');

function parseScope(
  value: unknown,
  tabs: readonly { id: string }[],
): string | null | typeof INVALID_SCOPE {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return INVALID_SCOPE;
  return tabs.some((t) => t.id === value) ? value : INVALID_SCOPE;
}
