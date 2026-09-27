// /api/diagrams/<id>/shared-tabs — the delete and Take Offline confirmations'
// read (docs/specs/006-diagram/tab-diagram-many-to-many.md, "Shared-tab
// notice"): how many of the diagram's tabs are also in other diagrams, and how
// many diagrams, so the user hears that those tabs stay before they act.

import { getDiagram, sharedTabsSummary } from '../db';
import { forbidden, json, notFound } from '../responses';
import { mayDeleteDiagram, requireOwner, type RouteContext } from './context';

// Returns null when the request isn't this route.
export async function handleDiagramSharedTabs(ctx: RouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (segments.length !== 4 || segments[3] !== 'shared-tabs' || request.method !== 'GET') {
    return null;
  }
  // Answered for exactly who may delete the diagram, in the DELETE's order:
  // 400 with no caller, 404 when missing, 403 without a claim.
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const existing = await getDiagram(env, segments[2]!);
  if (!existing) return notFound();
  if (!(await mayDeleteDiagram(ctx, existing))) return forbidden();
  return json({ sharedTabs: await sharedTabsSummary(env, existing.id) });
}
