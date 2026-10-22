// The tab verbs that read (docs/specs/015-api/cli.md "Commands"): the tabs of a project and a view of one, as
// the api serves them.

import { z } from 'zod';
import { revOfEtag, TAB_VIEW_NAMES } from '@liveplanner/api-schema';
import { readPlainTab, recordCopy, type ReadCopy } from '../copies';
import { defineVerb, type VerbContext } from '../define';
import { shortestUniquePrefixes } from '../refs';
import { columns, projectOf, tabOf, tabPath } from './shared';

const tabFlag = z
  .string()
  .optional()
  .describe('A tab name or id prefix; the first tab when omitted');

// A project's tabs as `tab ls` lists them: in order, numbered from 1, each with the shortest unique ref. The CLI
// lists a pull file's tabs with it too.
export function tabListOf(tabs: readonly { id: string; name: string; orderIndex: number }[]) {
  const ordered = [...tabs].sort((a, b) => a.orderIndex - b.orderIndex);
  const refs = shortestUniquePrefixes(ordered.map((t) => t.id));
  return ordered.map((t, i) => ({ index: i + 1, ref: refs.get(t.id)!, id: t.id, name: t.name }));
}

export const tabLs = defineVerb({
  id: 'tab.ls',
  summary: "The project's tabs",
  description: 'Lists the tabs of a project in order: position, ref and name.',
  behaviour: 'read',
  input: z.object({ project: z.string().describe('A name, id prefix or liveplanner URL') }),
  output: z.object({
    tabs: z.array(
      z.object({ index: z.number(), ref: z.string(), id: z.string(), name: z.string() }),
    ),
  }),
  listKey: 'tabs',
  run: async (ctx, { project: projectRef }) => {
    const project = await projectOf(ctx, projectRef);
    return { tabs: tabListOf(project.tabs) };
  },
  text: ({ tabs }) =>
    tabs.length
      ? columns(tabs.map((t) => [String(t.index), t.ref, JSON.stringify(t.name)]))
      : ['no tabs'],
  quiet: ({ tabs }) => tabs.map((t) => t.ref),
  cli: {
    positionals: ['project'],
    examples: ['liveplanner tab ls "Auth flow"', 'liveplanner tab ls 3f9c -q'],
    prints: 'one tab a line: position, ref, name',
  },
});

// A view the api serves, as text or (with --json) its JSON.
const viewOutput = z.object({ text: z.string().optional(), json: z.unknown().optional() });

const viewQuery = (params: Record<string, string | number | boolean | undefined>) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([key, value]) => `${key}=${encodeURIComponent(value === true ? '1' : String(value))}`)
    .join('&');

// The plain tab read beside a view becomes a read copy when both name the same revision; a read that raced a write
// is repeated once, and kept only if it then agrees (CLI24).
async function keepCopyOf(
  ctx: VerbContext,
  projectId: string,
  tabId: string,
  viewRev: number | null,
  plain: ReadCopy | null,
): Promise<void> {
  if (!ctx.copies || viewRev === null) return;
  const agreed = plain?.rev === viewRev ? plain : await readPlainTab(ctx, projectId, tabId);
  if (agreed?.rev !== viewRev) {
    ctx.log(`copy skipped ${projectId}/${tabId} view rev ${viewRev}`);
    return;
  }
  await ctx.copies.record(projectId, tabId, agreed);
  ctx.log(`copy recorded ${projectId}/${tabId} rev ${agreed.rev}`);
}

export const tabView = defineVerb({
  id: 'tab.view',
  summary: 'A view of a tab; the outline by default',
  description:
    'Prints a view of a tab as the api renders it: outline (default), comments, show (needs --ref), or find (needs --text). --budget fits it to that many tokens; --raw prints the plain tab instead.',
  behaviour: 'read',
  input: z.object({
    project: z.string().describe('A name, id prefix or liveplanner URL'),
    tab: tabFlag,
    view: z
      .enum(TAB_VIEW_NAMES)
      .default('outline')
      .describe(`One of ${TAB_VIEW_NAMES.join(', ')}`),
    ref: z.string().optional().describe('show: the element by ref, or selected'),
    text: z.string().optional().describe('find: the text to look for'),
    budget: z.coerce
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Fit the view to about this many tokens'),
    only: z.string().optional().describe('outline: one element and what nests under it'),
    style: z.boolean().optional().describe('outline: add style attributes'),
    all: z.boolean().optional().describe('comments: include resolved threads'),
    json: z.boolean().optional().describe('The view as JSON'),
    raw: z.boolean().optional().describe('The plain tab as stored, as JSON, instead of a view'),
  }),
  output: viewOutput,
  run: async (ctx, input) => {
    const { project, tab } = await tabOf(ctx, input.project, input.tab);
    const query = viewQuery({
      view: input.view,
      ref: input.ref,
      q: input.text,
      budget: input.budget,
      only: input.only,
      style: input.style,
      all: input.all,
      json: input.json,
    });
    if (input.raw) {
      const copy = await recordCopy(ctx, project.id, tab.id);
      const plain = copy ?? (await readPlainTab(ctx, project.id, tab.id));
      return { json: plain?.tab ?? null };
    }
    const path = `${tabPath(project.id, tab.id)}?${query}`;
    const [view, plain] = await Promise.all([
      ctx.api.text(path),
      ctx.copies ? readPlainTab(ctx, project.id, tab.id) : null,
    ]);
    await keepCopyOf(ctx, project.id, tab.id, revOfEtag(view.etag), plain);
    return input.json ? { json: JSON.parse(view.body) as unknown } : { text: view.body };
  },
  text: ({ text, json }) => [text ?? JSON.stringify(json)],
  json: (output) => output.json ?? { text: output.text },
  cli: {
    positionals: ['project'],
    examples: [
      'liveplanner tab view "Auth flow"',
      'liveplanner tab view 3f9c --view show --ref orders',
    ],
    prints: 'the view as the api serves it',
  },
});
