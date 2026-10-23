// The changeset verbs (docs/specs/015-api/cli.md "Commands"): the recent changesets of a project, one with
// its result lines, and the revert of one.

import { z } from 'zod';
import type { ChangesetDetail, ChangesetSummary, RevertResponse } from '@liveplanner/api-schema';
import { resolveTab } from '../addressing';
import { defineVerb } from '../define';
import { projectOf, LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT, minute } from './shared';

const summaryLine = (c: ChangesetSummary, tabName: string) => {
  const { added, changed, removed } = c.counts;
  const summary = c.summary ? `  ${JSON.stringify(c.summary)}` : '';
  const reverts = c.revertOf ? `  reverts ${c.revertOf}` : '';
  return `${c.id}  rev ${c.rev}  ${JSON.stringify(tabName)}  ${c.author.name}${c.agent ? ' (agent)' : ''}${summary}${reverts}  +${added} ~${changed} -${removed}  ${minute(c.createdAt)}`;
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
    'Lists the recent changesets of a plan, or of one tab with --tab: who, what, when, and its counts.',
  behaviour: 'read',
  input: z.object({
    project: z.string().describe('A name, id prefix or liveplanner URL'),
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
  run: async (ctx, { project: projectRef, tab, limit }) => {
    const project = await projectOf(ctx, projectRef);
    const names = new Map(project.tabs.map((t) => [t.id, t.name]));
    const tabId =
      tab === undefined ? undefined : resolveTab(project.tabs, tab, projectRef, ctx.log).id;
    const query = new URLSearchParams({ limit: String(limit), ...(tabId ? { tab: tabId } : {}) });
    const { changesets } = await ctx.api.json<{ changesets: ChangesetSummary[] }>(
      `/projects/${encodeURIComponent(project.id)}/changesets?${query}`,
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
    positionals: ['project'],
    examples: [
      'liveplanner changeset ls "Auth flow"',
      'liveplanner changeset ls 3f9c --tab Overview --limit 5',
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
    project: z.string().describe('A name, id prefix or liveplanner URL'),
    changeset: z.string().describe('The changeset id, cs_…'),
  }),
  output: z.object({ line: z.string(), text: z.string() }),
  run: async (ctx, { project: projectRef, changeset }) => {
    const project = await projectOf(ctx, projectRef);
    const detail = await ctx.api.json<ChangesetDetail>(
      `/projects/${encodeURIComponent(project.id)}/changesets/${encodeURIComponent(changeset)}`,
    );
    const tabName =
      project.tabs.find((t) => t.id === detail.changeset.tabId)?.name ?? detail.changeset.tabId;
    return { line: summaryLine(detail.changeset, tabName), text: detail.text };
  },
  text: ({ line, text }) => [line, text],
  cli: {
    positionals: ['project', 'changeset'],
    examples: [
      'liveplanner changeset show "Auth flow" cs_8k2m4q7d1x',
      'liveplanner changeset show 3f9c cs_8k2m4q7d1x --json',
    ],
    prints: 'the summary line, then the result lines',
  },
});

export const changesetRevert = defineVerb({
  id: 'changeset.revert',
  summary: 'Undo one changeset as a new changeset',
  description:
    'Reverts one changeset as a new changeset, leaving alone each element changed since (kept, with the reason).',
  behaviour: 'write',
  input: z.object({
    project: z.string().describe('A name, id prefix or liveplanner URL'),
    changeset: z.string().describe('The changeset id, cs_…'),
  }),
  output: z.object({
    changeset: z.object({ id: z.string(), rev: z.number(), previousRev: z.number() }).nullable(),
    reverted: z.number(),
    kept: z.array(z.object({ id: z.string(), reason: z.string() })),
  }),
  run: async (ctx, { project: projectRef, changeset }) => {
    const project = await projectOf(ctx, projectRef);
    const answer = await ctx.api.json<RevertResponse>(
      `/projects/${encodeURIComponent(project.id)}/changesets/${encodeURIComponent(changeset)}/revert`,
      { method: 'POST' },
    );
    return {
      changeset: answer.changeset && {
        id: answer.changeset.id,
        rev: answer.changeset.rev,
        previousRev: answer.changeset.previousRev,
      },
      reverted: answer.reverted,
      kept: answer.kept,
    };
  },
  text: ({ changeset, reverted, kept }) => [
    changeset
      ? `reverted ${reverted} · rev ${changeset.previousRev}→${changeset.rev} · ${changeset.id}`
      : 'nothing to revert',
    ...kept.map((k) => `kept ${k.id} (${k.reason})`),
  ],
  quiet: ({ changeset }) => (changeset ? [changeset.id] : []),
  cli: {
    positionals: ['project', 'changeset'],
    examples: [
      'liveplanner changeset revert "Auth flow" cs_8k2m4q7d1x',
      'liveplanner changeset revert 3f9c cs_8k2m4q7d1x -q',
    ],
    prints: 'what it reverted and the new revision, then each element kept and why',
  },
});
