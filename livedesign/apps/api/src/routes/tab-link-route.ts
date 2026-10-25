// /api/designs/<id>/tabs/<tabId>/link — POST {from}: share a tab of another of the caller's designs (`from`)
// into this one (docs/specs/006-design/tab-design-many-to-many.md). Both designs then hold the tab, each its own copy under the
// same tab id in its own Durable Object, and a write to it in either reaches the other (design-room/tab-shares.ts).
// Answers the tab as this design now holds it, so the editor can show it without reading the whole design.
//
// Runs in this design's room. The rules and steps are @liveworkspace/index-app's (tab-link.ts `linkSharedTab`):
// the caller must edit this design AND `from` as their own (an edit grant the index gives them on each, not a
// share link's, not one tab's, not a workbench's), and `from` must hold the tab. The second half stops anyone
// grafting in a tab they cannot edit.

import { linkSharedTab, type TabLinkAccess } from '@liveworkspace/index-app';
import { getDesignMeta, getTab } from '../db';
import { designRoom } from '../design-client';
import { designShares } from '../design-room/tab-shares';
import { badRequest, forbidden, json, notFound } from '../responses';
import {
  grantOn,
  missingDesign,
  readBody,
  requireOwner,
  type DesignRouteContext,
  type RouteContext,
} from './context';
import { resolveDesignGrant } from './design-grant';

function accessOf(ctx: RouteContext, id: string): TabLinkAccess | null {
  const grant = grantOn(ctx, id);
  return grant ? { level: grant.role, tab: grant.tabScope, shareCode: grant.shareCode } : null;
}

export async function handleTabLink(ctx: DesignRouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (
    segments.length !== 6 ||
    segments[3] !== 'tabs' ||
    segments[5] !== 'link' ||
    request.method !== 'POST'
  ) {
    return null;
  }
  const id = segments[2]!;
  const tabId = segments[4]!;
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  if (!(await getDesignMeta(env, id))) return missingDesign(ctx, id);
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const out = await linkSharedTab({
    targetId: id,
    tabId,
    from: body.from,
    workbench: !!ctx.workbench,
    target: accessOf(ctx, id),
    // The request carries the grant on this design alone: the caller's on `from` is the index's to give.
    source: async (from) => {
      if (!(await getDesignMeta(env, from))) return 'missing';
      const grant = await resolveDesignGrant(ctx, from);
      if (grant instanceof Response) return grant;
      return accessOf({ ...ctx, grant }, from);
    },
    held: () => getTab(env, id, tabId),
    sourceRoom: (from) => designRoom(env, from),
    take: (copy) => designShares.take(env, id, tabId, copy),
  });
  if (out.ok) return json({ tab: out.tab });
  if ('response' in out) return out.response;
  if (out.status === 400) return badRequest(out.error);
  if (out.status === 403) return forbidden();
  if (out.status === 404) return notFound();
  return json({ error: out.error }, { status: out.status });
}
