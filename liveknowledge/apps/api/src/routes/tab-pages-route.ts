// POST /api/documents/<id>/tabs/<tabId>/pages: an agent's Pages edit, page changes or an
// article write (docs/specs/024-agents/pages-for-agents.md "The route"), for the CLI, the MCP and
// any script. Gated like a changeset: anyone who may edit the tab, a read-only token refused.
import { parsePagesRequest } from '@liveknowledge/edit-operations';
import { parseKnowledgeFields, trustState } from '@liveknowledge/knowledge';
import { getDocument } from '../db';
import { afterChangeset } from '../changesets/after';
import { frontDoorOf } from '../changesets/front-door';
import { submitPages } from '../changesets/pages';
import { forbidden, json } from '../responses';
import { authorOf, notePageWriteAfter, refreshAfterWrite } from './changesets';
import { gateEdit, missingDocument, requireOwner, type DocumentRouteContext } from './context';

export async function handleTabPages(
  ctx: DocumentRouteContext,
  id: string,
  tabId: string,
): Promise<Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const document = await getDocument(ctx.env, id);
  if (!document) return missingDocument(ctx, id);
  if (!(await gateEdit(ctx, id, document.ownerId, document.teamId, tabId))) return forbidden();
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
  // An agent never rewrites a page a person verified, current or due for review (docs/specs/024-agents/
  // knowledgebase-for-agents.md `write_page`): what a person vouched for changes through a suggestion a person
  // accepts.
  if (ctx.token && 'article' in parsed) {
    const fields = parseKnowledgeFields(document.tabs.find((t) => t.id === tabId)?.knowledge);
    const state = trustState(fields, document.knowledgeSettings.reviewEvery, Date.now()).state;
    // A page whose review is due is refused as a verified one is: it is the page most likely to need a person's
    // eye, and a rewrite by an agent would bury what the review was for.
    if (state !== 'never-verified') {
      const code = state === 'verified' ? 'page_verified' : 'page_review_due';
      console.info('[pages-agent] refused', { documentId: id, tabId, code });
      return json(
        {
          error: code,
          message:
            state === 'verified'
              ? 'This page is verified, so an agent does not rewrite it. Suggest the change instead with suggest_edit, for a person to accept.'
              : 'This page is due for review, so an agent does not rewrite it until a person has looked at it. Suggest the change instead with suggest_edit, for a person to accept.',
        },
        { status: 409 },
      );
    }
  }
  const author = await authorOf(ctx, owner);
  const result = await submitPages({
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
    await notePageWriteAfter(ctx, tabId, owner, {
      status: result.status,
      body: result.status === 200 ? { changeset: true } : null,
    });
  return json(result.body, { status: result.status });
}
