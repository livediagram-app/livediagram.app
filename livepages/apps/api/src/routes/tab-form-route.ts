// POST /api/documents/<id>/tabs/<tabId>/form: an agent's form write (docs/specs/030-forms/forms.md "Agents"), for
// the MCP, the CLI and any script: `{ form, rev? }`, the form whole. Gated like a changeset: an Editor of the tab, a
// read-only token refused.
import { getDocument } from '../db';
import { afterChangeset } from '../changesets/after';
import { frontDoorOf } from '../changesets/front-door';
import { writeAgentForm } from '../forms/agent-form-write';
import { forbidden, json } from '../responses';
import { authorOf, refreshAfterWrite } from './changesets';
import { gateEdit, missingDocument, readBody, requireOwner, type RouteContext } from './context';

export async function handleTabForm(
  ctx: RouteContext,
  id: string,
  tabId: string,
): Promise<Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const document = await getDocument(ctx.env, id);
  if (!document) return missingDocument(ctx, id);
  if (!(await gateEdit(ctx, id, document.ownerId, document.teamId, tabId))) return forbidden();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
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
