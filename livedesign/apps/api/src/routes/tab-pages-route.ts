// POST /api/designs/<id>/tabs/<tabId>/pages: an agent's Pages edit, its page changes
// (docs/specs/024-agents/pages-for-agents.md "The route"), for the CLI, the MCP and
// any script. Gated like a changeset: anyone who may edit the tab, a read-only token refused.
import { parsePagesRequest } from '@livedesign/edit-operations';
import { getDesign } from '../db';
import { afterChangeset } from '../changesets/after';
import { frontDoorOf } from '../changesets/front-door';
import { submitPages } from '../changesets/pages';
import { forbidden, json } from '../responses';
import { authorOf, refreshAfterWrite } from './changesets';
import { gateEdit, missingDesign, requireOwner, type DesignRouteContext } from './context';

export async function handleTabPages(
  ctx: DesignRouteContext,
  id: string,
  tabId: string,
): Promise<Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const design = await getDesign(ctx.env, id);
  if (!design) return missingDesign(ctx, id);
  if (!(await gateEdit(ctx, id, design.ownerId, design.teamId, tabId))) return forbidden();
  const parsed = parsePagesRequest(await ctx.request.json().catch(() => undefined));
  if ('refusal' in parsed) {
    const { code, ...rest } = parsed.refusal;
    console.info('[pages-agent] refused', {
      designId: id,
      tabId,
      code,
      change: rest.change ?? null,
    });
    return json({ error: code, ...rest }, { status: 400 });
  }
  const author = await authorOf(ctx, owner);
  const result = await submitPages({
    env: ctx.env,
    design,
    tabId,
    request: parsed,
    author,
    tokenId: ctx.token?.id ?? null,
  });
  // An agent's write counts as one applied change, by its front door, as a changeset does.
  if (result.status === 200 && ctx.token)
    ctx.waitUntil?.(afterChangeset.telemetry(ctx.env, 'Applied', frontDoorOf(ctx.request)));
  // The agent shows as present on the tab it wrote, as after a changeset.
  refreshAfterWrite(ctx, id, tabId, author, {
    status: result.status,
    body: result.status === 200 ? { changeset: true } : null,
  });
  return json(result.body, { status: result.status });
}
