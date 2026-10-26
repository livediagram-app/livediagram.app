// POST /api/projects/<id>/tabs/<tabId>/form: an agent's form write (docs/specs/030-forms/forms.md "Agents"), for
// the MCP, the CLI and any script: `{ form, rev? }`, the form whole. Gated like a changeset: an Editor of the tab, a
// read-only token refused.
import { getProject, getTab } from '../db';
import { formLeavesTab, structureRefusal } from '../tab-structure';
import { afterChangeset } from '../changesets/after';
import { frontDoorOf } from '../changesets/front-door';
import { writeAgentForm } from '../forms/agent-form-write';
import { forbidden, json } from '../responses';
import { authorOf, refreshAfterWrite } from './changesets';
import {
  gateEdit,
  grantOn,
  missingProject,
  readBody,
  requireOwner,
  type PlanRouteContext,
} from './context';

export async function handleTabForm(
  ctx: PlanRouteContext,
  id: string,
  tabId: string,
): Promise<Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const project = await getProject(ctx.env, id);
  if (!project) return missingProject(ctx, id);
  if (!(await gateEdit(ctx, id, project.ownerId, project.teamId, tabId))) return forbidden();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  // A link to one Form tab points its form only at a board or sheet on that tab (docs/specs/030-forms/forms.md).
  if (grantOn(ctx, id)?.tabScope) {
    const stored = await getTab(ctx.env, id, tabId);
    if (formLeavesTab(stored?.form, (body as { form?: unknown }).form, tabId)) {
      const refused = structureRefusal('form', { projectId: id, tabId });
      return json(refused.body, { status: refused.status });
    }
  }
  const result = await writeAgentForm(ctx.env, id, tabId, body);
  // An agent's write counts as one applied change, by its front door, as a changeset does.
  if (result.status === 200 && ctx.token)
    ctx.waitUntil?.(afterChangeset.telemetry(ctx.env, 'Applied', frontDoorOf(ctx.request)));
  // The agent shows as present on the tab it wrote, as after a changeset.
  refreshAfterWrite(ctx, id, tabId, await authorOf(ctx, owner), {
    status: result.status,
    body: result.status === 200 ? { changeset: true } : null,
  });
  return json(result.body, { status: result.status });
}
