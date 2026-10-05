// The changeset verbs that read (docs/specs/015-api/cli.md "Commands"): the recent changesets of a document,
// and one with its result lines.

import { z } from 'zod';
import type { ChangesetDetail, ChangesetSummary } from '@livediagram/api-schema';
import { resolveTab } from '../addressing';
import { defineVerb } from '../define';
import { documentOf, LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT, minute } from './shared';

const summaryLine = (c: ChangesetSummary, tabName: string) => {
  const { added, changed, removed } = c.counts;
  const summary = c.summary ? `  ${JSON.stringify(c.summary)}` : '';
  return `${c.id}  rev ${c.rev}  ${JSON.stringify(tabName)}  ${c.author.name}${c.agent ? ' (agent)' : ''}${summary}  +${added} ~${changed} -${removed}  ${minute(c.createdAt)}`;
};

const listedChangeset = z.object({
  line: z.string(),
  id: z.string(),
  rev: z.number(),
  tabId: z.string(),
});

export const changesetLs = defineVerb({
  id: 'changeset.ls',
  summary: 'Recent changesets, newest first',
  description:
    'Lists the recent changesets of a document, or of one tab with --tab: who, what, when, and its counts.',
  behaviour: 'read',
  input: z.object({
    doc: z.string().describe('A name, id prefix or livediagram URL'),
    tab: z.string().optional().describe('Only this tab, by name or id prefix'),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_LIMIT)
      .default(LIST_DEFAULT_LIMIT)
      .describe('At most this many'),
  }),
  output: z.object({ changesets: z.array(listedChangeset) }),
  listKey: 'changesets',
  run: async (ctx, { doc, tab, limit }) => {
    const document = await documentOf(ctx, doc);
    const names = new Map(document.tabs.map((t) => [t.id, t.name]));
    const tabId = tab === undefined ? undefined : resolveTab(document.tabs, tab, doc).id;
    const query = new URLSearchParams({ limit: String(limit), ...(tabId ? { tab: tabId } : {}) });
    const { changesets } = await ctx.api.json<{ changesets: ChangesetSummary[] }>(
      `/documents/${encodeURIComponent(document.id)}/changesets?${query}`,
    );
    return {
      changesets: changesets.map((c) => ({
        line: summaryLine(c, names.get(c.tabId) ?? c.tabId),
        id: c.id,
        rev: c.rev,
        tabId: c.tabId,
      })),
    };
  },
  text: ({ changesets }) => (changesets.length ? changesets.map((c) => c.line) : ['no changesets']),
  quiet: ({ changesets }) => changesets.map((c) => c.id),
  cli: {
    positionals: ['doc'],
    examples: [
      'livediagram changeset ls "Auth flow"',
      'livediagram changeset ls 3f9c --tab Overview --limit 5',
    ],
    prints: 'one changeset a line: id, revision, tab, author, summary, counts, time',
  },
});

export const changesetShow = defineVerb({
  id: 'changeset.show',
  summary: 'One changeset and what it did',
  description: 'Prints one changeset: its summary line, then its result lines.',
  behaviour: 'read',
  input: z.object({
    doc: z.string().describe('A name, id prefix or livediagram URL'),
    changeset: z.string().describe('The changeset id, cs_…'),
  }),
  output: z.object({ line: z.string(), text: z.string() }),
  run: async (ctx, { doc, changeset }) => {
    const document = await documentOf(ctx, doc);
    const detail = await ctx.api.json<ChangesetDetail>(
      `/documents/${encodeURIComponent(document.id)}/changesets/${encodeURIComponent(changeset)}`,
    );
    const tabName =
      document.tabs.find((t) => t.id === detail.changeset.tabId)?.name ?? detail.changeset.tabId;
    return { line: summaryLine(detail.changeset, tabName), text: detail.text };
  },
  text: ({ line, text }) => [line, text],
  cli: {
    positionals: ['doc', 'changeset'],
    examples: [
      'livediagram changeset show "Auth flow" cs_8k2m4q7d1x',
      'livediagram changeset show 3f9c cs_8k2m4q7d1x --json',
    ],
    prints: 'the summary line, then the result lines',
  },
});
