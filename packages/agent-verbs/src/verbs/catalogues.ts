// The catalogue verbs (docs/specs/015-api/cli.md "Commands"): the template library, one template as an outline,
// icon search, and the element format, as the api serves them. The catalogue owns only their help; their content is
// the api's (blueprint "Catalogue routes").

import { z } from 'zod';
import type { IconSearchResponse, TemplateCatalogueResponse } from '@livediagram/api-schema';
import { ApiError } from '@livediagram/api-client';
import { defineVerb, VerbRefusal, type VerbContext } from '../define';
import { columns } from './shared';

export const ICON_SEARCH_DEFAULT_LIMIT = 20;
const NEAREST_MAX = 6;

// The names nearest one the api did not know: those sharing its start or holding it, else the first few.
function nearestNames(given: string, names: readonly string[]): string[] {
  const g = given.toLowerCase();
  const near = names.filter((n) => n.startsWith(g.slice(0, 3)) || n.includes(g) || g.includes(n));
  return (near.length ? near : names).slice(0, NEAREST_MAX);
}

// The names a 404 lists; none when its body says nothing readable.
function kindsOf(body: string): string[] {
  try {
    const kinds: unknown = Reflect.get(JSON.parse(body) as object, 'kinds');
    return Array.isArray(kinds) ? kinds.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

// A catalogue text by name; an unknown name is refused with the nearest names the api listed.
async function namedText(
  ctx: VerbContext,
  path: string,
  what: string,
  given: string,
  hint: string,
): Promise<string> {
  try {
    return (await ctx.api.text(path)).body;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
    const listed = kindsOf(err.body);
    throw new VerbRefusal({
      status: 404,
      code: err.code ?? 'not_found',
      message: `no ${what} ${JSON.stringify(given)}; the nearest:`,
      lines: nearestNames(given, listed),
      hint,
    });
  }
}
export const ICON_SEARCH_MAX_LIMIT = 50;

export const templateLs = defineVerb({
  id: 'template.ls',
  summary: 'The template library',
  description: 'Lists the templates a document or tab can start from: kind, title and category.',
  behaviour: 'read',
  input: z.object({}),
  output: z.object({
    templates: z.array(z.object({ kind: z.string(), title: z.string(), category: z.string() })),
  }),
  listKey: 'templates',
  run: async (ctx) => {
    const { templates } = await ctx.api.json<TemplateCatalogueResponse>('/templates');
    return { templates: templates.map(({ kind, title, category }) => ({ kind, title, category })) };
  },
  text: ({ templates }) =>
    columns(templates.map((t) => [t.kind, JSON.stringify(t.title), t.category])),
  quiet: ({ templates }) => templates.map((t) => t.kind),
  cli: {
    positionals: [],
    examples: ['livediagram template ls', 'livediagram template ls -q'],
    prints: 'one template a line: kind, title, category',
  },
});

export const templateView = defineVerb({
  id: 'template.view',
  summary: 'One template, as an outline',
  description:
    'Prints a template as the outline view of the tab it builds, before using it with --template.',
  behaviour: 'read',
  input: z.object({ kind: z.string().describe('A template kind, from template ls') }),
  output: z.object({ text: z.string() }),
  run: async (ctx, { kind }) => ({
    text: await namedText(
      ctx,
      `/templates/${encodeURIComponent(kind)}`,
      'template',
      kind,
      'livediagram template ls',
    ),
  }),
  text: ({ text }) => [text],
  cli: {
    positionals: ['kind'],
    examples: ['livediagram template view kanban', 'livediagram template view start-stop-continue'],
    prints: 'the outline of the tab the template builds',
  },
});

export const iconSearch = defineVerb({
  id: 'icon.search',
  summary: 'Find icons by name',
  description: `Finds icons in the line-art and Technology catalogues, best match first; an icon's id goes in iconId=.`,
  behaviour: 'read',
  input: z.object({
    text: z.string().min(1).max(60).describe('What the icon shows'),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(ICON_SEARCH_MAX_LIMIT)
      .default(ICON_SEARCH_DEFAULT_LIMIT)
      .describe('At most this many'),
  }),
  output: z.object({
    icons: z.array(z.object({ id: z.string(), label: z.string(), set: z.string() })),
    more: z.number(),
  }),
  listKey: 'icons',
  run: async (ctx, { text, limit }) =>
    ctx.api.json<IconSearchResponse>(
      `/icons?${new URLSearchParams({ query: text, limit: String(limit) })}`,
    ),
  text: ({ icons, more }) => [
    ...(icons.length
      ? columns(icons.map((i) => [i.id, JSON.stringify(i.label), i.set]))
      : ['no icons match']),
    ...(more > 0 ? [`… ${more} more; --limit ${icons.length + more}, or narrow the words`] : []),
  ],
  quiet: ({ icons }) => icons.map((i) => i.id),
  cli: {
    positionals: ['text'],
    examples: [
      'livediagram icon search database',
      'livediagram icon search "message queue" --limit 5',
    ],
    prints: 'one icon a line: id, label, catalogue',
  },
});

export const schemaView = defineVerb({
  id: 'schema.view',
  summary: 'The element format: the kinds, or one kind\u2019s fields',
  description:
    'Prints the element kinds edit operations make, or for one kind its first size, the aliases set takes with their values, and its stored fields.',
  behaviour: 'read',
  input: z.object({
    kind: z.string().optional().describe('An element kind, such as sticky or code-block'),
  }),
  output: z.object({ text: z.string() }),
  run: async (ctx, { kind }) => ({
    text:
      kind === undefined
        ? (await ctx.api.text('/schema')).body
        : await namedText(
            ctx,
            `/schema/${encodeURIComponent(kind)}`,
            'element kind',
            kind,
            'livediagram schema',
          ),
  }),
  text: ({ text }) => [text],
  cli: {
    positionals: ['kind'],
    examples: ['livediagram schema', 'livediagram schema sticky'],
    prints: 'the kinds, or one kind\u2019s format',
  },
});
