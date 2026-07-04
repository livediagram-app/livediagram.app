// /api/diagrams/<id>/share* — the share-link family (spec/04 + spec/24
// + spec/34), split out of diagram-subresource-routes.ts the same way
// the placement route owns diagram-placement-route.ts: list / mint /
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
  getDiagramSharePassword,
  getShareLinkIncludingExpired,
  listShareLinks,
  setDiagramShare,
  setDiagramSharePassword,
} from '../db';
import { emailEnabled } from '../email/client';
import { notifyFirstShare } from '../email/notifications';
import { badRequest, json, noContent, notFound } from '../responses';
import type { ShareRole } from '../types';
import { requireOwnedDiagram, type RouteContext } from './context';

// Returns null when the request isn't a share route.
export async function handleDiagramShareRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  // /api/diagrams/<id>/share — owner-only.
  //   GET     — list every share link for this diagram.
  //   POST    — mint a new link. Body: { role: 'edit' | 'view' }
  //   DELETE  — revoke every link (back-compat with the
  //             single-code era).
  if (segments.length === 4 && segments[3] === 'share') {
    const id = segments[2]!;
    const access = await requireOwnedDiagram(ctx, id);
    if (access instanceof Response) return access;

    if (request.method === 'GET') {
      // Owner-only response, so it's safe to return the share password
      // in the clear — this is how the Share dialog shows it (spec/24).
      const links = await listShareLinks(env, id);
      const password = await getDiagramSharePassword(env, id);
      return json({ links, password });
    }
    if (request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        role?: ShareRole;
        expiry?: ShareLinkExpiry;
      };
      // Reject a garbage role rather than silently granting edit (the prior
      // `=== 'view' ? 'view' : 'edit'` turned any typo into an edit link).
      // An OMITTED role still defaults to 'edit', the documented behaviour.
      if (body.role !== undefined && body.role !== 'view' && body.role !== 'edit') {
        return badRequest('invalid role');
      }
      const role: ShareRole = body.role === 'view' ? 'view' : 'edit';
      // Expiry (spec/34): unknown / missing value falls back to the
      // pre-expiry behaviour, a link that works until revoked.
      const expiry: ShareLinkExpiry =
        body.expiry === 'week' || body.expiry === 'month' || body.expiry === 'sixMonths'
          ? body.expiry
          : 'never';
      const code = generateShareCode();
      const link = await createShareLink(env, id, code, role, expiry);
      // spec/64 (#6): a first-ever share link is a milestone. Best-effort,
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
      await setDiagramShare(env, id, false);
      return json({ shareable: false, shareCode: null });
    }
  }

  // /api/diagrams/<id>/share-password — owner-only get/set of the
  // diagram's optional share password (spec/24). PUT body
  // { password: string | null }; null / empty clears it.
  if (segments.length === 4 && segments[3] === 'share-password') {
    const id = segments[2]!;
    const access = await requireOwnedDiagram(ctx, id);
    if (access instanceof Response) return access;

    if (request.method === 'PUT') {
      const body = (await request.json().catch(() => ({}))) as { password?: string | null };
      const password = typeof body.password === 'string' ? body.password : null;
      if (password !== null && password.length > MAX_PASSWORD_LEN) {
        return badRequest('password too long');
      }
      await setDiagramSharePassword(env, id, password);
      // Echo back the stored value (normalised: whitespace-only ->
      // null) so the dialog reflects exactly what gates access.
      return json({ password: await getDiagramSharePassword(env, id) });
    }
  }

  // /api/diagrams/<id>/share/<code> — revoke one specific link.
  if (segments.length === 5 && segments[3] === 'share') {
    const id = segments[2]!;
    const code = segments[4]!;
    const access = await requireOwnedDiagram(ctx, id);
    if (access instanceof Response) return access;

    if (request.method === 'DELETE') {
      await deleteShareLink(env, code);
      // Tell every connected peer in this diagram's room that
      // the code just got revoked so any viewer / editor who
      // hydrated with `X-Share-Code: <code>` can hard-redirect
      // instead of continuing to read a diagram they no longer
      // have access to. Fire-and-forget: the persistence above
      // is the authoritative revoke, the broadcast is UX.
      const stub = env.DIAGRAM_ROOM.get(env.DIAGRAM_ROOM.idFromName(id));
      stub
        .fetch('https://room/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: { kind: 'share-revoked', code } }),
        })
        .catch(() => {});
      return noContent();
    }
  }

  // /api/diagrams/<id>/share/<code>/extend — re-arm an expiring link
  // for another round of its creation-time duration (spec/34).
  // Owner-only; works whether the link is currently active or expired
  // (extending an active link pushes the deadline out from now); 400
  // on a never-expiring link (nothing to extend).
  if (segments.length === 6 && segments[3] === 'share' && segments[5] === 'extend') {
    const id = segments[2]!;
    const code = segments[4]!;
    const access = await requireOwnedDiagram(ctx, id);
    if (access instanceof Response) return access;

    if (request.method === 'POST') {
      const existing = await getShareLinkIncludingExpired(env, code);
      if (!existing || existing.diagramId !== id) return notFound();
      const link = await extendShareLink(env, code);
      if (!link) return badRequest('link never expires');
      return json({ link });
    }
  }
  return null;
}
