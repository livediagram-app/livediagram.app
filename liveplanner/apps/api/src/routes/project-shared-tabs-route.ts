// /api/projects/<id>/shared-tabs — the delete and Take Offline confirmations'
// read (docs/specs/006-project/tab-project-many-to-many.md, "Shared-tab
// notice"): how many of the project's tabs are also in other projects, and how
// many projects, so the user hears that those tabs stay before they act.
//
// A tab is held by exactly one plan now (each plan's content is its own Durable Object, docs/specs/015-api/api.md
// "Storage"), so the answer is always none; the route stays for the editors that still ask.

import type { SharedTabsSummary } from '@liveplanner/api-schema';
import { forbidden, json } from '../responses';
import { gateEdit, requireOwner, type RouteContext } from './context';

// Returns null when the request isn't this route.
export async function handleProjectSharedTabs(ctx: RouteContext): Promise<Response | null> {
  const { request, segments } = ctx;
  if (segments.length !== 4 || segments[3] !== 'shared-tabs' || request.method !== 'GET') {
    return null;
  }
  // Answered for whoever may edit the plan: 400 with no caller, 403 without the grant.
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  if (!(await gateEdit(ctx, segments[2]!))) return forbidden();
  const sharedTabs: SharedTabsSummary = { tabs: 0, projects: 0 };
  return json({ sharedTabs });
}
