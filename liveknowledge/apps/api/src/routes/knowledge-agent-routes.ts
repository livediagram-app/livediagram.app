// The knowledgebase as an agent reads and shapes it (docs/specs/024-agents/knowledgebase-for-agents.md), each one
// request for one tool of the MCP server or one command of the CLI:
//   GET  /api/documents/<id>/pages                 the page tree with each page's trust (list_pages)
//   GET  /api/documents/<id>/pages/<tab>           one page as Markdown, its backlinks and subpages (read_page)
//   GET  /api/documents/<id>/context               the Always in Context pages within the budget (get_context)
//   POST /api/documents/<id>/pages                 a new page from Markdown (create_page): an Editor, or an
//                                                  Editor's agent holding `suggest`
//   PUT  /api/documents/<id>/pages/<tab>           the page's writing replaced, or added to (write_page): Editor;
//                                                  an agent needs `write`, and goes as far as AI Editing allows
//   POST /api/documents/<id>/pages/<tab>/move      a page moved in the tree (move_page): Editor; an agent holding
//                                                  `suggest` moves a page whose subtree is all Never Verified
//   PUT  /api/documents/<id>/agents/<token>/scopes what an API token may do here: an Editor in person
// Reading is every role's. A page read here is counted as `GET tabs/<tab>` counts it. `<tab>`, `parent` and `before`
// take a page's id, or its title when one page alone has it.
import {
  countPages,
  knowledgePagesMax,
  pagesRefused,
  pageTreeConflict,
  workerTierOf,
} from '../knowledge/tier-limits';
import { asTabWriter, queueAgentChanged } from '@liveworkspace/automations/room';
import { routeWho } from '../document-room/automations/knowledge-who';
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
  type KnowledgeTreeRow,
  type MovePageRequest,
} from '@liveknowledge/api-schema';
import {
  ARTICLE_MARKDOWN_MAX,
  MAX_KNOWLEDGEBASE_PAGES,
  isConnectedRow,
  pageByTitleIn,
  pageCount,
  pageMoveRefusal,
  pageTreeRows,
  withPageMoved,
} from '@liveknowledge/document';
import {
  agentCoverOf,
  agentPageIconOf,
  newPageFromMarkdown,
  withTitleFrontMatter,
} from '@liveknowledge/edit-operations';
import {
  CONTEXT_BUDGET_TOKENS,
  aiEditUnverifies,
  aiEditingOf,
  assembleContext,
  backlinkRows,
  backlinks,
  cutMarkdown,
  markdownHeadings,
  markdownSection,
  parseKnowledgeFields,
  trustState,
  verificationOn,
} from '@liveknowledge/knowledge';
import { readStoredTab } from '../changesets/stored-tab';
import { isTabRevStale, reorderTabs, upsertTabAtRev } from '../db';
import {
  readStoredPages,
  tabParentRefusal,
  writeTabParents,
} from '../document-room/page-tree-store';
import { isTokenId, writeScopes } from '../knowledge/agent-grants';
import { notePageWrite } from '../knowledge/page-authors';
import { writerOf } from '../knowledge/page-writer';
import { noteWatched, writerActor } from '../knowledge/watch-notes';
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
import { pageHealthWires } from '../knowledge/page-health-read';
import { TabTooLargeError } from '../limits';
import { capStoredName } from '../names';
import { getParticipant, getParticipants } from '../person/profiles';
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
import { requireOwner, writesPages } from './context';
import { withAgentSentFrom } from './agent-sent-from';
import { labelNamesOf, labelScopeOf, labelsParam } from '../knowledge/label-scope';
import type { KnowledgeRoute } from './knowledge-routes';

const invalid = (error: string, message: string) => json({ error, message }, { status: 400 });

/** The largest `maxChars` a read takes: a page's Markdown is never longer. */
const READ_MAX_CHARS = ARTICLE_MARKDOWN_MAX;

type Summary = DocumentDTO['tabs'][number];
const treeOf = (document: DocumentDTO) =>
  pageTreeRows(document.tabs.map((t) => ({ ...t, parent: t.parent })));
const refOf = (t: Summary): KnowledgePageRef => ({ tab: t.id, title: t.name });
// The pages alone: a connected file in the tree (links-and-embeds.md "Connected files in the sidebar") is no page, so
// it is never named, placed under, linked to or counted as one.
const pagesOf = (document: DocumentDTO) => document.tabs.filter((t) => !isConnectedRow(t));

async function handleList({ ctx, document }: KnowledgeRoute): Promise<Response> {
  const now = Date.now();
  const { reviewEvery } = document.knowledgeSettings;
  // `labels=` lists only the pages carrying any of them (page-surface.md "Page labels"), in tree order.
  const scope = labelScopeOf(document, labelsParam(ctx.url.searchParams));
  if (scope instanceof Response) return scope;
  const { byTab } = await openConflictPages(ctx.env, document.tabs);
  // A page outside a scoped caller's scope is never listed (a page-confined link is refused before this).
  const rows = treeOf(document).filter(
    (row) => !row.page.outOfScope && (!scope || scope.tabs.has(row.page.id)),
  );
  const pages: KnowledgeTreeRow[] = rows.map(({ page, depth, subpages }) => {
    if (page.connection)
      return {
        ...refOf(page),
        kind: 'connected' as const,
        app: page.connection.app,
        depth,
        ...(page.parent ? { parent: page.parent } : {}),
        subpages: 0 as const,
      };
    const fields = parseKnowledgeFields(page.knowledge);
    const labels = labelNamesOf(document, page.labels);
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
      ...(labels ? { labels } : {}),
      ...(Number.isFinite(page.updatedAt) ? { updatedAt: page.updatedAt } : {}),
    } satisfies KnowledgePageRow;
  });
  // The owners' names, only when asked (an export's front matter, knowledgebase-export.md): one accounts read.
  let names: Record<string, string> | undefined;
  if (ctx.url.searchParams.get('names') === '1') {
    const owners = [...new Set(pages.flatMap((p) => ('owner' in p && p.owner ? [p.owner] : [])))];
    const people = await getParticipants(ctx.env, owners);
    names = {};
    for (const [id, person] of people) if (person.name) names[id] = person.name;
  }
  // The Review Period, said once: every page's `reviewAt` is its `verifiedAt` plus this.
  return json({ reviewEvery, pages, ...(names ? { names } : {}) } satisfies KnowledgePagesResponse);
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
  const [stored, linking, conflicts, verifier, health] = await Promise.all([
    readStoredTab(ctx.env, document.id, summary.id),
    rowsOf<{ fromTab: string }>(ctx.env, backlinkRows(summary.id)),
    openConflictPages(ctx.env, document.tabs),
    fields.verifiedBy ? getParticipant(ctx.env, fields.verifiedBy) : null,
    // The page's Health Score for the agent to weigh it by (verification.md "For agents and Ask"): one read.
    pageHealthWires(ctx.env, document.id, document.knowledgeSettings.reviewEvery, now, [
      summary.id,
    ]),
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
  // A link confined to one page reads the visitor's copy (knowledge-routes.ts): the pages it cannot see are no
  // backlink, subpage, parent or conflict of this one.
  const byId = new Map(document.tabs.filter((t) => !t.outOfScope).map((t) => [t.id, t]));
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
      conflictsWith: conflicts.byTab.get(summary.id)?.filter((p) => byId.has(p.tab)),
      verifiedBy: verifier?.name || undefined,
      health: health.get(summary.id),
    }),
    ...(summary.parent && byId.has(summary.parent) ? { parent: summary.parent } : {}),
    backlinks: backlinks(
      summary.id,
      linking.map((r) => r.fromTab),
      order,
    ).flatMap((id) => (byId.has(id) ? [refOf(byId.get(id)!)] : [])),
    subpages: pagesOf(document)
      .filter((t) => t.parent === summary.id)
      .map(refOf),
  };
  // The page's cover, as an agent names one (page-surface.md "The cover").
  const cover = agentCoverOf(stored.tab.cover);
  if (cover) page.cover = cover;
  // Its icon, an emoji or a catalogue icon (page-surface.md "The page icon").
  const icon = agentPageIconOf(stored.tab.icon);
  if (icon) page.icon = icon;
  // Its labels by name (page-surface.md "Page labels").
  const labels = labelNamesOf(document, summary.labels);
  if (labels) page.labels = labels;
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
  // Each context page's Health Score: one read for them all; and the open conflicts, one read of at most 50, for the
  // question each disputed page answers differently (knowledgebase-for-agents.md "Conflicts for agents").
  const [health, conflicts] = await Promise.all([
    pageHealthWires(
      ctx.env,
      document.id,
      document.knowledgeSettings.reviewEvery,
      now,
      context.pages.map((p) => p.id),
    ),
    context.pages.length > 0 ? openConflictPages(ctx.env, document.tabs) : null,
  ]);
  const answer: KnowledgeAgentContextResponse = {
    name: document.name,
    role: grant.role,
    scopes:
      grant.scopes ??
      agentScopesFor({ readOnly: false, role: grant.role, granted: ['write', 'suggest'] }),
    budget: CONTEXT_BUDGET_TOKENS,
    tokens: context.tokens,
    reviewEvery: document.knowledgeSettings.reviewEvery,
    // How far an agent may change pages itself here (ai-editing.md "For agents").
    aiEditing: aiEditingOf(document.knowledgeSettings),
    aiEditUnverifies: aiEditUnverifies(document.knowledgeSettings),
    pages: context.pages.map((p) => ({
      tab: p.id,
      title: p.title,
      markdown: p.markdown,
      tokens: p.tokens,
      trust: pageTrustOf(knowledgeOf.get(p.id), document.knowledgeSettings.reviewEvery, now, {
        conflictsWith: conflicts?.byTab.get(p.id),
        health: health.get(p.id),
      }),
    })),
    leftOut: context.leftOut.map((p) => ({ tab: p.id, title: p.title, tokens: p.tokens })),
    pageCount: pageCount(document.tabs),
  };
  return json(answer);
}

// A page a request places another by (`parent`, `before`): its id, or its title when one page alone has it.
function placeOf(document: DocumentDTO, ref: unknown, key = 'parent'): string | Response {
  const pages = pagesOf(document);
  const found = typeof ref === 'string' && ref ? pageNamed(pages, ref) : undefined;
  if (found && found !== 'ambiguous') return found.id;
  if (typeof ref !== 'string' || !ref)
    return invalid(`invalid_${key}`, `"${key}" is a page's id or title.`);
  return json(pageUnknownBody(pages, ref, found), { status: 409 });
}

async function handleWrite(route: KnowledgeRoute, tab: string): Promise<Response> {
  const { ctx, document } = route;
  const body = (await ctx.request.json().catch(() => null)) as {
    markdown?: unknown;
    mode?: unknown;
    cover?: unknown;
    after?: unknown;
    picture?: unknown;
  } | null;
  // A cover alone changes no writing (docs/specs/030-knowledgebase/page-surface.md "The cover"): it is sent on its
  // own, and read strictly by the Pages route.
  const cover = body && 'cover' in body ? { cover: body.cover } : {};
  if (body && 'cover' in body && body.markdown === undefined) {
    if (body.mode !== undefined)
      return invalid('invalid_mode', '"mode" goes with "markdown"; a cover alone takes none.');
    return handleTabPages({ ...ctx, request: pagesRequest(ctx.request, cover) }, document.id, tab);
  }
  if (typeof body?.markdown !== 'string' || !body.markdown.trim())
    return invalid(
      'no_markdown',
      'Send "markdown": the page\'s writing as Markdown, or "cover" alone to set or remove the page\'s cover.',
    );
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
  // Under a heading, with a picture (send-to-knowledge.md): read strictly by the Pages route, with an append alone.
  const request = pagesRequest(ctx.request, {
    article: {
      markdown,
      ...(body.mode ? { mode: body.mode } : {}),
      ...(body.after !== undefined ? { after: body.after } : {}),
      ...(body.picture !== undefined ? { picture: body.picture } : {}),
    },
    ...cover,
  });
  return handleTabPages({ ...ctx, request }, document.id, tab);
}

// The Pages route's request for a knowledge write: the caller's own headers (its token, its front door).
const pagesRequest = (from: Request, body: object): Request =>
  new Request(from.url, { method: 'POST', headers: from.headers, body: JSON.stringify(body) });

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
  // A page is an Editor's or a Participant's to add; an Editor's agent adds one with `suggest` (a page it makes is
  // never Verified, and a person reads it before trusting it).
  const may = grant.scopes
    ? grant.personRole === 'edit' && grant.scopes.includes('suggest')
    : writesPages(grant);
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
  const [stored, tier] = await Promise.all([
    readStoredPages(ctx.env, document.id),
    workerTierOf(ctx.env, document),
  ]);
  const refusal = tabParentRefusal(stored, id, under, false, knowledgePagesMax());
  if (refusal) return pageTreeConflict(refusal);
  // The owner's Knowledgebase Pages over all of theirs (tiers.md).
  const over = await countPages(tier, document.id, pageCount(stored) + 1);
  if (over) return pagesRefused(tier, over);
  const existing = pageByTitleIn(
    pagesOf(document).map((t) => ({ id: t.id, name: t.name, parent: t.parent })),
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
    // A page an agent makes says so, for a Page Added rule (docs/specs/013-workspace/automations.md).
    rev = await asTabWriter(
      ctx.env,
      'tab_added',
      () => routeWho(ctx),
      () => upsertTabAtRev(ctx.env, document.id, tab, nextOrderIndex(document.tabs), 0),
    );
  } catch (err) {
    if (err instanceof TabTooLargeError) return payloadTooLarge();
    if (isTabRevStale(err)) return conflict('tab_busy');
    throw err;
  }
  // Who made it (verification.md "Made by a person or an agent"): an agent's create_page, or a person's Import.
  await notePageWrite(ctx.env, id, writerOf(ctx, owner));
  // Agent Made Changes: once for the page a token made.
  if (ctx.token) {
    const who = await routeWho(ctx);
    queueAgentChanged(ctx.env, {
      key: `create:${id}`,
      tab: id,
      author: { ...who.by, id: owner },
      tokenName: ctx.token.name ?? null,
    });
  }
  await relayTree(route);
  console.info('[knowledge] page created', {
    documentId: document.id,
    tabId: id,
    agent: ctx.token !== null && ctx.token !== undefined,
    chars: markdown.length,
  });
  return json(
    {
      page: { tab: id, title, ...(under ? { parent: under } : {}), rev },
      // A new page is never verified; under a Review Period of Never verification is off (verification.md).
      trust: verificationOn(document.knowledgeSettings.reviewEvery) ? 'never-verified' : 'off',
    },
    { status: 201 },
  );
}

// Moving a page changes none of its writing, so a connection holding `suggest` arranges the drafts it makes: a page
// whose subtree is all Never Verified (knowledgebase-for-agents.md "Moving pages with the suggest scope"). A page a
// person vouched for, or one with such a page under it, still needs `write`. AI Editing does not bound a move.
const STATE_WORDS = { verified: 'is verified', 'review-due': 'is due for review' } as const;

/** The first page in the subtree at `tab` (itself, then the pages under it in tree order) that a person verified,
 *  with its state; null when every one is Never Verified. A Review Period of Never keeps a page verified before it
 *  was turned off verified, as AI Editing reads it (agent-write-gate.ts). */
function verifiedInSubtree(
  document: DocumentDTO,
  tab: string,
  now = Date.now(),
): { summary: Summary; state: keyof typeof STATE_WORDS } | null {
  const under = new Set([tab]);
  for (const row of treeOf(document)) {
    const id = row.page.id;
    if (id !== tab && !(row.page.parent && under.has(row.page.parent))) continue;
    under.add(id);
    const { state } = trustState(
      parseKnowledgeFields(row.page.knowledge),
      document.knowledgeSettings.reviewEvery,
      now,
    );
    if (state !== 'never-verified') return { summary: row.page, state };
  }
  return null;
}

/** Null when the caller may move the page at `tab`; else the refusal. */
function moveRefusal(route: KnowledgeRoute, tab: string): Response | null {
  const { ctx, document, grant } = route;
  if (writesPages(grant)) return null;
  // A Viewer's connection and a read-only one never move a page; an Editor's or a Participant's holding `suggest`
  // moves drafts (a Participant moves pages in person).
  const drafts =
    grant.scopes?.includes('suggest') === true &&
    (grant.personRole === 'edit' || grant.personRole === 'participate');
  if (!drafts) return forbidden();
  const held = verifiedInSubtree(document, tab);
  if (!held) return null;
  const which =
    held.summary.id === tab
      ? `"${held.summary.name}" ${STATE_WORDS[held.state]}`
      : `"${held.summary.name}", under the page you are moving, ${STATE_WORDS[held.state]}`;
  console.info('[knowledge] scope needed', {
    documentId: document.id,
    tokenId: ctx.token?.id,
    needs: 'write',
    tabId: tab,
    held: held.summary.id,
  });
  return json(
    {
      error: 'scope_needed',
      needs: 'write',
      scopes: grant.scopes,
      page: { tab: held.summary.id, title: held.summary.name, state: held.state },
      message: `This connection holds the suggest scope here, so it moves only never-verified pages. ${which}. Ask an Editor of the knowledgebase to move it, or to grant this connection the write scope.`,
    },
    { status: 403 },
  );
}

async function handleMove(route: KnowledgeRoute, tab: string): Promise<Response> {
  const { ctx, document } = route;
  const refusal = moveRefusal(route, tab);
  if (refusal) return refusal;
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
  const treeRefusal = pageMoveRefusal(stored, tab, to);
  if (treeRefusal) return conflict(treeRefusal);
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
    // A new parent is a move to the page's watchers (watching.md "Moved"); a reorder among siblings is not.
    if ((stored.find((p) => p.id === tab)?.parent ?? undefined) !== (parent ?? undefined))
      await noteWatched(ctx.env, {
        tabs: [tab],
        kind: 'moved',
        actor: writerActor(ctx.env, writerOf(ctx, ctx.resolveOwner() ?? '')),
      });
  }
  const after = moved ? await relayTree(route) : document;
  const row = (after ? treeOf(after) : []).find((r) => r.page.id === tab);
  console.info('[knowledge] page moved', {
    documentId: document.id,
    tabId: tab,
    moved: !!moved,
    agent: ctx.token !== null && ctx.token !== undefined,
  });
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

const createdPage = (answer: Record<string, unknown>) => {
  const page = answer.page as { tab?: unknown; title?: unknown } | undefined;
  return typeof page?.tab === 'string'
    ? { id: page.tab, title: typeof page.title === 'string' ? page.title : '' }
    : null;
};

/** Null when the path is none of these routes. `pages/<tab>/...` arrives with its page checked. */
export async function handleAgentRoutes(route: KnowledgeRoute): Promise<Response | null> {
  const { segments, request } = route.ctx;
  if (segments[3] === 'pages' && segments.length === 4) {
    if (request.method === 'GET') return handleList(route);
    if (request.method !== 'POST') return methodNotAllowed();
    // A page made from another app's item names it (send-to-knowledge.md "Agents").
    return withAgentSentFrom(route, createdPage, handleCreate);
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
  // A connected file is no page: it is not read or written here (move_page still places it).
  if (summary.connection && !(segments.length === 6 && segments[5] === 'move'))
    return json(
      {
        error: 'connected_file',
        message: `"${summary.name}" is a connected file from another app in the sidebar, not a page: it has no writing here.`,
      },
      { status: 404 },
    );
  if (segments.length === 5) {
    if (request.method === 'GET') return handleRead(route, summary);
    if (request.method !== 'PUT') return methodNotAllowed();
    return withAgentSentFrom(
      route,
      () => ({ id: summary.id, title: summary.name }),
      (r) => handleWrite(r, summary.id),
    );
  }
  if (segments.length === 6 && segments[5] === 'move')
    return request.method === 'POST' ? handleMove(route, summary.id) : methodNotAllowed();
  return null;
}
