// The tab verbs that read (docs/specs/015-api/cli.md "Commands"): the tabs of a document, a view of one, and
// its lint, as the api serves them.

import { z } from 'zod';
import { TAB_VIEW_NAMES, type LintReport } from '@livediagram/api-schema';
import { formatLintReport } from '@livediagram/diagram-lint';
import { defineVerb } from '../define';
import { shortestUniquePrefixes } from '../refs';
import { columns, documentOf, tabOf, tabPath } from './shared';

const tabFlag = z
  .string()
  .optional()
  .describe('A tab name or id prefix; the first tab when omitted');

export const tabLs = defineVerb({
  id: 'tab.ls',
  summary: "The document's tabs",
  description: 'Lists the tabs of a document in order: position, ref and name.',
  behaviour: 'read',
  input: z.object({ doc: z.string().describe('A name, id prefix or livediagram URL') }),
  output: z.object({
    tabs: z.array(
      z.object({ index: z.number(), ref: z.string(), id: z.string(), name: z.string() }),
    ),
  }),
  listKey: 'tabs',
  run: async (ctx, { doc }) => {
    const document = await documentOf(ctx, doc);
    const ordered = [...document.tabs].sort((a, b) => a.orderIndex - b.orderIndex);
    const refs = shortestUniquePrefixes(ordered.map((t) => t.id));
    return {
      tabs: ordered.map((t, i) => ({ index: i + 1, ref: refs.get(t.id)!, id: t.id, name: t.name })),
    };
  },
  text: ({ tabs }) =>
    tabs.length
      ? columns(tabs.map((t) => [String(t.index), t.ref, JSON.stringify(t.name)]))
      : ['no tabs'],
  quiet: ({ tabs }) => tabs.map((t) => t.ref),
  cli: {
    positionals: ['doc'],
    examples: ['livediagram tab ls "Auth flow"', 'livediagram tab ls 3f9c -q'],
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

export const tabView = defineVerb({
  id: 'tab.view',
  summary: 'A view of a tab; the outline by default',
  description:
    'Prints a view of a tab as the api renders it: outline (default), graph, layout, comments, show (needs --ref) or find (needs --text). --budget fits it to that many tokens.',
  behaviour: 'read',
  input: z.object({
    doc: z.string().describe('A name, id prefix or livediagram URL'),
    tab: tabFlag,
    view: z
      .enum(TAB_VIEW_NAMES)
      .default('outline')
      .describe(`One of ${TAB_VIEW_NAMES.join(', ')}`),
    ref: z.string().optional().describe('show: the element, by ref'),
    text: z.string().optional().describe('find: the text to look for'),
    budget: z.coerce
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Fit the view to about this many tokens'),
    only: z.string().optional().describe('outline, layout: one element and what nests under it'),
    coarse: z.boolean().optional().describe('layout: rows instead of geometry'),
    style: z.boolean().optional().describe('outline: add style attributes'),
    all: z.boolean().optional().describe('comments: include resolved threads'),
    json: z.boolean().optional().describe('The view as JSON'),
  }),
  output: viewOutput,
  run: async (ctx, input) => {
    const { document, tab } = await tabOf(ctx, input.doc, input.tab);
    const query = viewQuery({
      view: input.view,
      ref: input.ref,
      q: input.text,
      budget: input.budget,
      only: input.only,
      coarse: input.coarse,
      style: input.style,
      all: input.all,
      json: input.json,
    });
    const path = `${tabPath(document.id, tab.id)}?${query}`;
    return input.json
      ? { json: await ctx.api.json<unknown>(path) }
      : { text: (await ctx.api.text(path)).body };
  },
  text: ({ text }) => [text ?? ''],
  json: (output) => output.json ?? { text: output.text },
  cli: {
    positionals: ['doc'],
    examples: [
      'livediagram tab view "Auth flow"',
      'livediagram tab view 3f9c --view show --ref orders',
    ],
    prints: 'the view as the api serves it',
  },
});

export const tabLint = defineVerb({
  id: 'tab.lint',
  summary: 'The diagram lint: what is wrong with how the tab is drawn',
  description:
    'Prints the diagram lint of a tab: a summary line, then one finding a line, each ending with a fix as edit operations. Exits 1 when a finding is an error.',
  behaviour: 'read',
  input: z.object({
    doc: z.string().describe('A name, id prefix or livediagram URL'),
    tab: tabFlag,
  }),
  output: z.object({ findings: z.array(z.unknown()), errors: z.number(), text: z.string() }),
  listKey: 'findings',
  run: async (ctx, input) => {
    const { document, tab } = await tabOf(ctx, input.doc, input.tab);
    const report = await ctx.api.json<LintReport>(
      `${tabPath(document.id, tab.id)}?view=lint&json=1`,
    );
    return {
      findings: report.findings,
      errors: report.counts.error,
      text: formatLintReport(report),
    };
  },
  text: ({ text }) => [text],
  exitCode: ({ errors }) => (errors > 0 ? 1 : 0),
  cli: {
    positionals: ['doc'],
    examples: ['livediagram tab lint "Auth flow"', 'livediagram tab lint 3f9c --tab Overview'],
    prints: 'the lint summary line, then one finding a line',
  },
});
