// The Illustrate verbs (docs/specs/024-agents/illustrate-for-agents.md "The front doors"): `page ls` (the pages
// view), `page set` (change_pages), `article get` (one article as Markdown) and `article set` (write_article),
// over the calls the MCP's change_pages and write_article share. Pages are named by id, place or name; articles
// by id or title.
import { z } from 'zod';
import { PAGE_CHANGES_MAX, type PageChange } from '@livediagram/api-schema';
import { ARTICLE_LOOK_IDS, type ArticleLookId, type PageSizeId } from '@livediagram/document';
import { defineVerb, VerbRefusal, type Verb, type VerbContext } from '../define';
import {
  changePages,
  illustrateTabOf,
  readArticle,
  writeArticle,
  type IllustrateDone,
  type IllustrateRefused,
} from '../illustrate/illustrate-calls';
import { resolveTab } from '../addressing';
import { documentOf, tabPath } from './shared';

const docArg = z.string().describe('A name, id prefix or livediagram URL');
const tabFlag = z
  .string()
  .optional()
  .describe('A tab name or id prefix; the first tab in Illustrate mode when omitted');
const LS_HINT = 'list the pages with: livediagram page ls <doc>';
const CHANGES_HINT = 'see the changes with: livediagram help page set';

const refusal = (r: IllustrateRefused) =>
  new VerbRefusal({
    status: r.code === 'tab_needed' || r.code.endsWith('_unknown') ? 404 : 400,
    code: r.code,
    message: r.change === undefined ? r.message : `change ${r.change + 1}: ${r.message}`,
    hint: LS_HINT,
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
  switched: z.boolean(),
  lines: z.array(z.string()),
  pages: z.array(pageOutput),
  rev: z.number(),
});
const doneOf = (done: IllustrateDone): z.infer<typeof doneOutput> => ({
  tabId: done.tabId,
  switched: done.switched,
  lines: done.lines,
  pages: done.pages,
  rev: done.tab.rev,
});
const pageLine = (p: z.infer<typeof pageOutput>) =>
  `${p.place}  ${p.kind}  ${p.size}  ${p.rect.x},${p.rect.y} ${p.rect.width}x${p.rect.height}  ${p.name ?? ''}`.trimEnd();

export const pageLs = defineVerb({
  id: 'page.ls',
  summary: "List a tab's Illustrate pages and articles",
  description:
    'Prints the pages view of an Illustrate tab: each page with its rectangle on the canvas and the refs on it, each article as Markdown, and the layouts on offer.',
  behaviour: 'read',
  input: z.object({
    doc: docArg,
    tab: tabFlag,
    budget: z.coerce.number().int().min(1).optional().describe('Fit it to about this many tokens'),
  }),
  output: z.object({ text: z.string() }),
  run: async (ctx, input) => {
    const at = await where(ctx, input.doc, input.tab);
    const found = await illustrateTabOf(ctx.api, at.documentId, at.tabId, 'cli');
    if ('ok' in found) throw refusal(found);
    const query = new URLSearchParams({ view: 'pages', door: 'cli' });
    if (input.budget) query.set('budget', String(input.budget));
    const view = await ctx.api.text(`${tabPath(at.documentId, found.tabId)}?${query}`);
    return { text: view.body };
  },
  text: ({ text }) => [text],
  cli: {
    positionals: ['doc'],
    examples: ['livediagram page ls "Pitch deck"', 'livediagram page ls 3f9c --tab Slides'],
    prints: 'the pages view as the api serves it',
  },
});

const sizeArg = z
  .string()
  .optional()
  .describe('A page size id: a4, letter, a3, square, slide, logo, ...');

export const pageSet = defineVerb({
  id: 'page.set',
  summary: "Change a tab's Illustrate pages",
  description:
    'Adds, changes, lays out, moves, duplicates or deletes pages, as one edit: --changes takes a JSON list (a file, or - for stdin) of up to 50, or the flags make one. A tab in another mode, named with --tab, is switched into Illustrate.',
  behaviour: 'destructive',
  input: z.object({
    doc: docArg,
    tab: tabFlag,
    changes: z.string().optional().describe('A JSON file of page changes, or - for stdin'),
    add: z.enum(['infographic', 'slide', 'logo']).optional().describe('Add a page of this kind'),
    page: z.string().optional().describe('The page to change: its id, place or name'),
    name: z.string().optional().describe('Name the page'),
    size: sizeArg,
    orientation: z.enum(['portrait', 'landscape']).optional().describe('Turn the page'),
    layout: z.string().optional().describe('Lay the page out (a layout id from page ls)'),
    move: z.coerce.number().int().min(1).optional().describe('Move the page to this place'),
    duplicate: z.boolean().optional().describe('Copy the page'),
    delete: z.boolean().optional().describe('Delete the page and what is on it'),
  }),
  output: doneOutput,
  run: async (ctx, input) => {
    const changes =
      input.changes !== undefined ? await changesFrom(ctx, input.changes) : [changeFrom(input)];
    const at = await where(ctx, input.doc, input.tab);
    const done = await changePages(
      ctx.api,
      at.documentId,
      { ...(at.tabId ? { tabId: at.tabId } : {}), changes },
      'cli',
    );
    if (!done.ok) throw refusal(done);
    return doneOf(done);
  },
  text: ({ lines, pages }) => [...lines.map((l) => `~ ${l}`), ...pages.map(pageLine)],
  quiet: ({ pages }) => pages.map((p) => p.id),
  cli: {
    positionals: ['doc'],
    examples: [
      'livediagram page set "Pitch deck" --add slide --layout slide-title',
      'livediagram page set 3f9c --changes changes.json',
    ],
    prints: 'what changed, then each page: place, kind, size, rectangle, name',
  },
});

async function changesFrom(ctx: VerbContext, source: string): Promise<PageChange[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await ctx.readInput(source));
  } catch {
    throw new VerbRefusal({
      status: 400,
      code: 'invalid_value',
      message: '--changes is not JSON',
      hint: CHANGES_HINT,
    });
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  if (list.length === 0 || list.length > PAGE_CHANGES_MAX)
    throw new VerbRefusal({
      status: 400,
      code: 'invalid_value',
      message: `--changes holds 1 to ${PAGE_CHANGES_MAX} page changes`,
      hint: CHANGES_HINT,
    });
  // The api reads each one strictly and names the one it refuses.
  return list as PageChange[];
}

type ChangeFlags = {
  add?: 'infographic' | 'slide' | 'logo';
  page?: string;
  name?: string;
  size?: string;
  orientation?: 'portrait' | 'landscape';
  layout?: string;
  move?: number;
  duplicate?: boolean;
  delete?: boolean;
};

function changeFrom(flags: ChangeFlags): PageChange {
  const fields = {
    ...(flags.name !== undefined ? { name: flags.name } : {}),
    ...(flags.size ? { size: flags.size as PageSizeId } : {}),
    ...(flags.orientation ? { orientation: flags.orientation } : {}),
  };
  if (flags.add)
    return {
      op: 'add',
      kind: flags.add,
      ...fields,
      ...(flags.layout ? { layout: flags.layout } : {}),
    };
  const none = () =>
    new VerbRefusal({
      status: 400,
      code: 'invalid_value',
      message: 'say what to do: --add <kind>, or --page <page> with a change, or --changes <file>',
      hint: CHANGES_HINT,
    });
  if (!flags.page) throw none();
  const page = /^\d+$/.test(flags.page) ? Number(flags.page) : flags.page;
  if (flags.delete) return { op: 'delete', page };
  if (flags.duplicate) return { op: 'duplicate', page };
  if (flags.move !== undefined) return { op: 'move', page, to: flags.move };
  if (flags.layout) return { op: 'layout', page, layout: flags.layout };
  if (Object.keys(fields).length) return { op: 'set', page, ...fields };
  throw none();
}

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
    const read = await readArticle(
      ctx.api,
      at.documentId,
      {
        ...(at.tabId ? { tabId: at.tabId } : {}),
        ...(input.article ? { article: input.article } : {}),
      },
      'cli',
    );
    if (!read.ok) throw refusal(read);
    return { flow: read.flow, title: read.title, markdown: read.markdown };
  },
  text: ({ markdown }) => [markdown.replace(/\n$/, '')],
  cli: {
    positionals: ['doc'],
    examples: [
      'livediagram article get "Project brief" > brief.md',
      'livediagram article get 3f9c --article Notes',
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
    new: z.boolean().optional().describe('Start a new article'),
    append: z.boolean().optional().describe('Add after the last block instead of replacing'),
    size: sizeArg,
    orientation: z
      .enum(['portrait', 'landscape'])
      .optional()
      .describe('A new article’s orientation'),
    look: z
      .enum(ARTICLE_LOOK_IDS as [ArticleLookId, ...ArticleLookId[]])
      .optional()
      .describe('clean, classic, report, notebook or bold'),
    accent: z.string().optional().describe('The accent colour, a hex'),
    pageNumbers: z.boolean().optional().describe('Page numbers on'),
  }),
  output: doneOutput.extend({ flow: z.string(), title: z.string(), created: z.boolean() }),
  run: async (ctx, input) => {
    const markdown = await ctx.readInput(input.file);
    const at = await where(ctx, input.doc, input.tab);
    const done = await writeArticle(
      ctx.api,
      at.documentId,
      {
        ...(at.tabId ? { tabId: at.tabId } : {}),
        markdown,
        ...(input.article ? { article: input.article } : {}),
        ...(input.new ? { new: true } : {}),
        ...(input.append ? { mode: 'append' as const } : {}),
        ...(input.size ? { size: input.size as PageSizeId } : {}),
        ...(input.orientation ? { orientation: input.orientation } : {}),
        ...(input.look ? { look: input.look } : {}),
        ...(input.accent ? { accent: input.accent } : {}),
        ...(input.pageNumbers !== undefined ? { pageNumbers: input.pageNumbers } : {}),
      },
      'cli',
    );
    if (!done.ok) throw refusal(done);
    const article = done.article!;
    return { ...doneOf(done), flow: article.flow, title: article.title, created: article.created };
  },
  text: ({ lines }) => lines.map((l) => `~ ${l}`),
  quiet: ({ flow }) => [flow],
  cli: {
    positionals: ['doc', 'file'],
    examples: [
      'livediagram article set "Project brief" brief.md',
      'cat notes.md | livediagram article set 3f9c - --article Notes --append',
    ],
    prints: 'what was written',
  },
});

export const illustrateVerbs: readonly Verb[] = [pageLs, pageSet, articleGet, articleSet] as Verb[];
