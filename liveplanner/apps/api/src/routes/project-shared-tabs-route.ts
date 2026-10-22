// /api/projects/<id>/shared-tabs — the delete and Take Offline confirmations'
// read (docs/specs/006-project/tab-project-many-to-many.md, "Shared-tab
// notice"): how many of the project's tabs are also in other projects, and how
// many projects, so the user hears that those tabs stay before they act.

import { getProject, sharedTabsSummary } from '../db';
import { forbidden, json } from '../responses';
import { mayDeleteProject, missingProject, requireOwner, type RouteContext } from './context';

// Returns null when the request isn't this route.
export async function handleProjectSharedTabs(ctx: RouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (segments.length !== 4 || segments[3] !== 'shared-tabs' || request.method !== 'GET') {
    return null;
  }
  // Answered for exactly who may delete the project, in the DELETE's order:
  // 400 with no caller, 404 when missing, 403 without a claim.
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const existing = await getProject(env, segments[2]!);
  if (!existing) return missingProject(ctx, segments[2]!);
  if (!(await mayDeleteProject(ctx, existing))) return forbidden();
  return json({ sharedTabs: await sharedTabsSummary(env, existing.id) });
}
