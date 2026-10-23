// /api/documents/<id>/tabs/<tabId>/link — POST {from}: share a tab of another of the caller's documents (`from`)
// into this one (docs/specs/006-document/tab-document-many-to-many.md). Both documents then hold the tab, each its
// own copy under the same tab id in its own Durable Object, and a write to it in either reaches the other
// (document-room/tab-shares.ts). Answers the tab as this document now holds it, so the editor can show it without
// reading the whole document.
//
// Runs in this document's room. Auth: the caller must own this document AND `from` (a grant the index gives them on
// it), which must hold the tab. The second half stops anyone grafting in a tab they cannot read.

import { getDocumentMeta, getTab } from '../db';
import { documentRoom } from '../document-client';
import { takeSharedTab } from '../document-room/tab-shares';
import { badRequest, forbidden, json, notFound } from '../responses';
import {
  missingDocument,
  ownsDocument,
  readBody,
  requireOwner,
  type DocumentRouteContext,
} from './context';
import { resolveDocumentGrant } from './document-grant';

export async function handleTabLink(ctx: DocumentRouteContext): Promise<Response | null> {
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
  const target = await getDocumentMeta(env, id);
  if (!target) return missingDocument(ctx, id);
  // `ownsDocument`, not a bare id compare: a team document's owner id is one every teammate can read, so it is
  // proven with a verified account id, never the X-Owner-Id header (routes/context.ts).
  if (!(await ownsDocument(ctx, target))) return forbidden();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const from = body.from;
  if (typeof from !== 'string' || from.length === 0) return badRequest('from: a document id');
  if (from === id) return badRequest('from: another document');
  const source = await getDocumentMeta(env, from);
  if (!source) return notFound();
  // The request carries the grant on this document alone: the caller's on `from` is the index's to give.
  const sourceGrant = await resolveDocumentGrant(ctx, from);
  if (sourceGrant instanceof Response) return sourceGrant;
  if (!(await ownsDocument({ ...ctx, grant: sourceGrant }, source))) return forbidden();

  // Already here (linked before, or the same id by chance): answered as it is, as a repeat link always was.
  const held = await getTab(env, id, tabId);
  if (held) return json({ tab: held });
  const copy = await documentRoom(env, from).sharedTabCopy(tabId);
  if (!copy) return notFound();
  if (!(await takeSharedTab(env, id, tabId, copy))) return notFound();
  // The holder joined through records the join, tells the rest, and sends the tab again if it changed meanwhile.
  await documentRoom(env, from).shareJoined(tabId, id, copy.updatedAt);
  const tab = await getTab(env, id, tabId);
  return tab ? json({ tab }) : notFound();
}
