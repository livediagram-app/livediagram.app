// The design verbs that read (docs/specs/015-api/cli.md "Commands").

import { z } from 'zod';
import { defineVerb } from '../define';
import { listAllDesigns, type FoundDesign } from '../find-designs';
import { shortestUniquePrefixes } from '@liveworkspace/agent-verbs/refs';
import { columns, day, designOf, LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT } from './shared';

export const listedDesign = z.object({
  ref: z.string(),
  id: z.string(),
  name: z.string(),
  library: z.string(),
  updated: z.string(),
});
export type ListedDesign = z.infer<typeof listedDesign>;

// The rows `design ls` prints: each design's ref, name, library and last saved day.
export function designRows(
  found: readonly FoundDesign[],
  refs: ReadonlyMap<string, string>,
): ListedDesign[] {
  return found.map((d) => ({
    ref: refs.get(d.id)!,
    id: d.id,
    name: d.name,
    library: d.library,
    updated: day(d.updatedAt),
  }));
}

// A design list as compact lines: an empty list says so, a cut one says how many more.
export function designListText({
  designs,
  more,
  query,
}: {
  designs: readonly ListedDesign[];
  more: number;
  query?: string;
}): string[] {
  return [
    ...(designs.length === 0 ? [query ? `no designs match "${query}"` : 'no designs'] : []),
    ...columns(designs.map((d) => [d.ref, JSON.stringify(d.name), d.library, d.updated])),
    ...(more > 0
      ? [`… ${more} more; --limit ${designs.length + more}, or narrow with a query`]
      : []),
  ];
}

export const designLs = defineVerb({
  id: 'design.ls',
  summary: 'Designs in the personal library and joined teams, newest first',
  description:
    'Lists the designs the token can reach: the personal library and every joined team, newest saved first. A query keeps the designs whose name contains it.',
  behaviour: 'read',
  input: z.object({
    query: z.string().optional().describe('Keep designs whose name contains this'),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_LIMIT)
      .default(LIST_DEFAULT_LIMIT)
      .describe('At most this many'),
  }),
  output: z.object({
    designs: z.array(listedDesign),
    more: z.number(),
    query: z.string().optional(),
  }),
  listKey: 'designs',
  run: async (ctx, { query, limit }) => {
    const all = await listAllDesigns(ctx.api);
    const refs = shortestUniquePrefixes(all.map((d) => d.id));
    const q = query?.toLowerCase();
    const kept = q ? all.filter((d) => d.name.toLowerCase().includes(q)) : all;
    return {
      designs: designRows(kept.slice(0, limit), refs),
      more: Math.max(0, kept.length - limit),
      ...(query ? { query } : {}),
    };
  },
  text: designListText,
  quiet: ({ designs }) => designs.map((d) => d.ref),
  cli: {
    positionals: ['query'],
    examples: ['livedesign design ls', 'livedesign design ls auth --limit 5'],
    prints: 'one design a line: ref, name, library, last saved',
  },
});

export const designView = defineVerb({
  id: 'design.view',
  summary: 'The overview: one line per tab',
  description:
    'Prints the overview view of a design: one line per tab with its counts and revision.',
  behaviour: 'read',
  input: z.object({ doc: z.string().describe('A name, id prefix or livedesign URL') }),
  output: z.object({ text: z.string() }),
  run: async (ctx, { doc }) => {
    const design = await designOf(ctx, doc);
    const { body } = await ctx.api.text(`/designs/${encodeURIComponent(design.id)}?view=overview`);
    return { text: body };
  },
  text: ({ text }) => [text],
  cli: {
    positionals: ['doc'],
    examples: ['livedesign design view "Auth flow"', 'livedesign design view 3f9c'],
    prints: 'the overview view',
  },
});
