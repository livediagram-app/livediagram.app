// The knowledgebase commands (docs/specs/024-agents/knowledgebase-for-agents.md "CLI"): `context`, `pages`, `search`,
// `read`, `new`, `suggest`, `write`, `move` and `gap`, each the CLI's form of an MCP tool and one request to the
// same route (get_context, list_pages, search_pages, read_page, create_page, suggest_edit, write_page, move_page,
// report_gap). A knowledgebase is named as every command names one (a name, an id prefix or a link); a page by its
// id or its title. Every page and passage prints how far it can be trusted. `import` and `export` are the CLI's own
// (they read and write files): verbs/knowledge-files.ts.
import { z } from 'zod';
import type {
  CreatePageResponse,
  KnowledgeAgentContextResponse,
  KnowledgePageReadResponse,
  KnowledgePagesResponse,
  KnowledgeSearchResponse,
  MovePageResponse,
  PagesAnswer,
  SuggestEditResponse,
} from '@liveknowledge/api-schema';
import { resolveDocument } from '../addressing';
import { defineVerb, VerbRefusal, type Verb, type VerbContext } from '../define';
import {
  jsonBody,
  knowledgePath,
  pageRefOf,
  resultTrustOf,
  trustFieldsOf,
  trustLine,
} from '../knowledge';
import {
  createPageOutput,
  getContextOutput,
  listPagesOutput,
  movePageOutput,
  readPageOutput,
  searchPagesOutput,
  SEARCH_MAX_LIMIT,
  suggestEditOutput,
  writePageOutput,
} from '../mcp/knowledge-schema';

const docArg = z.string().describe('The knowledgebase: a name, id prefix or liveknowledge URL');
const pageArg = z.string().describe('The page: its id, or its title when one page alone has it');

// The knowledgebase a command names, its share code applied.
async function knowledgebaseOf(ctx: VerbContext, doc: string): Promise<string> {
  const resolved = await resolveDocument(ctx.api, doc, ctx.host, ctx.log);
  if (resolved.shareCode) ctx.useShareCode(resolved.shareCode);
  return resolved.id;
}

// Each command answers its tool's output, without the line that names the next tool to call.
const named = (p: { page: string; title: string }) => `"${p.title}" (${p.page})`;

export const context = defineVerb({
  id: 'context',
  summary: 'The pages every agent reads first',
  description:
    'Prints the knowledgebase’s Always in Context pages as Markdown, in the order of the page tree and within the context budget, with how far each can be trusted, and what this credential may do there (its role and scopes). Run it first.',
  behaviour: 'read',
  input: z.object({ doc: docArg }),
  output: z.object(getContextOutput).omit({ next: true }),
  run: async (ctx, input) => {
    const id = await knowledgebaseOf(ctx, input.doc);
    const c = await ctx.api.json<KnowledgeAgentContextResponse>(knowledgePath(id, 'context'));
    return {
      knowledgebase: c.name,
      role: c.role,
      scopes: c.scopes,
      budget_tokens: c.budget,
      tokens: c.tokens,
      pages: c.pages.map((p) => ({
        ...pageRefOf(p),
        markdown: p.markdown,
        tokens: p.tokens,
        ...trustFieldsOf(p.trust),
      })),
      left_out: c.leftOut.map((p) => ({ ...pageRefOf(p), tokens: p.tokens })),
      page_count: c.pageCount,
    };
  },
  text: (o) => [
    `${o.knowledgebase} · ${o.page_count} pages · you act as ${o.role} · scopes: ${o.scopes.join(', ')} · ${o.tokens} of ${o.budget_tokens} tokens`,
    ...o.pages.flatMap((p) => ['', `--- ${named(p)} · ${trustLine(p)}`, p.markdown.trimEnd()]),
    ...o.left_out.map((p) => `left out (over the budget): ${named(p)}, ${p.tokens} tokens`),
  ],
  cli: {
    positionals: ['doc'],
    examples: ['liveknowledge context Handbook', 'liveknowledge context 3f9c --json'],
    prints: 'a line on the knowledgebase and this credential, then each context page as Markdown',
  },
});

export const pages = defineVerb({
  id: 'pages',
  summary: 'The page tree',
  description:
    'Prints the knowledgebase’s pages in tree order: each page’s title and id, indented under its parent, with how far it can be trusted (verified, review due, never verified, in conflict). --under prints one page and the pages under it.',
  behaviour: 'read',
  input: z.object({
    doc: docArg,
    under: z.string().optional().describe('Only this page and the pages under it'),
  }),
  output: z.object(listPagesOutput).omit({ next: true, more: true }),
  listKey: 'pages',
  run: async (ctx, input) => {
    const id = await knowledgebaseOf(ctx, input.doc);
    const listed = await ctx.api.json<KnowledgePagesResponse>(knowledgePath(id, 'pages'));
    const rows = listed.pages.map((row) => ({
      ...pageRefOf(row),
      depth: row.depth,
      ...(row.parent ? { parent: row.parent } : {}),
      subpages: row.subpages,
      ...(row.owner ? { owner: row.owner } : {}),
      ...(row.context ? { always_in_context: true as const } : {}),
      ...trustFieldsOf(row.trust),
    }));
    if (input.under === undefined) return { count: rows.length, pages: rows };
    const key = input.under.toLowerCase().replace(/\s+/g, ' ').trim();
    const tops = rows.filter(
      (r) => r.page === input.under || r.title.toLowerCase().replace(/\s+/g, ' ').trim() === key,
    );
    if (tops.length !== 1)
      throw new VerbRefusal({
        status: 404,
        code: tops.length > 1 ? 'page_ambiguous' : 'page_unknown',
        message:
          tops.length > 1
            ? `${tops.length} pages are titled "${input.under}": name one by its id`
            : `no page "${input.under}" in this knowledgebase`,
        lines: tops.map(named),
        hint: `liveknowledge pages ${JSON.stringify(input.doc)}`,
      });
    const at = rows.indexOf(tops[0]!);
    const end = rows.findIndex((r, i) => i > at && r.depth <= tops[0]!.depth);
    const under = rows.slice(at, end < 0 ? rows.length : end);
    return { count: under.length, pages: under };
  },
  text: (o) =>
    o.pages.length === 0
      ? ['no pages']
      : o.pages.map(
          (p) =>
            `${'  '.repeat(p.depth - 1)}${p.title}  (${p.page})  ${trustLine(p)}` +
            (p.always_in_context ? ', always in context' : ''),
        ),
  quiet: (o) => o.pages.map((p) => p.page),
  cli: {
    positionals: ['doc'],
    examples: ['liveknowledge pages Handbook', 'liveknowledge pages Handbook --under Deploys -q'],
    prints: 'one line a page: its title, id and trust, indented by depth',
  },
});

export const search = defineVerb({
  id: 'search',
  summary: 'Find passages',
  description:
    'Searches the knowledgebase’s own index: pages whose title matches first, then passages of the writing, verified pages before others. Each result prints its page, the headings it sits under, how far it can be trusted, and the passage. A search that finds nothing is recorded as a question the knowledgebase could not answer.',
  behaviour: 'read',
  input: z.object({
    doc: docArg,
    query: z.array(z.string()).min(1).describe('What to look for, in plain words'),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(SEARCH_MAX_LIMIT)
      .optional()
      .describe(`At most this many results (default ${SEARCH_MAX_LIMIT})`),
  }),
  output: z.object(searchPagesOutput).omit({ next: true }),
  listKey: 'results',
  run: async (ctx, input) => {
    const id = await knowledgebaseOf(ctx, input.doc);
    const found = await ctx.api.json<KnowledgeSearchResponse>(
      `${knowledgePath(id, 'search')}?q=${encodeURIComponent(input.query.join(' '))}`,
    );
    const shown = found.results.slice(0, input.limit ?? SEARCH_MAX_LIMIT);
    return {
      count: shown.length,
      results: shown.map((r) => ({
        ...pageRefOf(r),
        ...(r.headings.length > 0 ? { heading: r.headings.join(' > ') } : {}),
        ...(r.isTitle || r.text === undefined ? {} : { passage: r.text }),
        ...resultTrustOf(r),
      })),
      more: found.results.length - shown.length,
    };
  },
  text: (o) =>
    o.results.length === 0
      ? ['no passage matches (recorded as a question the knowledgebase could not answer)']
      : [
          ...o.results.flatMap((r) => [
            `${r.title}${r.heading ? ` > ${r.heading}` : ''}  (${r.page})  ${trustLine(r)}`,
            ...(r.passage ? [`  ${r.passage.replace(/\n+/g, '\n  ')}`] : []),
          ]),
          ...(o.more > 0 ? [`${o.more} more: raise --limit`] : []),
        ],
  quiet: (o) => o.results.map((r) => r.page),
  cli: {
    positionals: ['doc', '...query'],
    examples: [
      'liveknowledge search Handbook when do we deploy',
      'liveknowledge search Handbook rollback --limit 3 --json',
    ],
    prints: 'each result’s page, headings and trust, then its passage',
  },
});

export const read = defineVerb({
  id: 'read',
  summary: 'Print a page as Markdown',
  description:
    'Prints one page as Markdown, its links to other pages as [[Title]] with their current titles, then a footer: how far the page can be trusted, the pages that link to it and the pages under it. --heading prints one section, --max-chars the first part. The Markdown is what write and suggest take.',
  behaviour: 'read',
  input: z.object({
    doc: docArg,
    page: pageArg,
    heading: z.string().optional().describe('Only this heading’s section'),
    maxChars: z.coerce
      .number()
      .int()
      .min(1)
      .optional()
      .describe('At most this many characters, cut at a paragraph break'),
  }),
  output: z.object(readPageOutput).omit({ next: true }),
  run: async (ctx, input) => {
    const id = await knowledgebaseOf(ctx, input.doc);
    const query = new URLSearchParams({
      ...(input.maxChars ? { maxChars: String(input.maxChars) } : {}),
      ...(input.heading ? { heading: input.heading } : {}),
    }).toString();
    const { page } = await ctx.api.json<KnowledgePageReadResponse>(
      `${knowledgePath(id, 'pages', input.page)}${query ? `?${query}` : ''}`,
    );
    return {
      ...pageRefOf(page),
      rev: page.rev,
      markdown: page.markdown,
      chars: page.chars,
      left_out: page.leftOut,
      headings: page.headings,
      ...(page.parent ? { parent: page.parent } : {}),
      backlinks: page.backlinks.map(pageRefOf),
      subpages: page.subpages.map(pageRefOf),
      ...trustFieldsOf(page.trust),
    };
  },
  text: (o) => [
    o.markdown.trimEnd(),
    '',
    `--- ${named(o)} · rev ${o.rev} · ${trustLine(o)}`,
    ...(o.left_out > 0 ? [`--- ${o.left_out} of ${o.chars} characters left out`] : []),
    ...(o.backlinks.length ? [`--- linked from: ${o.backlinks.map(named).join(', ')}`] : []),
    ...(o.subpages.length ? [`--- subpages: ${o.subpages.map(named).join(', ')}`] : []),
  ],
  // The Markdown alone, to edit and write back.
  quiet: (o) => [o.markdown.trimEnd()],
  cli: {
    positionals: ['doc', 'page'],
    examples: [
      'liveknowledge read Handbook Deploys',
      'liveknowledge read Handbook Deploys --heading "When we deploy" -q > section.md',
    ],
    prints: 'the page as Markdown, then its trust, backlinks and subpages',
  },
});

export const newPage = defineVerb({
  id: 'new',
  summary: 'Add a page from Markdown',
  description:
    'Adds a page to the knowledgebase from a Markdown file (or - for stdin), under --parent or at the top level. [[Title]] links to the page of that title. The page is never verified: a draft until a person verifies it. Needs the suggest scope.',
  behaviour: 'write',
  input: z.object({
    doc: docArg,
    title: z.string().min(1).describe('The page’s title'),
    file: z
      .string()
      .optional()
      .describe('The Markdown file, or - for stdin; an empty page without'),
    parent: z.string().optional().describe('The page to put it under: its id or title'),
  }),
  output: z.object(createPageOutput).omit({ next: true, url: true }),
  run: async (ctx, input) => {
    const markdown = input.file === undefined ? '' : await ctx.readInput(input.file);
    const id = await knowledgebaseOf(ctx, input.doc);
    const { page } = await ctx.api.json<CreatePageResponse>(
      knowledgePath(id, 'pages'),
      jsonBody('POST', {
        title: input.title,
        ...(markdown.trim() ? { markdown } : {}),
        ...(input.parent ? { parent: input.parent } : {}),
      }),
    );
    return {
      page: page.tab,
      title: page.title,
      ...(page.parent ? { parent: page.parent } : {}),
      verified: 'never-verified' as const,
    };
  },
  text: (o) => [`+ page ${named(o)}${o.parent ? ` under ${o.parent}` : ''} · never verified`],
  quiet: (o) => [o.page],
  cli: {
    positionals: ['doc', 'title', 'file'],
    examples: [
      'liveknowledge new Handbook Hotfixes hotfixes.md --parent Deploys',
      'echo "Any day." | liveknowledge new Handbook Hotfixes -',
    ],
    prints: 'the new page’s title and id',
  },
});

export const suggest = defineVerb({
  id: 'suggest',
  summary: 'Suggest an edit to a page',
  description:
    'Suggests a change to a page for an Editor to accept or dismiss: --old is the passage to replace, exactly as read prints it, and --new what replaces it (--new-file for a file, or - for stdin); without --old the new text is added at the end. Nothing changes until it is accepted. This is how an agent changes a verified page. Needs the suggest scope.',
  behaviour: 'write',
  input: z.object({
    doc: docArg,
    page: pageArg,
    reason: z.string().min(1).describe('Why the page should change, in a sentence'),
    old: z.string().optional().describe('The passage to replace; leave out to append'),
    new: z.string().optional().describe('The Markdown to put there'),
    newFile: z.string().optional().describe('A file holding the new Markdown, or - for stdin'),
  }),
  output: z.object(suggestEditOutput).omit({ next: true, url: true }),
  run: async (ctx, input) => {
    if ((input.new === undefined) === (input.newFile === undefined))
      throw new VerbRefusal({
        status: 400,
        code: 'usage',
        message: 'suggest takes the new text once: --new <text> or --new-file <file>',
        hint: 'liveknowledge suggest <kb> <page> --reason "..." --old "..." --new "..."',
      });
    const after = input.new ?? (await ctx.readInput(input.newFile!));
    const id = await knowledgebaseOf(ctx, input.doc);
    const made = await ctx.api.json<SuggestEditResponse>(
      knowledgePath(id, 'pages', input.page, 'suggestions'),
      jsonBody('POST', {
        reason: input.reason,
        after,
        ...(input.old ? { before: input.old } : {}),
      }),
    );
    return {
      suggestion: made.suggestion.id,
      page: made.suggestion.tab,
      title: made.suggestion.title,
      kind: made.suggestion.kind,
      pending: made.pending,
    };
  },
  text: (o) => [
    `+ suggestion ${o.suggestion} on ${named(o)} (${o.kind}) · ${o.pending} waiting for an Editor`,
  ],
  quiet: (o) => [o.suggestion],
  cli: {
    positionals: ['doc', 'page'],
    examples: [
      'liveknowledge suggest Handbook Deploys --reason "Moved in March" --old "on Tuesdays" --new "on Mondays"',
      'liveknowledge suggest Handbook Deploys --reason "Missing" --new-file hotfixes.md',
    ],
    prints: 'the suggestion’s id and how many wait',
  },
});

export const write = defineVerb({
  id: 'write',
  summary: 'Write a page directly',
  description:
    'Replaces a page’s whole writing with a Markdown file (or - for stdin), or adds it after the last block with --append, at once and with no review. Needs the write scope, and is refused on a verified page: suggest the change there.',
  behaviour: 'destructive',
  input: z.object({
    doc: docArg,
    page: pageArg,
    file: z.string().describe('The Markdown file, or - for stdin'),
    append: z.boolean().optional().describe('Add after the last block instead of replacing'),
  }),
  output: z.object(writePageOutput).omit({ next: true, url: true }),
  run: async (ctx, input) => {
    const markdown = await ctx.readInput(input.file);
    const id = await knowledgebaseOf(ctx, input.doc);
    const done = await ctx.api.json<PagesAnswer>(
      knowledgePath(id, 'pages', input.page),
      jsonBody('PUT', { markdown, ...(input.append ? { mode: 'append' } : {}) }),
    );
    return { page: done.tab.id, rev: done.tab.rev, lines: done.lines };
  },
  text: (o) => [...o.lines.map((l) => `~ ${l}`), `~ page ${o.page} · rev ${o.rev}`],
  quiet: (o) => [o.page],
  cli: {
    positionals: ['doc', 'page', 'file'],
    examples: [
      'liveknowledge write Handbook Hotfixes hotfixes.md',
      'liveknowledge read Handbook Notes -q | sed s/teh/the/ | liveknowledge write Handbook Notes -',
    ],
    prints: 'what was written, and the page’s new revision',
  },
});

export const move = defineVerb({
  id: 'move',
  summary: 'Move a page in the tree',
  description:
    'Moves a page, with the pages under it, under --parent or to the top level (--top), in front of --before or last. With --before alone it goes where that page is. Links to the page keep working. Needs the write scope.',
  behaviour: 'write',
  input: z.object({
    doc: docArg,
    page: pageArg,
    parent: z.string().optional().describe('The page to move it under: its id or title'),
    top: z.boolean().optional().describe('Move it to the top level'),
    before: z.string().optional().describe('The page to put it in front of'),
  }),
  output: z.object(movePageOutput).omit({ next: true }),
  run: async (ctx, input) => {
    if (input.parent !== undefined && input.top)
      throw new VerbRefusal({
        status: 400,
        code: 'usage',
        message: 'move takes --parent <page> or --top, not both',
        hint: 'liveknowledge move <kb> <page> --parent <page>',
      });
    if (input.parent === undefined && !input.top && input.before === undefined)
      throw new VerbRefusal({
        status: 400,
        code: 'usage',
        message: 'move needs somewhere to go: --parent <page>, --top or --before <page>',
        hint: 'liveknowledge move <kb> <page> --top',
      });
    const id = await knowledgebaseOf(ctx, input.doc);
    const { page } = await ctx.api.json<MovePageResponse>(
      knowledgePath(id, 'pages', input.page, 'move'),
      jsonBody('POST', {
        ...(input.parent ? { parent: input.parent } : input.top ? { parent: null } : {}),
        ...(input.before ? { before: input.before } : {}),
      }),
    );
    return {
      page: page.tab,
      title: page.title,
      ...(page.parent ? { parent: page.parent } : {}),
      depth: page.depth,
    };
  },
  text: (o) => [
    `~ ${named(o)} is now at depth ${o.depth}${o.parent ? ` under ${o.parent}` : ', at the top level'}`,
  ],
  quiet: (o) => [o.page],
  cli: {
    positionals: ['doc', 'page'],
    examples: [
      'liveknowledge move Handbook Rollbacks --parent Operations',
      'liveknowledge move Handbook Holidays --top --before Deploys',
    ],
    prints: 'where the page is now',
  },
});

export const gap = defineVerb({
  id: 'gap',
  summary: 'Report a question the knowledgebase could not answer',
  description:
    'Records a question the knowledgebase does not answer, so the team sees it under Questions Nobody Could Answer and can write the page. Changes no page; a read-only token may run it.',
  behaviour: 'write',
  input: z.object({
    doc: docArg,
    question: z.array(z.string()).min(1).describe('The question, as it was asked'),
  }),
  output: z.object({ recorded: z.literal(true), question: z.string() }),
  run: async (ctx, input) => {
    const question = input.question.join(' ');
    const id = await knowledgebaseOf(ctx, input.doc);
    await ctx.api.json<{ key: string }>(
      knowledgePath(id, 'questions'),
      jsonBody('POST', { question }),
    );
    return { recorded: true as const, question };
  },
  text: (o) => [`+ recorded: ${o.question}`],
  cli: {
    positionals: ['doc', '...question'],
    examples: [
      'liveknowledge gap Handbook What is our parental leave policy?',
      'liveknowledge gap 3f9c "Who is on call at weekends?"',
    ],
    prints: 'the question recorded',
  },
});

export const knowledgeVerbs: readonly Verb[] = [
  context,
  pages,
  search,
  read,
  newPage,
  suggest,
  write,
  move,
  gap,
] as Verb[];
