// The comment verbs (docs/specs/015-api/cli.md "Commands"; agent-presence "Comments"): the threads of a project, and
// adding, replying to, resolving and reopening one, through the same endpoints the editor uses. A thread is named by
// its element's ref, resolved over the plain tab (CLI78).

import { z } from 'zod';
import { ApiError } from '@liveplanner/api-client';
import {
  COMMENT_LIST_STATUSES,
  type CommentListStatus,
  type ProjectCommentsResponse,
} from '@liveplanner/api-schema';
import {
  computeRefs,
  resolveRef,
  takesCellThreads,
  threadAt,
  type Tab,
} from '@liveplanner/project';
import { parseA1 } from '@liveplanner/sheets';
import { threadListingLines } from '@liveplanner/project-views';
import { resolveTab } from '../addressing';
import { defineVerb, VerbRefusal, type VerbContext } from '../define';
import { readSheets } from '../sheets/sheet-state';
import { projectOf, tabOf, tabPath } from './shared';

const projectArg = z.string().describe('A name, id prefix or liveplanner URL');
const tabFlag = z
  .string()
  .optional()
  .describe('A tab name or id prefix; the first tab when omitted');
const refArg = z.string().describe('The element\u2019s ref, from a view');
const textArg = z.string().min(1).describe('The comment');
// A Sheet cell's thread (docs/specs/029-sheets/sheet.md "Cell comments"): the ref names the Sheet, this its cell.
const cellArg = z
  .string()
  .optional()
  .describe(
    'On a Sheet, the cell whose thread this is, by A1 (B4); the Sheet\u2019s own thread when omitted',
  );

const threadOutput = z.object({
  tabId: z.string(),
  tabName: z.string(),
  elementId: z.string(),
  ref: z.string(),
  label: z.string().nullable(),
  cell: z.string().optional(),
  cellRef: z.string().optional(),
  resolved: z.boolean(),
  comments: z.array(
    z.object({ id: z.string(), authorName: z.string(), createdAt: z.number(), text: z.string() }),
  ),
});

const EMPTY: Record<CommentListStatus, string> = {
  open: 'no open threads',
  resolved: 'no resolved threads',
  all: 'no threads',
};

export const commentLs = defineVerb({
  id: 'comment.ls',
  summary: 'The comment threads of a project, open by default',
  description:
    'Lists the comment threads of a project, or of one tab, in the outline\u2019s order: each element\u2019s ref, label, state and comments in full.',
  behaviour: 'read',
  input: z.object({
    project: projectArg,
    tab: z.string().optional().describe('A tab name or id prefix; every tab when omitted'),
    status: z
      .enum(COMMENT_LIST_STATUSES)
      .default('open')
      .describe('Which threads: open, resolved or all'),
  }),
  output: z.object({ status: z.enum(COMMENT_LIST_STATUSES), threads: z.array(threadOutput) }),
  listKey: 'threads',
  run: async (ctx, { project: projectRef, tab, status }) => {
    const project = await projectOf(ctx, projectRef);
    const tabId = tab === undefined ? null : resolveTab(project.tabs, tab, projectRef, ctx.log).id;
    const { threads } = await ctx.api.json<ProjectCommentsResponse>(
      `/projects/${encodeURIComponent(project.id)}/comments?status=${status}`,
    );
    const shown = tabId === null ? threads : threads.filter((t) => t.tabId === tabId);
    ctx.log(`comments ${shown.length} of ${threads.length} threads`);
    return {
      status,
      threads: shown.map((t) => ({
        tabId: t.tabId,
        tabName: t.tabName,
        elementId: t.elementId,
        ref: t.ref,
        label: t.label,
        ...(t.cell !== undefined ? { cell: t.cell } : {}),
        ...(t.cellRef !== undefined ? { cellRef: t.cellRef } : {}),
        resolved: t.resolved,
        comments: t.comments.map((c) => ({
          id: c.id,
          authorName: c.authorName,
          createdAt: c.createdAt,
          text: c.text,
        })),
      })),
    };
  },
  text: ({ status, threads }) =>
    threads.length ? threads.flatMap((t) => threadListingLines(t)) : [EMPTY[status]],
  quiet: ({ threads }) => threads.map((t) => t.ref),
  cli: {
    positionals: ['project'],
    examples: ['liveplanner comment ls "Shop"', 'liveplanner comment ls "Shop" --status all'],
    prints: 'each thread: its ref, label, state and tab, then its comments',
  },
});

type Target = {
  projectId: string;
  tabId: string;
  tabName: string;
  elementId: string;
  tab: Tab;
  // A Sheet cell's key (`rowId:colId`), when the call named a cell.
  cell?: string;
};

// The element a ref names on the tab, over every element of the plain tab (VW2), refused as the views refuse it.
async function targetOf(
  ctx: VerbContext,
  projectRef: string,
  tab: string | undefined,
  ref: string,
) {
  const { project, tab: summary } = await tabOf(ctx, projectRef, tab);
  const { tab: plain } = await ctx.api.json<{ tab: Tab }>(tabPath(project.id, summary.id));
  const table = computeRefs(plain.elements.map((el) => el.id));
  const found = resolveRef(ref, table);
  const where = `on tab ${JSON.stringify(summary.name)}`;
  if (found.kind === 'not-found')
    throw new VerbRefusal({
      status: 404,
      code: 'ref_not_found',
      message: `no element ${ref} ${where}`,
      lines: found.nearest.map((near) => `  ${near}`),
      hint: `the refs are in: liveplanner tab view ${JSON.stringify(projectRef)}`,
    });
  if (found.kind === 'ambiguous')
    throw new VerbRefusal({
      status: 404,
      code: 'ref_ambiguous',
      message: `${ref} names ${found.candidates.length} elements ${where}`,
      lines: found.candidates.map((id) => `  ${table.refOf(id)}`),
      hint: 'give more of the ref',
    });
  return {
    projectId: project.id,
    tabId: summary.id,
    tabName: summary.name,
    elementId: found.id,
    tab: plain,
  } satisfies Target;
}

// The thread verbs name a thread by its last comment (CLI78); an element (or cell) without one has nothing to act on.
function lastCommentOf(target: Target, ref: string): string {
  // The target was found on its tab, so its element is there.
  const el = target.tab.elements.find((e) => e.id === target.elementId)!;
  const last = threadAt(el, target.cell)?.comments.at(-1);
  const where = target.cell === undefined ? ref : `${ref} cell`;
  if (!last)
    throw new VerbRefusal({
      status: 404,
      code: 'no_thread',
      message: `no thread on ${where}`,
      hint: `start one: liveplanner comment add <project> ${ref} "<text>"`,
    });
  return last.id;
}

// The target with its cell: the A1 read against the Sheet's stored layout, refused when the element is not a Sheet
// or the cell is not on it.
async function withCell(ctx: VerbContext, target: Target, ref: string, a1: string | undefined) {
  if (a1 === undefined) return target;
  const el = target.tab.elements.find((e) => e.id === target.elementId)!;
  const sheetId = el.type === 'shape' ? el.planSheet?.sheetId : undefined;
  if (!takesCellThreads(el) || !sheetId)
    throw new VerbRefusal({
      status: 400,
      code: 'not_a_sheet',
      message: `${ref} is not a Sheet, so it has no cells`,
      hint: 'name a Sheet element, or leave out --cell',
    });
  const pos = parseA1(a1);
  const sheet = (await readSheets(ctx.api, target.projectId, target.tabId)).find(
    (s) => s.id === sheetId,
  );
  const row = pos && sheet ? sheet.layout.rows[pos.r] : undefined;
  const col = pos && sheet ? sheet.layout.cols[pos.c] : undefined;
  if (!row || !col)
    throw new VerbRefusal({
      status: 400,
      code: 'cell_not_found',
      message: `no cell ${a1} on ${ref}`,
      hint: 'name a cell by A1 inside the sheet, such as B4',
    });
  return { ...target, cell: `${row}:${col}` } satisfies Target;
}

const commentsPath = (t: Target) => `${tabPath(t.projectId, t.tabId)}/comments`;

const lineOutput = z.object({ text: z.string(), id: z.string() });
const lineText = ({ text }: { text: string }) => [text];
const quietId = ({ id }: { id: string }) => [id];

export const commentAdd = defineVerb({
  id: 'comment.add',
  summary: 'Comment on an element',
  description:
    'Adds a comment to an element\u2019s thread, starting one if it has none (a resolved thread reopens). The comment is the token owner\u2019s.',
  behaviour: 'write',
  input: z.object({ project: projectArg, tab: tabFlag, ref: refArg, text: textArg, cell: cellArg }),
  output: lineOutput,
  run: async (ctx, { project: projectRef, tab, ref, text, cell }) => {
    const target = await withCell(ctx, await targetOf(ctx, projectRef, tab, ref), ref, cell);
    const { comment } = await ctx.api.json<{ comment: { id: string } }>(commentsPath(target), {
      method: 'POST',
      body: JSON.stringify({
        elementId: target.elementId,
        text,
        ...(target.cell ? { cell: target.cell } : {}),
      }),
    });
    return { id: comment.id, text: `+ comment ${comment.id} on ${ref}${cell ? ` ${cell}` : ''}` };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['project', 'ref', 'text'],
    examples: [
      'liveplanner comment add "Shop" api "Should this be idempotent?"',
      'liveplanner comment add "Shop" --tab Flow 146b "Missing a retry"',
    ],
    prints: 'the new comment\u2019s id',
  },
});

export const commentReply = defineVerb({
  id: 'comment.reply',
  summary: 'Reply to the thread on an element',
  description: 'Adds a reply to the thread on an element; an element with no thread is refused.',
  behaviour: 'write',
  input: z.object({ project: projectArg, tab: tabFlag, ref: refArg, text: textArg, cell: cellArg }),
  output: lineOutput,
  run: async (ctx, { project: projectRef, tab, ref, text, cell }) => {
    const target = await withCell(ctx, await targetOf(ctx, projectRef, tab, ref), ref, cell);
    const last = lastCommentOf(target, ref);
    const { comment } = await ctx.api.json<{ comment: { id: string } }>(
      `${commentsPath(target)}/${encodeURIComponent(last)}/reply`,
      { method: 'POST', body: JSON.stringify({ text }) },
    );
    return { id: comment.id, text: `+ comment ${comment.id} on ${ref}` };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['project', 'ref', 'text'],
    examples: [
      'liveplanner comment reply "Shop" api "Yes, keyed by order id"',
      'liveplanner comment reply 3f9c --tab Flow 146b "Done"',
    ],
    prints: 'the reply\u2019s id',
  },
});

function threadStateVerb(verb: 'resolve' | 'reopen') {
  const state = verb === 'resolve' ? 'resolved' : 'open';
  return defineVerb({
    id: `comment.${verb}`,
    summary:
      verb === 'resolve' ? 'Resolve the thread on an element' : 'Reopen the thread on an element',
    description: `Marks the thread on an element ${state}; it already being so changes nothing.`,
    behaviour: 'write',
    input: z.object({ project: projectArg, tab: tabFlag, ref: refArg, cell: cellArg }),
    output: lineOutput,
    run: async (ctx, { project: projectRef, tab, ref, cell }) => {
      const target = await withCell(ctx, await targetOf(ctx, projectRef, tab, ref), ref, cell);
      const last = lastCommentOf(target, ref);
      const res = await ctx.api.fetch(
        `${commentsPath(target)}/${encodeURIComponent(last)}/${verb}`,
        {
          method: 'POST',
        },
      );
      if (!res.ok) throw new ApiError(res.status, await res.text());
      return { id: target.elementId, text: `~ thread ${ref} ${state}` };
    },
    text: lineText,
    quiet: quietId,
    cli: {
      positionals: ['project', 'ref'],
      examples: [
        `liveplanner comment ${verb} "Shop" api`,
        `liveplanner comment ${verb} 3f9c --tab Flow 146b`,
      ],
      prints: `the thread\u2019s new state`,
    },
  });
}

export const commentResolve = threadStateVerb('resolve');
export const commentReopen = threadStateVerb('reopen');
