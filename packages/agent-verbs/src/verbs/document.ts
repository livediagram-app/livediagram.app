// The document verbs that read (docs/specs/015-api/cli.md "Commands").

import { z } from 'zod';
import { defineVerb } from '../define';
import { listAllDocuments } from '../find-documents';
import { shortestUniquePrefixes } from '../refs';
import { columns, day, documentOf, LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT } from './shared';

const listed = z.object({
  ref: z.string(),
  id: z.string(),
  name: z.string(),
  library: z.string(),
  updated: z.string(),
});

export const documentLs = defineVerb({
  id: 'document.ls',
  summary: 'Documents in the personal library and joined teams, newest first',
  description:
    'Lists the documents the token can reach: the personal library and every joined team, newest saved first. A query keeps the documents whose name contains it.',
  behaviour: 'read',
  input: z.object({
    query: z.string().optional().describe('Keep documents whose name contains this'),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_LIMIT)
      .default(LIST_DEFAULT_LIMIT)
      .describe('At most this many'),
  }),
  output: z.object({ documents: z.array(listed), more: z.number(), query: z.string().optional() }),
  listKey: 'documents',
  run: async (ctx, { query, limit }) => {
    const all = await listAllDocuments(ctx.api);
    const refs = shortestUniquePrefixes(all.map((d) => d.id));
    const q = query?.toLowerCase();
    const kept = q ? all.filter((d) => d.name.toLowerCase().includes(q)) : all;
    return {
      documents: kept.slice(0, limit).map((d) => ({
        ref: refs.get(d.id)!,
        id: d.id,
        name: d.name,
        library: d.library,
        updated: day(d.updatedAt),
      })),
      more: Math.max(0, kept.length - limit),
      ...(query ? { query } : {}),
    };
  },
  text: ({ documents, more, query }) => [
    ...(documents.length === 0 ? [query ? `no documents match "${query}"` : 'no documents'] : []),
    ...columns(documents.map((d) => [d.ref, JSON.stringify(d.name), d.library, d.updated])),
    ...(more > 0
      ? [`… ${more} more; --limit ${documents.length + more}, or narrow with a query`]
      : []),
  ],
  quiet: ({ documents }) => documents.map((d) => d.ref),
  cli: {
    positionals: ['query'],
    examples: ['livediagram document ls', 'livediagram document ls auth --limit 5'],
    prints: 'one document a line: ref, name, library, last saved',
  },
});

export const documentView = defineVerb({
  id: 'document.view',
  summary: 'The overview: one line per tab',
  description:
    'Prints the overview view of a document: one line per tab with its counts and revision.',
  behaviour: 'read',
  input: z.object({ doc: z.string().describe('A name, id prefix or livediagram URL') }),
  output: z.object({ text: z.string() }),
  run: async (ctx, { doc }) => {
    const document = await documentOf(ctx, doc);
    const { body } = await ctx.api.text(
      `/documents/${encodeURIComponent(document.id)}?view=overview`,
    );
    return { text: body };
  },
  text: ({ text }) => [text],
  cli: {
    positionals: ['doc'],
    examples: ['livediagram document view "Auth flow"', 'livediagram document view 3f9c'],
    prints: 'the overview view',
  },
});
