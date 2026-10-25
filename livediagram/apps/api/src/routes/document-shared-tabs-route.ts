// /api/documents/<id>/shared-tabs — the delete and Take Offline confirmations'
// read (docs/specs/006-document/tab-document-many-to-many.md, "Shared-tab
// notice"): how many of the document's tabs are also in other documents, and how
// many documents, so the user hears that those tabs stay before they act.
//
// Runs in the document's room: its `tab_shares` list the other documents each shared tab is in
// (document-room/tab-shares.ts).

import { getDocument } from '../db';
import { sharedTabsSummary } from '../document-room/tab-shares';
import { forbidden, json } from '../responses';
import { gateGrant, missingDocument, requireOwner, type DocumentRouteContext } from './context';

// Returns null when the request isn't this route.
export async function handleDocumentSharedTabs(
  ctx: DocumentRouteContext,
): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (segments.length !== 4 || segments[3] !== 'shared-tabs' || request.method !== 'GET') {
    return null;
  }
  // Answered for exactly who may delete the document, in the DELETE's order: 400 with no caller, 404 when missing,
  // 403 without a claim. Deleting is the owner's or their team's (an edit grant of their own, not a share link's).
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const existing = await getDocument(env, segments[2]!);
  if (!existing) return missingDocument(ctx, segments[2]!);
  const grant = await gateGrant(ctx, existing.id);
  if (!grant || grant.role !== 'edit' || grant.shareCode !== null || grant.tabScope !== null)
    return forbidden();
  return json({ sharedTabs: await sharedTabsSummary(env, existing.id) });
}
