// POST /api/documents/<id>/tabs/<tabId>/illustrate: an agent's Illustrate edit, page changes or an
// article write (docs/specs/024-agents/illustrate-for-agents.md "The route"), for the CLI, the MCP and
// any script. Gated like a changeset: anyone who may edit the tab, a read-only token refused.
import { parseIllustrateRequest } from '@livediagram/edit-operations';
import { getDocument } from '../db';
import { afterChangeset } from '../changesets/after';
import { frontDoorOf } from '../changesets/front-door';
import { submitIllustrate } from '../changesets/illustrate';
import { forbidden, json } from '../responses';
import { authorOf, refreshAfterWrite } from './changesets';
import { gateEdit, missingDocument, requireOwner, type RouteContext } from './context';

export async function handleTabIllustrate(
  ctx: RouteContext,
  id: string,
  tabId: string,
): Promise<Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const document = await getDocument(ctx.env, id);
  if (!document) return missingDocument(ctx, id);
  if (!(await gateEdit(ctx, id, document.ownerId, document.teamId, tabId))) return forbidden();
  const parsed = parseIllustrateRequest(await ctx.request.json().catch(() => undefined));
  if ('refusal' in parsed) {
    const { code, ...rest } = parsed.refusal;
    console.info('[illustrate-agent] refused', {
      documentId: id,
      tabId,
      code,
      change: rest.change ?? null,
    });
    return json({ error: code, ...rest }, { status: 400 });
  }
  const author = await authorOf(ctx, owner);
  const result = await submitIllustrate({
    env: ctx.env,
    document,
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
