// POST /api/documents/<id>/tabs/<tabId>/pages: an agent's Pages edit, page changes or an
// article write (docs/specs/024-agents/pages-for-agents.md "The route"), for the CLI, the MCP and
// any script. Gated like a changeset: anyone who may edit the tab, a read-only token refused.
import { parsePagesRequest } from '@liveknowledge/edit-operations';
import { getDocument } from '../db';
import { afterChangeset } from '../changesets/after';
import { frontDoorOf } from '../changesets/front-door';
import { submitPages } from '../changesets/pages';
import { forbidden, json } from '../responses';
import { clearAiEditedVerification } from '../knowledge/ai-edit-unverify';
import { agentWriteRefusal } from './agent-write-gate';
import { authorOf, notePageWriteAfter, refreshAfterWrite } from './changesets';
import { gateWrite, missingDocument, requireOwner, type DocumentRouteContext } from './context';

export async function handleTabPages(
  ctx: DocumentRouteContext,
  id: string,
  tabId: string,
): Promise<Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const document = await getDocument(ctx.env, id);
  if (!document) return missingDocument(ctx, id);
  if (!(await gateWrite(ctx, id, document.ownerId, document.teamId, tabId))) return forbidden();
  const parsed = parsePagesRequest(await ctx.request.json().catch(() => undefined));
  if ('refusal' in parsed) {
    const { code, ...rest } = parsed.refusal;
    console.info('[pages-agent] refused', {
      documentId: id,
      tabId,
      code,
      change: rest.change ?? null,
    });
    return json({ error: code, ...rest }, { status: 400 });
  }
  // The knowledgebase's AI Editing over a token's write (docs/specs/030-knowledgebase/ai-editing.md): a writing's
  // rewrite meets the page's verification, every other write the level alone.
  const rewrite = 'article' in parsed;
  if (ctx.token) {
    const refusal = agentWriteRefusal(document, tabId, rewrite ? 'rewrite' : 'other');
    if (refusal) return refusal;
  }
  const author = await authorOf(ctx, owner);
  const result = await submitPages({
    env: ctx.env,
    document,
    tabId,
    request: parsed,
    author,
    tokenId: ctx.token?.id ?? null,
    tokenName: ctx.token?.name ?? null,
  });
  // An agent's write counts as one applied change, by its front door, as a changeset does.
  if (result.status === 200 && ctx.token) {
    ctx.waitUntil?.(afterChangeset.telemetry(ctx.env, 'Applied', frontDoorOf(ctx.request)));
    // Edit Any Page with Remove Verification When AI Edits on: the rewrite takes the tick away.
    if (rewrite) await clearAiEditedVerification(ctx, document, tabId);
  }
  // Held by a person's paragraph (docs/specs/024-agents/pages-for-agents.md "Held paragraphs"), as a held changeset.
  else if (result.body && 'error' in result.body && result.body.error === 'paragraphs_held')
    ctx.waitUntil?.(afterChangeset.telemetry(ctx.env, 'Held', frontDoorOf(ctx.request)));
  // The agent shows as present on the tab it wrote, as after a changeset.
  refreshAfterWrite(ctx, id, tabId, author, {
    status: result.status,
    body: result.status === 200 ? { changeset: true } : null,
  });
  // The writing's change moves Updated, an agent's or a person's; a cover alone is not the writing.
  if (!('cover' in parsed && !('article' in parsed)))
    await notePageWriteAfter(
      ctx,
      tabId,
      owner,
      { status: result.status, body: result.status === 200 ? { changeset: true } : null },
      author,
    );
  return json(result.body, { status: result.status });
}
