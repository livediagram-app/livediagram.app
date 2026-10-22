// The Pages verbs (docs/specs/024-agents/pages-for-agents.md "The front doors"): `page ls` (the pages
// view) and `page set` (change_pages), over the call the MCP's change_pages shares. Pages are named by id,
// place or name.
import { z } from 'zod';
import { PAGE_CHANGES_MAX, type PageChange } from '@livedesign/api-schema';
import { PAGE_SIZE_IDS, type PageSizeId } from '@livedesign/document';
import { defineVerb, VerbRefusal, type Verb, type VerbContext } from '../define';
import { changePages, pagesTabOf, type PagesDone, type PagesRefused } from '../pages/pages-calls';
import { resolveTab } from '../addressing';
import { documentOf, tabPath } from './shared';

const docArg = z.string().describe('A name, id prefix or livedesign URL');
const tabFlag = z
  .string()
  .optional()
  .describe('A tab name or id prefix; the first tab when omitted');
const LS_HINT = 'list the pages with: livedesign page ls <doc>';
const CHANGES_HINT = 'see the changes with: livedesign help page set';

const refusal = (r: PagesRefused) =>
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
  kind: z.string().nullable(),
  size: z.string(),
  orientation: z.string().nullable(),
  rect: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  background: z.string().nullable(),
  locked: z.boolean(),
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
const pageLine = (p: z.infer<typeof pageOutput>) =>
  `${p.place}  ${p.kind ?? 'blank'}  ${p.size}  ${p.rect.x},${p.rect.y} ${p.rect.width}x${p.rect.height}  ${p.name ?? ''}`.trimEnd();

export const pageLs = defineVerb({
  id: 'page.ls',
  summary: "List a tab's pages",
  description:
    'Prints the pages view of a Pages tab: each page with its rectangle on the canvas and the refs on it, and the layouts on offer.',
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
    examples: ['livedesign page ls "Brand kit"', 'livedesign page ls 3f9c --tab Logos'],
    prints: 'the pages view as the api serves it',
  },
});

const sizeArg = z
  .string()
  .optional()
  .describe(`A page size id: ${PAGE_SIZE_IDS.join(', ')}`);

export const pageSet = defineVerb({
  id: 'page.set',
  summary: "Change a tab's pages",
  description:
    'Adds, changes, lays out, moves, duplicates or deletes pages, as one edit: --changes takes a JSON list (a file, or - for stdin) of up to 50, or the flags make one.',
  behaviour: 'destructive',
  input: z.object({
    doc: docArg,
    tab: tabFlag,
    changes: z.string().optional().describe('A JSON file of page changes, or - for stdin'),
    add: z.enum(['logo', 'wireframe', 'photo']).optional().describe('Add a page of this kind'),
    page: z.string().optional().describe('The page to change: its id, place or name'),
    name: z.string().optional().describe('Name the page'),
    size: sizeArg,
    orientation: z.enum(['portrait', 'landscape']).optional().describe('Turn the page'),
    layout: z.string().optional().describe('Lay the page out (a layout id from page ls)'),
    move: z.coerce.number().int().min(1).optional().describe('Move the page to this place'),
    duplicate: z.boolean().optional().describe('Copy the page'),
    backgroundToAll: z.boolean().optional().describe('Its background onto every page of its kind'),
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
      'livedesign page set "Brand kit" --add logo --layout logo-icon-above',
      'livedesign page set 3f9c --changes changes.json',
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
  add?: 'logo' | 'wireframe' | 'photo';
  page?: string;
  name?: string;
  size?: string;
  orientation?: 'portrait' | 'landscape';
  layout?: string;
  move?: number;
  duplicate?: boolean;
  backgroundToAll?: boolean;
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
  if (flags.backgroundToAll) return { op: 'apply_background_to_all', page };
  if (flags.move !== undefined) return { op: 'move', page, to: flags.move };
  if (flags.layout) return { op: 'layout', page, layout: flags.layout };
  if (Object.keys(fields).length) return { op: 'set', page, ...fields };
  throw none();
}

export const pagesVerbs: readonly Verb[] = [pageLs, pageSet] as Verb[];
