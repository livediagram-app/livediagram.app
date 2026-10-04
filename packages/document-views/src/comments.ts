// The comments view (docs/specs/024-agents/blueprints/document-views.md "comments", VW33): open threads
// in the outline's order, every comment in full; resolved threads counted, or shown with `all`.
import type { CommentsView, ViewDoor } from '@livediagram/api-schema';
import type { Element } from '@livediagram/document';
import { fitLines, type ViewLine } from './budget';
import { LABEL_CUT_CHARS } from './constants';
import { numberField, stringField, textField, threadOf } from './fields';
import { headerLine, viewHeader } from './header';
import type { ViewModel } from './model';
import { attrValue, jsonString } from './text';
import { depthFirst } from './tree';

export type CommentsOptions = { budget?: number; door?: ViewDoor; all?: boolean };

const THREAD = { one: 'thread', many: 'threads' };
const COMMENT = { one: 'comment', many: 'comments' };

type Thread = CommentsView['threads'][number];

// `YYYY-MM-DD` in UTC; `?` for a time that is not one.
function utcDay(at: number): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? '?' : date.toISOString().slice(0, 10);
}

type ThreadComment = Thread['comments'][number];

export function readComment(c: object): ThreadComment {
  return {
    authorName: stringField(c, 'authorName') ?? '',
    createdAt: numberField(c, 'createdAt') ?? 0,
    text: stringField(c, 'text') ?? '',
  };
}

// `Sam 2026-09-27: "text"`: a comment as the comments and show views print it.
export function commentText(c: ThreadComment): string {
  return `${attrValue(c.authorName)} ${utcDay(c.createdAt)}: ${jsonString(c.text)}`;
}

function threadOfElement(model: ViewModel, el: Element): Thread | null {
  const thread = threadOf(el);
  if (thread === null) return null;
  return {
    ref: model.refs.refOf(el.id),
    kind: model.kindOf(el),
    label: textField(el, 'label'),
    resolved: thread.resolved,
    comments: thread.comments.map(readComment),
  };
}

function threadLines(thread: Thread): ViewLine[] {
  const label = thread.label === null ? '' : ` ${jsonString(thread.label, LABEL_CUT_CHARS)}`;
  const state = thread.resolved ? 'resolved' : 'open';
  return [
    {
      text: `${thread.kind} ${thread.ref}${label} · ${state} · ${thread.comments.length}`,
      noun: THREAD,
    },
    ...thread.comments.map((c) => ({
      text: `  ${commentText(c)}`,
      noun: COMMENT,
    })),
  ];
}

export function commentsView(
  model: ViewModel,
  options: CommentsOptions = {},
): { text: string; json: CommentsView } {
  const elements = depthFirst(model.tree.roots).map((n) => n.el);
  const threads = elements.flatMap((el) => {
    const thread = threadOfElement(model, el);
    return thread === null ? [] : [thread];
  });
  const shown = threads.filter((t) => options.all || !t.resolved);
  const resolved = threads.length - shown.length;
  const owned = shown.flatMap((thread) => threadLines(thread).map((line) => ({ line, thread })));
  const fitted = fitLines({
    header: headerLine(model.facts),
    lines: owned.map((o) => o.line),
    budget: options.budget,
    door: options.door ?? 'cli',
    fixed:
      resolved > 0
        ? {
            omitted: [
              { noun: resolved === 1 ? 'resolved thread' : 'resolved threads', count: resolved },
            ],
            args: { all: true },
          }
        : null,
  });
  const keptLines = new Map<Thread, number>();
  for (const { thread } of owned.slice(0, fitted.kept))
    keptLines.set(thread, (keptLines.get(thread) ?? 0) + 1);
  const json = shown.flatMap((thread): Thread[] => {
    const lines = keptLines.get(thread) ?? 0;
    return lines === 0 ? [] : [{ ...thread, comments: thread.comments.slice(0, lines - 1) }];
  });
  return {
    text: fitted.text,
    json: { header: viewHeader('comments', model.facts), threads: json, elision: fitted.elision },
  };
}
