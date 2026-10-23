// /api/designs/<id>/shared-tabs — the delete and Take Offline confirmations'
// read (docs/specs/006-design/tab-design-many-to-many.md, "Shared-tab
// notice"): how many of the design's tabs are also in other designs, and how
// many designs, so the user hears that those tabs stay before they act.

import { getDesign, sharedTabsSummary } from '../db';
import { forbidden, json } from '../responses';
import { mayDeleteDesign, missingDesign, requireOwner, type RouteContext } from './context';

// Returns null when the request isn't this route.
export async function handleDesignSharedTabs(ctx: RouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (segments.length !== 4 || segments[3] !== 'shared-tabs' || request.method !== 'GET') {
    return null;
  }
  // Answered for exactly who may delete the design, in the DELETE's order:
  // 400 with no caller, 404 when missing, 403 without a claim.
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const existing = await getDesign(env, segments[2]!);
  if (!existing) return missingDesign(ctx, segments[2]!);
  if (!(await mayDeleteDesign(ctx, existing))) return forbidden();
  return json({ sharedTabs: await sharedTabsSummary(env, existing.id) });
}
