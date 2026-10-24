// /api/documents/<id>/shared-tabs — the delete and Take Offline confirmations'
// read (docs/specs/006-document/tab-document-many-to-many.md, "Shared-tab
// notice"): how many of the document's tabs are also in other documents, and how
// many documents, so the user hears that those tabs stay before they act.
//
// Runs in the document's room: its `tab_shares` list the other documents each shared tab is in
// (document-room/tab-shares.ts).

import { mayLinkTabs } from '@liveworkspace/index-app';
import { sharedTabsSummary } from '../document-room/tab-shares';
import { forbidden, json } from '../responses';
import { grantOn, requireOwner, type DocumentRouteContext } from './context';

// Returns null when the request isn't this route.
export async function handleDocumentSharedTabs(
  ctx: DocumentRouteContext,
): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (segments.length !== 4 || segments[3] !== 'shared-tabs' || request.method !== 'GET') {
    return null;
  }
  // Answered for exactly who may delete the document or take it offline: 400 with no caller, 403 without an edit grant
  // of their own (not a share link's, not one tab's).
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const grant = grantOn(ctx, segments[2]!);
  if (!mayLinkTabs(grant && { level: grant.role, tab: grant.tabScope, shareCode: grant.shareCode }))
    return forbidden();
  return json({ sharedTabs: await sharedTabsSummary(env, segments[2]!) });
}
