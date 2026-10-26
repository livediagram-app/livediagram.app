// The project verbs that read (docs/specs/015-api/cli.md "Commands").

import { z } from 'zod';
import { defineVerb } from '../define';
import { listAllProjects, type FoundProject } from '../find-projects';
import { shortestUniquePrefixes } from '@liveworkspace/agent-verbs/refs';
import { columns, day, projectOf, LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT, moreLine } from './shared';

export const listedProject = z.object({
  ref: z.string(),
  id: z.string(),
  name: z.string(),
  library: z.string(),
  updated: z.string(),
});
export type ListedProject = z.infer<typeof listedProject>;

// The rows `project ls` prints: each project's ref, name, library and last saved day.
export function projectRows(
  found: readonly FoundProject[],
  refs: ReadonlyMap<string, string>,
): ListedProject[] {
  return found.map((d) => ({
    ref: refs.get(d.id)!,
    id: d.id,
    name: d.name,
    library: d.library,
    updated: day(d.updatedAt),
  }));
}

// A project list as compact lines: an empty list says so, a cut one says how many more.
export function projectListText({
  projects,
  more,
  query,
}: {
  projects: readonly ListedProject[];
  more: number;
  query?: string;
}): string[] {
  return [
    ...(projects.length === 0 ? [query ? `no plans match "${query}"` : 'no plans'] : []),
    ...columns(projects.map((d) => [d.ref, JSON.stringify(d.name), d.library, d.updated])),
    ...(more > 0 ? [moreLine(projects.length, more, LIST_MAX_LIMIT, 'narrow with a query')] : []),
  ];
}

export const projectLs = defineVerb({
  id: 'project.ls',
  summary: 'Plans in the personal library and joined teams, newest first',
  description:
    'Lists the plans the token can reach: the personal library and every joined team, newest saved first. A query keeps the plans whose name contains it.',
  behaviour: 'read',
  input: z.object({
    query: z.string().optional().describe('Keep plans whose name contains this'),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_LIMIT)
      .default(LIST_DEFAULT_LIMIT)
      .describe('At most this many'),
  }),
  output: z.object({
    projects: z.array(listedProject),
    more: z.number(),
    query: z.string().optional(),
  }),
  listKey: 'projects',
  run: async (ctx, { query, limit }) => {
    const all = await listAllProjects(ctx.api);
    const refs = shortestUniquePrefixes(all.map((d) => d.id));
    const q = query?.toLowerCase();
    const kept = q ? all.filter((d) => d.name.toLowerCase().includes(q)) : all;
    return {
      projects: projectRows(kept.slice(0, limit), refs),
      more: Math.max(0, kept.length - limit),
      ...(query ? { query } : {}),
    };
  },
  text: projectListText,
  quiet: ({ projects }) => projects.map((d) => d.ref),
  cli: {
    positionals: ['query'],
    examples: ['liveplanner project ls', 'liveplanner project ls auth --limit 5'],
    prints: 'one plan a line: ref, name, library, last saved',
  },
});

export const projectView = defineVerb({
  id: 'project.view',
  summary: 'The overview: one line per tab',
  description: 'Prints the overview view of a plan: one line per tab with its counts and revision.',
  behaviour: 'read',
  input: z.object({ project: z.string().describe('A name, id prefix or liveplanner URL') }),
  output: z.object({ text: z.string() }),
  run: async (ctx, { project: projectRef }) => {
    const project = await projectOf(ctx, projectRef);
    const { body } = await ctx.api.text(
      `/projects/${encodeURIComponent(project.id)}?view=overview`,
    );
    return { text: body };
  },
  text: ({ text }) => [text],
  cli: {
    positionals: ['project'],
    examples: ['liveplanner project view "Auth flow"', 'liveplanner project view 3f9c'],
    prints: 'the overview view',
  },
});
