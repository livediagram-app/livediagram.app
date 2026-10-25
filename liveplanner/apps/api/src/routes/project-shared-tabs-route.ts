// /api/projects/<id>/shared-tabs — the delete and Take Offline confirmations'
// read (docs/specs/006-project/tab-project-many-to-many.md, "Shared-tab
// notice"): how many of the plan's tabs are also in other plans, and how
// many plans, so the user hears that those tabs stay before they act.
//
// Runs in the plan's room: its `tab_shares` list the other plans each shared tab is in
// (plan-room/tab-shares.ts).

import { mayLinkTabs } from '@liveworkspace/index-app';
import { sharedTabsSummary } from '../plan-room/tab-shares';
import { forbidden, json } from '../responses';
import { grantOn, requireOwner, type PlanRouteContext } from './context';

// Returns null when the request isn't this route.
export async function handleProjectSharedTabs(ctx: PlanRouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (segments.length !== 4 || segments[3] !== 'shared-tabs' || request.method !== 'GET') {
    return null;
  }
  // Answered for exactly who may delete the plan or take it offline: 400 with no caller, 403 without an edit grant
  // of their own (not a share link's, not one tab's).
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const grant = grantOn(ctx, segments[2]!);
  if (!mayLinkTabs(grant && { level: grant.role, tab: grant.tabScope, shareCode: grant.shareCode }))
    return forbidden();
  return json({ sharedTabs: await sharedTabsSummary(env, segments[2]!) });
}
