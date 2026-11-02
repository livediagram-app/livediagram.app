// The comment verbs (docs/specs/015-api/cli.md "Commands"; agent-presence "Comments"): the threads of a design, and
// adding, replying to, resolving and reopening one, through the same endpoints the editor uses. A thread is named by
// its element's ref, resolved over the plain tab (CLI78).

import { z } from 'zod';
import { ApiError } from '@liveworkspace/api-client';
import {
  COMMENT_LIST_STATUSES,
  type CommentListStatus,
  type DesignCommentsResponse,
} from '@livedesign/api-schema';
import { computeRefs, resolveRef, type CommentThread, type Tab } from '@livedesign/design';
import { threadListingLines } from '@livedesign/design-views';
import { resolveTab } from '../addressing';
import { defineVerb, VerbRefusal, type VerbContext } from '../define';
import { designOf, tabOf, tabPath } from './shared';

const docArg = z.string().describe('A name, id prefix or livedesign URL');
const tabFlag = z
  .string()
  .optional()
  .describe('A tab name or id prefix; the first tab when omitted');
const refArg = z.string().describe('The element\u2019s ref, from a view');
const textArg = z.string().min(1).describe('The comment');

const threadOutput = z.object({
  tabId: z.string(),
  tabName: z.string(),
  elementId: z.string(),
  ref: z.string(),
  label: z.string().nullable(),
  resolved: z.boolean(),
  comments: z.array(
    z.object({
      id: z.string(),
      authorName: z.string(),
      createdAt: z.number(),
      text: z.string(),
      // Who reacted, per emoji (docs/specs/012-collaboration/comment-reactions.md); absent when nobody did.
      reactions: z
        .array(
          z.object({
            emoji: z.string(),
            name: z.string(),
            count: z.number(),
            by: z.array(z.string()),
          }),
        )
        .optional(),
    }),
  ),
});

const EMPTY: Record<CommentListStatus, string> = {
  open: 'no open threads',
  resolved: 'no resolved threads',
  all: 'no threads',
};

export const commentLs = defineVerb({
  id: 'comment.ls',
  summary: 'The comment threads of a design, open by default',
  description:
    'Lists the comment threads of a design, or of one tab, in the outline\u2019s order: each element\u2019s ref, label, state and comments in full.',
  behaviour: 'read',
  input: z.object({
    doc: docArg,
    tab: z.string().optional().describe('A tab name or id prefix; every tab when omitted'),
    status: z
      .enum(COMMENT_LIST_STATUSES)
      .default('open')
      .describe('Which threads: open, resolved or all'),
  }),
  output: z.object({ status: z.enum(COMMENT_LIST_STATUSES), threads: z.array(threadOutput) }),
  listKey: 'threads',
  run: async (ctx, { doc, tab, status }) => {
    const design = await designOf(ctx, doc);
    const tabId = tab === undefined ? null : resolveTab(design.tabs, tab, doc, ctx.log).id;
    const { threads } = await ctx.api.json<DesignCommentsResponse>(
      `/designs/${encodeURIComponent(design.id)}/comments?status=${status}`,
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
        resolved: t.resolved,
        comments: t.comments.map((c) => ({
          id: c.id,
          authorName: c.authorName,
          createdAt: c.createdAt,
          text: c.text,
          ...(c.reactions?.length ? { reactions: c.reactions } : {}),
        })),
      })),
    };
  },
  text: ({ status, threads }) =>
    threads.length ? threads.flatMap((t) => threadListingLines(t)) : [EMPTY[status]],
  quiet: ({ threads }) => threads.map((t) => t.ref),
  cli: {
    positionals: ['doc'],
    examples: ['livedesign comment ls "Shop"', 'livedesign comment ls "Shop" --status all'],
    prints: 'each thread: its ref, label, state and tab, then its comments',
  },
});

type Target = {
  designId: string;
  tabId: string;
  tabName: string;
  elementId: string;
  tab: Tab;
};

// The element a ref names on the tab, over every element of the plain tab (VW2), refused as the views refuse it.
async function targetOf(ctx: VerbContext, doc: string, tab: string | undefined, ref: string) {
  const { design, tab: summary } = await tabOf(ctx, doc, tab);
  const { tab: plain } = await ctx.api.json<{ tab: Tab }>(tabPath(design.id, summary.id));
  const table = computeRefs(plain.elements.map((el) => el.id));
  const found = resolveRef(ref, table);
  const where = `on tab ${JSON.stringify(summary.name)}`;
  if (found.kind === 'not-found')
    throw new VerbRefusal({
      status: 404,
      code: 'ref_not_found',
      message: `no element ${ref} ${where}`,
      lines: found.nearest.map((near) => `  ${near}`),
      hint: `the refs are in: livedesign tab view ${JSON.stringify(doc)}`,
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
    designId: design.id,
    tabId: summary.id,
    tabName: summary.name,
    elementId: found.id,
    tab: plain,
  } satisfies Target;
}

// The thread verbs name a thread by its last comment (CLI78); an element without one has nothing to act on.
function lastCommentOf(target: Target, ref: string): string {
  // The target was found on its tab, so its element is there.
  const el = target.tab.elements.find((e) => e.id === target.elementId)!;
  const last = (el as { commentThread?: CommentThread }).commentThread?.comments.at(-1);
  if (!last)
    throw new VerbRefusal({
      status: 404,
      code: 'no_thread',
      message: `no thread on ${ref}`,
      hint: `start one: livedesign comment add <doc> ${ref} "<text>"`,
    });
  return last.id;
}

const commentsPath = (t: Target) => `${tabPath(t.designId, t.tabId)}/comments`;

const lineOutput = z.object({ text: z.string(), id: z.string() });
const lineText = ({ text }: { text: string }) => [text];
const quietId = ({ id }: { id: string }) => [id];

export const commentAdd = defineVerb({
  id: 'comment.add',
  summary: 'Comment on an element',
  description:
    'Adds a comment to an element\u2019s thread, starting one if it has none (a resolved thread reopens). The comment is the token owner\u2019s.',
  behaviour: 'write',
  input: z.object({ doc: docArg, tab: tabFlag, ref: refArg, text: textArg }),
  output: lineOutput,
  run: async (ctx, { doc, tab, ref, text }) => {
    const target = await targetOf(ctx, doc, tab, ref);
    const { comment } = await ctx.api.json<{ comment: { id: string } }>(commentsPath(target), {
      method: 'POST',
      body: JSON.stringify({ elementId: target.elementId, text }),
    });
    return { id: comment.id, text: `+ comment ${comment.id} on ${ref}` };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['doc', 'ref', 'text'],
    examples: [
      'livedesign comment add "Shop" api "Should this be idempotent?"',
      'livedesign comment add "Shop" --tab Flow 146b "Missing a retry"',
    ],
    prints: 'the new comment\u2019s id',
  },
});

export const commentReply = defineVerb({
  id: 'comment.reply',
  summary: 'Reply to the thread on an element',
  description: 'Adds a reply to the thread on an element; an element with no thread is refused.',
  behaviour: 'write',
  input: z.object({ doc: docArg, tab: tabFlag, ref: refArg, text: textArg }),
  output: lineOutput,
  run: async (ctx, { doc, tab, ref, text }) => {
    const target = await targetOf(ctx, doc, tab, ref);
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
    positionals: ['doc', 'ref', 'text'],
    examples: [
      'livedesign comment reply "Shop" api "Yes, keyed by order id"',
      'livedesign comment reply 3f9c --tab Flow 146b "Done"',
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
    input: z.object({ doc: docArg, tab: tabFlag, ref: refArg }),
    output: lineOutput,
    run: async (ctx, { doc, tab, ref }) => {
      const target = await targetOf(ctx, doc, tab, ref);
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
      positionals: ['doc', 'ref'],
      examples: [
        `livedesign comment ${verb} "Shop" api`,
        `livedesign comment ${verb} 3f9c --tab Flow 146b`,
      ],
      prints: `the thread\u2019s new state`,
    },
  });
}

export const commentResolve = threadStateVerb('resolve');
export const commentReopen = threadStateVerb('reopen');
