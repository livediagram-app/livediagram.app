// The knowledgebase as an agent reads and shapes it (docs/specs/024-agents/knowledgebase-for-agents.md), each one
// request for one tool of the MCP server or one command of the CLI:
//   GET  /api/documents/<id>/pages                 the page tree with each page's trust (list_pages)
//   GET  /api/documents/<id>/pages/<tab>           one page as Markdown, its backlinks and subpages (read_page)
//   GET  /api/documents/<id>/context               the Always in Context pages within the budget (get_context)
//   POST /api/documents/<id>/pages                 a new page from Markdown (create_page): an Editor, or an
//                                                  Editor's agent holding `suggest`
//   PUT  /api/documents/<id>/pages/<tab>           the page's writing replaced, or added to (write_page): Editor;
//                                                  an agent needs `write`, and never on a verified page
//   POST /api/documents/<id>/pages/<tab>/move      a page moved in the tree (move_page): Editor
//   PUT  /api/documents/<id>/agents/<token>/scopes what an API token may do here: an Editor in person
// Reading is every role's. A page read here is counted as `GET tabs/<tab>` counts it. `<tab>`, `parent` and `before`
// take a page's id, or its title when one page alone has it.
import { nextOrderIndex } from '@liveworkspace/api-kit/tab-order';
import {
  agentScopesFor,
  parseAgentScopes,
  type CreatePageRequest,
  type KnowledgeAgentContextResponse,
  type KnowledgePageRead,
  type KnowledgePageRef,
  type KnowledgePageRow,
  type KnowledgePagesResponse,
  type MovePageRequest,
} from '@liveknowledge/api-schema';
import {
  ARTICLE_MARKDOWN_MAX,
  MAX_KNOWLEDGEBASE_PAGES,
  pageByTitleIn,
  pageMoveRefusal,
  pageTreeRows,
  withPageMoved,
} from '@liveknowledge/document';
import { newPageFromMarkdown, withTitleFrontMatter } from '@liveknowledge/edit-operations';
import {
  CONTEXT_BUDGET_TOKENS,
  assembleContext,
  backlinkRows,
  backlinks,
  cutMarkdown,
  markdownHeadings,
  markdownSection,
  parseKnowledgeFields,
} from '@liveknowledge/knowledge';
import { readStoredTab } from '../changesets/stored-tab';
import { isTabRevStale, reorderTabs, upsertTabAtRev } from '../db';
import {
  readStoredPages,
  tabParentRefusal,
  writeTabParents,
} from '../document-room/page-tree-store';
import { isTokenId, writeScopes } from '../knowledge/agent-grants';
import { readerOf } from '../knowledge/knowledge-caller';
import { rowsOf } from '../knowledge/knowledge-db';
import { countRead } from '../knowledge/knowledge-reads';
import {
  openConflictPages,
  pageMarkdownOf,
  pageNamed,
  pageTrustOf,
  pageUnknownBody,
} from '../knowledge/page-read';
import { TabTooLargeError } from '../limits';
import { capStoredName } from '../names';
import { getParticipant } from '../person/profiles';
import {
  conflict,
  forbidden,
  json,
  methodNotAllowed,
  notFound,
  payloadTooLarge,
} from '../responses';
import { relayDocumentTree } from '../room-tree';
import type { DocumentDTO } from '../types';
import { refreshAfterRead } from './changesets';
import { handleTabPages } from './tab-pages-route';
import { requireOwner } from './context';
import type { KnowledgeRoute } from './knowledge-routes';

const invalid = (error: string, message: string) => json({ error, message }, { status: 400 });

/** The largest `maxChars` a read takes: a page's Markdown is never longer. */
const READ_MAX_CHARS = ARTICLE_MARKDOWN_MAX;

type Summary = DocumentDTO['tabs'][number];
const treeOf = (document: DocumentDTO) =>
  pageTreeRows(document.tabs.map((t) => ({ ...t, parent: t.parent })));
const refOf = (t: Summary): KnowledgePageRef => ({ tab: t.id, title: t.name });

async function handleList({ ctx, document }: KnowledgeRoute): Promise<Response> {
  const now = Date.now();
  const { reviewEvery } = document.knowledgeSettings;
  const { byTab } = await openConflictPages(ctx.env, document.tabs);
  const pages: KnowledgePageRow[] = treeOf(document).map(({ page, depth, subpages }) => {
    const fields = parseKnowledgeFields(page.knowledge);
    return {
      ...refOf(page),
      depth,
      ...(page.parent ? { parent: page.parent } : {}),
      subpages,
      ...(fields.owner ? { owner: fields.owner } : {}),
      ...(fields.context ? { context: true as const } : {}),
      trust: pageTrustOf(page.knowledge, reviewEvery, now, {
        conflictsWith: byTab.get(page.id),
      }),
    };
  });
  // The Review Period, said once: every page's `reviewAt` is its `verifiedAt` plus this.
  return json({ reviewEvery, pages } satisfies KnowledgePagesResponse);
}

async function handleRead(route: KnowledgeRoute, summary: Summary): Promise<Response> {
  const { ctx, document } = route;
  const params = ctx.url.searchParams;
  const heading = params.get('heading')?.trim() ?? '';
  const rawMax = params.get('maxChars');
  const maxChars = rawMax === null ? READ_MAX_CHARS : Number(rawMax);
  if (!Number.isInteger(maxChars) || maxChars < 1 || maxChars > READ_MAX_CHARS)
    return invalid('invalid_max_chars', `maxChars is a whole number from 1 to ${READ_MAX_CHARS}.`);
  const now = Date.now();
  const fields = parseKnowledgeFields(summary.knowledge);
  const [stored, linking, conflicts, verifier] = await Promise.all([
    readStoredTab(ctx.env, document.id, summary.id),
    rowsOf<{ fromTab: string }>(ctx.env, backlinkRows(summary.id)),
    openConflictPages(ctx.env, document.tabs),
    fields.verifiedBy ? getParticipant(ctx.env, fields.verifiedBy) : null,
  ]);
  if (!stored) return notFound();
  const whole = pageMarkdownOf(stored.tab, document.tabs);
  const headings = markdownHeadings(whole).map((h) => h.text);
  const section = heading ? markdownSection(whole, heading) : whole;
  if (section === undefined)
    return invalid(
      'heading_unknown',
      headings.length
        ? `No heading "${heading}" on this page. Headings: ${headings.map((h) => `"${h}"`).join(', ')}.`
        : `This page has no headings: read it without "heading".`,
    );
  const cut = cutMarkdown(section, maxChars);
  const byId = new Map(document.tabs.map((t) => [t.id, t]));
  const order = treeOf(document).map((row) => row.page.id);
  const caller = ctx.resolveOwner();
  if (caller !== null) refreshAfterRead(ctx, document, summary.id, caller);
  await countRead(ctx.env, summary.id, readerOf(ctx), caller);
  const page: KnowledgePageRead = {
    ...refOf(summary),
    rev: stored.rev,
    markdown: cut.markdown,
    chars: whole.length,
    leftOut: whole.length - cut.markdown.length,
    headings,
    trust: pageTrustOf(summary.knowledge, document.knowledgeSettings.reviewEvery, now, {
      conflictsWith: conflicts.byTab.get(summary.id),
      verifiedBy: verifier?.name || undefined,
    }),
    ...(summary.parent ? { parent: summary.parent } : {}),
    backlinks: backlinks(
      summary.id,
      linking.map((r) => r.fromTab),
      order,
    ).flatMap((id) => (byId.has(id) ? [refOf(byId.get(id)!)] : [])),
    subpages: document.tabs.filter((t) => t.parent === summary.id).map(refOf),
  };
  return json({ page }, { headers: { ETag: `"${stored.rev}"` } });
}

async function handleContext({ ctx, document, grant }: KnowledgeRoute): Promise<Response> {
  const now = Date.now();
  const marked = treeOf(document)
    .map((row) => row.page)
    .filter((page) => parseKnowledgeFields(page.knowledge).context);
  // Each page's body is one keyed read inside the room; a knowledgebase's context is a handful of pages (the
  // budget is 8,000 tokens), and no page beyond the marked ones is read.
  const bodies = await Promise.all(
    marked.map(async (page) => {
      const stored = await readStoredTab(ctx.env, document.id, page.id);
      return {
        id: page.id,
        title: page.name,
        markdown: stored ? pageMarkdownOf(stored.tab, document.tabs) : '',
      };
    }),
  );
  const context = assembleContext(bodies);
  const reader = readerOf(ctx);
  const caller = ctx.resolveOwner();
  for (const page of context.pages) await countRead(ctx.env, page.id, reader, caller, now);
  const knowledgeOf = new Map(marked.map((p) => [p.id, p.knowledge]));
  const answer: KnowledgeAgentContextResponse = {
    name: document.name,
    role: grant.role,
    scopes:
      grant.scopes ??
      agentScopesFor({ readOnly: false, role: grant.role, granted: ['write', 'suggest'] }),
    budget: CONTEXT_BUDGET_TOKENS,
    tokens: context.tokens,
    reviewEvery: document.knowledgeSettings.reviewEvery,
    pages: context.pages.map((p) => ({
      tab: p.id,
      title: p.title,
      markdown: p.markdown,
      tokens: p.tokens,
      trust: pageTrustOf(knowledgeOf.get(p.id), document.knowledgeSettings.reviewEvery, now),
    })),
    leftOut: context.leftOut.map((p) => ({ tab: p.id, title: p.title, tokens: p.tokens })),
    pageCount: document.tabs.length,
  };
  return json(answer);
}

// A page a request places another by (`parent`, `before`): its id, or its title when one page alone has it.
function placeOf(document: DocumentDTO, ref: unknown, key = 'parent'): string | Response {
  const found = typeof ref === 'string' && ref ? pageNamed(document.tabs, ref) : undefined;
  if (found && found !== 'ambiguous') return found.id;
  if (typeof ref !== 'string' || !ref)
    return invalid(`invalid_${key}`, `"${key}" is a page's id or title.`);
  return json(pageUnknownBody(document.tabs, ref, found), { status: 409 });
}

async function handleWrite(route: KnowledgeRoute, tab: string): Promise<Response> {
  const { ctx, document } = route;
  const body = (await ctx.request.json().catch(() => null)) as {
    markdown?: unknown;
    mode?: unknown;
  } | null;
  if (typeof body?.markdown !== 'string' || !body.markdown.trim())
    return invalid('no_markdown', 'Send "markdown": the page\'s writing as Markdown.');
  if (body.mode !== undefined && body.mode !== 'replace' && body.mode !== 'append')
    return invalid('invalid_mode', '"mode" is "replace" (the default) or "append".');
  // A replace that brings no title keeps the page's: the Title is the page's name (knowledgebases-and-pages.md
  // "Name"), so writing the body alone never leaves the page untitled. Front matter's `title` retitles it.
  const page = pageNamed(document.tabs, tab);
  const markdown =
    body.mode !== 'append' && page && page !== 'ambiguous'
      ? withTitleFrontMatter(page.name, body.markdown)
      : body.markdown;
  // The article write every agent's write takes (tab-pages-route.ts): its gate, its verified-page refusal, its
  // held paragraphs and its relay to open editors.
  const request = new Request(ctx.request.url, {
    method: 'POST',
    headers: ctx.request.headers,
    body: JSON.stringify({
      article: { markdown, ...(body.mode ? { mode: body.mode } : {}) },
    }),
  });
  return handleTabPages({ ...ctx, request }, document.id, tab);
}

// The tab list as it stands, to every open editor: the op an editor's own reorder sends, each page with its parent.
async function relayTree(route: KnowledgeRoute): Promise<DocumentDTO | null> {
  return relayDocumentTree(route.ctx.env, route.document.id, '[knowledge]');
}

const PAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const linkKey = (title: string) => title.toLowerCase().replace(/\s+/g, ' ').trim();

// The titles a new page may link to beside the knowledgebase's own, each with its page's id: at most as many as a
// knowledgebase holds pages. Null for anything else.
function linkedPages(given: unknown): Map<string, string> | null {
  if (given === undefined) return new Map();
  if (!given || typeof given !== 'object' || Array.isArray(given)) return null;
  const entries = Object.entries(given as Record<string, unknown>);
  if (entries.length > MAX_KNOWLEDGEBASE_PAGES) return null;
  const linked = new Map<string, string>();
  for (const [title, id] of entries) {
    if (typeof id !== 'string' || !PAGE_ID.test(id)) return null;
    if (!linked.has(linkKey(title))) linked.set(linkKey(title), id);
  }
  return linked;
}

async function handleCreate(route: KnowledgeRoute): Promise<Response> {
  const { ctx, document, grant } = route;
  // A page is an Editor's to add; an Editor's agent adds one with `suggest` (a page it makes is never Verified,
  // and a person reads it before trusting it).
  const may = grant.scopes
    ? grant.personRole === 'edit' && grant.scopes.includes('suggest')
    : grant.role === 'edit';
  if (!may) return forbidden();
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const body = (await ctx.request.json().catch(() => null)) as Partial<CreatePageRequest> | null;
  const title = capStoredName(typeof body?.title === 'string' ? body.title : '', null, 'tab');
  if (!title) return invalid('no_title', 'Send "title": the new page\'s title.');
  const markdown = typeof body?.markdown === 'string' ? body.markdown : '';
  if (body?.markdown !== undefined && typeof body.markdown !== 'string')
    return invalid('invalid_markdown', '"markdown" is the page\'s writing as Markdown text.');
  const under = body?.parent === undefined ? undefined : placeOf(document, body.parent);
  if (under instanceof Response) return under;
  // An import mints its pages' ids before it writes the first, so a link to a page further down the tree is
  // written once, with the page that holds it: `id` is this page's, `pageIds` the ids of the titles it links to.
  if (body?.id !== undefined && (typeof body.id !== 'string' || !PAGE_ID.test(body.id)))
    return invalid('invalid_id', '"id" is a new page id: a UUID.');
  const linked = linkedPages(body?.pageIds);
  if (!linked) return invalid('invalid_page_ids', '"pageIds" maps a title to a page id (a UUID).');
  const id = body?.id ?? crypto.randomUUID();
  if (document.tabs.some((t) => t.id === id)) return conflict('page_exists');
  const refusal = tabParentRefusal(await readStoredPages(ctx.env, document.id), id, under);
  if (refusal) return conflict(refusal);
  const existing = pageByTitleIn(
    document.tabs.map((t) => ({ id: t.id, name: t.name, parent: t.parent })),
  );
  const made = newPageFromMarkdown(
    { id, title, markdown, ...(under ? { parent: under } : {}) },
    { pageByTitle: (title) => linked.get(linkKey(title)) ?? existing(title) },
  );
  if ('refusal' in made) {
    const { code, ...rest } = made.refusal;
    return json({ error: code, ...rest }, { status: 400 });
  }
  const { tab } = made;
  let rev: number;
  try {
    rev = await upsertTabAtRev(ctx.env, document.id, tab, nextOrderIndex(document.tabs), 0);
  } catch (err) {
    if (err instanceof TabTooLargeError) return payloadTooLarge();
    if (isTabRevStale(err)) return conflict('tab_busy');
    throw err;
  }
  await relayTree(route);
  console.info('[knowledge] page created', {
    documentId: document.id,
    tabId: id,
    agent: ctx.token !== null && ctx.token !== undefined,
    chars: markdown.length,
  });
  return json(
    { page: { tab: id, title, ...(under ? { parent: under } : {}), rev } },
    { status: 201 },
  );
}

async function handleMove(route: KnowledgeRoute, tab: string): Promise<Response> {
  const { ctx, document, grant } = route;
  if (grant.role !== 'edit') return forbidden();
  const body = (await ctx.request.json().catch(() => null)) as MovePageRequest | null;
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return invalid(
      'invalid_body',
      'Send "parent" (a page id, or null for the top level) and optionally "before".',
    );
  const before = body.before === undefined ? undefined : placeOf(document, body.before, 'before');
  if (before instanceof Response) return before;
  // No parent named beside a `before`: the page goes where that page is.
  const parent =
    body.parent === null
      ? undefined
      : body.parent === undefined
        ? document.tabs.find((t) => t.id === before)?.parent
        : placeOf(document, body.parent);
  if (parent instanceof Response) return parent;
  const stored = await readStoredPages(ctx.env, document.id);
  const to = { parent, before };
  const refusal = pageMoveRefusal(stored, tab, to);
  if (refusal) return conflict(refusal);
  if (before !== undefined && stored.find((p) => p.id === before)?.parent !== parent)
    return invalid('invalid_before', '"before" must be a page under the same parent.');
  const moved = withPageMoved(stored, tab, to);
  if (moved) {
    await reorderTabs(
      ctx.env,
      document.id,
      moved.map((p) => {
        const folder = document.tabs.find((t) => t.id === p.id)?.folder;
        return folder ? { id: p.id, folder } : p.id;
      }),
    );
    await writeTabParents(ctx.env, stored, [{ id: tab, parent: parent ?? null }]);
  }
  const after = moved ? await relayTree(route) : document;
  const row = (after ? treeOf(after) : []).find((r) => r.page.id === tab);
  console.info('[knowledge] page moved', { documentId: document.id, tabId: tab, moved: !!moved });
  return json({
    page: {
      tab,
      title: row?.page.name ?? '',
      ...(parent ? { parent } : {}),
      depth: row?.depth ?? 0,
    },
  });
}

async function handleScopes(route: KnowledgeRoute, tokenId: string): Promise<Response> {
  const { ctx, document, grant } = route;
  // An Editor decides, in person: a token never raises its own scopes, nor another token's.
  if (grant.role !== 'edit' || ctx.token || ctx.workbench) return forbidden();
  if (!isTokenId(tokenId)) return notFound();
  const body = (await ctx.request.json().catch(() => null)) as { scopes?: unknown } | null;
  const scopes = parseAgentScopes(body?.scopes);
  if (!scopes)
    return invalid('invalid_scopes', '"scopes" is a list of "read", "suggest" and "write".');
  await writeScopes(ctx.env, tokenId, scopes);
  console.info('[knowledge] scopes granted', { documentId: document.id, tokenId, scopes });
  return json({ tokenId, scopes });
}

/** Null when the path is none of these routes. `pages/<tab>/...` arrives with its page checked. */
export async function handleAgentRoutes(route: KnowledgeRoute): Promise<Response | null> {
  const { segments, request } = route.ctx;
  if (segments[3] === 'pages' && segments.length === 4) {
    if (request.method === 'GET') return handleList(route);
    return request.method === 'POST' ? handleCreate(route) : methodNotAllowed();
  }
  if (segments[3] === 'context' && segments.length === 4)
    return request.method === 'GET' ? handleContext(route) : methodNotAllowed();
  if (segments[3] === 'agents' && segments.length === 6 && segments[4] && segments[5] === 'scopes')
    return request.method === 'PUT' ? handleScopes(route, segments[4]) : methodNotAllowed();
  return null;
}

/** `GET pages/<tab>`, `PUT pages/<tab>` and `POST pages/<tab>/move`, for a page the knowledgebase holds. */
export function handleAgentPageRoute(
  route: KnowledgeRoute,
  summary: Summary,
): Promise<Response> | Response | null {
  const { segments, request } = route.ctx;
  if (segments.length === 5) {
    if (request.method === 'GET') return handleRead(route, summary);
    return request.method === 'PUT' ? handleWrite(route, summary.id) : methodNotAllowed();
  }
  if (segments.length === 6 && segments[5] === 'move')
    return request.method === 'POST' ? handleMove(route, summary.id) : methodNotAllowed();
  return null;
}
