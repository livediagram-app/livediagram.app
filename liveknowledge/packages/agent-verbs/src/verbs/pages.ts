// The Pages verbs (docs/specs/024-agents/pages-for-agents.md "The front doors"): `page ls` (the pages
// view), `article get` (one article as Markdown) and `article set` (write_article), over the calls the MCP's
// write_article shares. Articles are named by id or title.
import { z } from 'zod';
import { defineVerb, VerbRefusal, type Verb, type VerbContext } from '../define';
import {
  pagesTabOf,
  readArticle,
  writeArticle,
  type PagesDone,
  type PagesRefused,
} from '../pages/pages-calls';
import { resolveTab } from '../addressing';
import { HELD_RETRY_INTERVAL_MS, writeFlags } from '../write';
import { documentOf, tabPath } from './shared';

const docArg = z.string().describe('A name, id prefix or liveknowledge URL');
const tabFlag = z
  .string()
  .optional()
  .describe('A tab name or id prefix; the first tab when omitted');
const LS_HINT = 'list the pages with: liveknowledge page ls <doc>';
// A paragraph someone is typing in (spec "Held paragraphs"): waiting is the way through, not another listing.
const HELD_HINT = 'wait for them to pause with: --wait-held <seconds>';

const refusal = (r: PagesRefused) =>
  new VerbRefusal({
    status: r.code === 'tab_needed' || r.code.endsWith('_unknown') ? 404 : 400,
    code: r.code,
    message: r.message,
    hint: r.code === 'paragraphs_held' ? HELD_HINT : LS_HINT,
  });

// The document, and the tab named (by name or id prefix) when one is.
async function where(ctx: VerbContext, doc: string, tab: string | undefined) {
  const document = await documentOf(ctx, doc);
  const tabId = tab ? resolveTab(document.tabs, tab, doc, ctx.log).id : undefined;
  return { documentId: document.id, tabId };
}

const pageOutput = z.object({
  place: z.number(),
  id: z.string(),
  name: z.string().nullable(),
  kind: z.string(),
  size: z.string(),
  orientation: z.string().nullable(),
  rect: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  background: z.string().nullable(),
  locked: z.boolean(),
  flow: z.string().nullable(),
  elements: z.number(),
});
const doneOutput = z.object({
  tabId: z.string(),
  lines: z.array(z.string()),
  pages: z.array(pageOutput),
  rev: z.number(),
});
const doneOf = (done: PagesDone): z.infer<typeof doneOutput> => ({
  tabId: done.tabId,
  lines: done.lines,
  pages: done.pages,
  rev: done.tab.rev,
});
export const pageLs = defineVerb({
  id: 'page.ls',
  summary: "List a tab's pages and articles",
  description:
    'Prints the pages view of a Pages tab: each page with its rectangle on the canvas and the refs on it, each article as Markdown, and the layouts on offer.',
  behaviour: 'read',
  input: z.object({
    doc: docArg,
    tab: tabFlag,
    budget: z.coerce.number().int().min(1).optional().describe('Fit it to about this many tokens'),
  }),
  output: z.object({ text: z.string() }),
  run: async (ctx, input) => {
    const at = await where(ctx, input.doc, input.tab);
    const found = await pagesTabOf(ctx.api, at.documentId, at.tabId);
    if ('ok' in found) throw refusal(found);
    const query = new URLSearchParams({ view: 'pages', door: 'cli' });
    if (input.budget) query.set('budget', String(input.budget));
    const view = await ctx.api.text(`${tabPath(at.documentId, found.tabId)}?${query}`);
    return { text: view.body };
  },
  text: ({ text }) => [text],
  cli: {
    positionals: ['doc'],
    examples: ['liveknowledge page ls "Pitch deck"', 'liveknowledge page ls 3f9c --tab Slides'],
    prints: 'the pages view as the api serves it',
  },
});

export const articleGet = defineVerb({
  id: 'article.get',
  summary: 'Print an article as Markdown',
  description:
    'Prints an article’s writing as the Markdown article set takes (front matter for the title, [zone <id>] lines for its zones), to edit and write back.',
  behaviour: 'read',
  input: z.object({
    doc: docArg,
    tab: tabFlag,
    article: z
      .string()
      .optional()
      .describe('The article by id or title; the only one when omitted'),
  }),
  output: z.object({ flow: z.string(), title: z.string(), markdown: z.string() }),
  run: async (ctx, input) => {
    const at = await where(ctx, input.doc, input.tab);
    const read = await readArticle(ctx.api, at.documentId, {
      ...(at.tabId ? { tabId: at.tabId } : {}),
      ...(input.article ? { article: input.article } : {}),
    });
    if (!read.ok) throw refusal(read);
    return { flow: read.flow, title: read.title, markdown: read.markdown };
  },
  text: ({ markdown }) => [markdown.replace(/\n$/, '')],
  cli: {
    positionals: ['doc'],
    examples: [
      'liveknowledge article get "Project brief" > brief.md',
      'liveknowledge article get 3f9c --article Notes',
    ],
    prints: 'the article as Markdown',
  },
});

export const articleSet = defineVerb({
  id: 'article.set',
  summary: 'Write an article from Markdown',
  description:
    'Writes an article from a Markdown file (or - for stdin): a new one, or over or after (--append) one named by id or title. The editor flows it onto as many pages as it needs.',
  behaviour: 'destructive',
  input: z.object({
    doc: docArg,
    tab: tabFlag,
    file: z.string().describe('The Markdown file, or - for stdin'),
    article: z.string().optional().describe('The article by id or title'),
    append: z.boolean().optional().describe('Add after the last block instead of replacing'),
    // No look and no accent: a page has no style of its own; the look is the knowledgebase's, set once for every
    // page (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style").
    // A paragraph a person is typing in holds the write back (docs/specs/024-agents/pages-for-agents.md "Held
    // paragraphs"): retried every HELD_RETRY_INTERVAL_MS while the next try fits in the seconds given.
    waitHeld: writeFlags.waitHeld.describe(
      'Retry this many seconds while people hold the paragraphs',
    ),
  }),
  output: doneOutput.extend({ flow: z.string(), title: z.string(), created: z.boolean() }),
  run: async (ctx, input) => {
    const markdown = await ctx.readInput(input.file);
    const at = await where(ctx, input.doc, input.tab);
    const write = () =>
      writeArticle(
        ctx.api,
        at.documentId,
        {
          ...(at.tabId ? { tabId: at.tabId } : {}),
          markdown,
          ...(input.article ? { article: input.article } : {}),
          ...(input.append ? { mode: 'append' as const } : {}),
        },
        'cli',
      );
    const started = ctx.now();
    let done = await write();
    for (let attempt = 1; !done.ok && done.code === 'paragraphs_held'; attempt += 1) {
      if (!input.waitHeld || ctx.now() - started + HELD_RETRY_INTERVAL_MS > input.waitHeld * 1000)
        break;
      ctx.log(`held retry ${attempt}`);
      await ctx.sleep(HELD_RETRY_INTERVAL_MS);
      done = await write();
    }
    if (!done.ok) throw refusal(done);
    const article = done.article!;
    return { ...doneOf(done), flow: article.flow, title: article.title, created: article.created };
  },
  text: ({ lines }) => lines.map((l) => `~ ${l}`),
  quiet: ({ flow }) => [flow],
  cli: {
    positionals: ['doc', 'file'],
    examples: [
      'liveknowledge article set "Project brief" brief.md',
      'cat notes.md | liveknowledge article set 3f9c - --article Notes --append',
    ],
    prints: 'what was written',
  },
});

// No `page set`: a page is one continuous page of writing (docs/specs/002-project-scope/not-in-liveknowledge.md).
export const pagesVerbs: readonly Verb[] = [pageLs, articleGet, articleSet] as Verb[];
