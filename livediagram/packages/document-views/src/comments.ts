// The comments view (docs/specs/024-agents/blueprints/document-views.md "comments", VW33): open threads
// in the outline's order, every comment in full; resolved threads counted, or shown with `all`.
import type { CommentsView, ViewDoor } from '@livediagram/api-schema';
import type { Element } from '@livediagram/document';
import { fitLines, fitOf, type ViewLine, type ViewResult } from './budget';
import { LABEL_CUT_CHARS } from './constants';
import { cellThreadsOf, numberField, stringField, textField, threadOf } from './fields';
import { headerLine, viewHeader } from './header';
import type { ViewModel } from './model';
import { attrValue, jsonString } from './text';
import { depthFirst } from './tree';

type CommentsOptions = { budget?: number; door?: ViewDoor; all?: boolean };

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

// An element's threads: its own, then (on a Sheet) each cell's, named by its cell key
// (docs/specs/029-sheets/sheet.md "Cell comments").
function threadsOfElement(model: ViewModel, el: Element): Thread[] {
  const base = {
    ref: model.refs.refOf(el.id),
    kind: model.kindOf(el),
    label: textField(el, 'label'),
  };
  const thread = threadOf(el);
  const own: Thread[] =
    thread === null
      ? []
      : [{ ...base, resolved: thread.resolved, comments: thread.comments.map(readComment) }];
  return [
    ...own,
    ...cellThreadsOf(el).map((t) => ({
      ...base,
      cell: t.cell,
      resolved: t.resolved,
      comments: t.comments.map(readComment),
    })),
  ];
}

function threadLines(thread: Thread): ViewLine[] {
  const label = thread.label === null ? '' : ` ${jsonString(thread.label, LABEL_CUT_CHARS)}`;
  const state = thread.resolved ? 'resolved' : 'open';
  const cell = thread.cell === undefined ? '' : ` · cell ${thread.cell}`;
  return [
    {
      text: `${thread.kind} ${thread.ref}${label}${cell} · ${state} · ${thread.comments.length}`,
      noun: THREAD,
    },
    ...thread.comments.map((c) => ({
      text: `  ${commentText(c)}`,
      noun: COMMENT,
    })),
  ];
}

// A thread as a listing across tabs prints it (the CLI's `comment ls`, `wait --for comment`): the comments view's
// thread line without the kind, which a listing does not carry, and with the tab it is on (CLI81).
export function threadListingLines(thread: {
  ref: string;
  label: string | null;
  resolved: boolean;
  tabName: string;
  // A Sheet cell's thread: its A1 when the listing knows it, else its cell key.
  cell?: string;
  cellRef?: string;
  comments: readonly ThreadComment[];
}): string[] {
  const label = thread.label === null ? '' : ` ${jsonString(thread.label, LABEL_CUT_CHARS)}`;
  const state = thread.resolved ? 'resolved' : 'open';
  const where = thread.cellRef ?? thread.cell;
  const cell = where === undefined ? '' : ` · cell ${where}`;
  return [
    `${thread.ref}${label}${cell} · ${state} · ${thread.comments.length} · tab ${jsonString(thread.tabName)}`,
    ...thread.comments.map((c) => `  ${commentText(c)}`),
  ];
}

// The elements holding a comment thread, in the outline's order, with their ref and label: what the comments view
// lists, for a reader that needs the element ids too (the api's thread listing, agent-presence blueprint).
export function commentHosts(
  model: ViewModel,
): { el: Element; ref: string; label: string | null }[] {
  return depthFirst(model.tree.roots)
    .map((n) => n.el)
    .filter((el) => threadOf(el) !== null || cellThreadsOf(el).length > 0)
    .map((el) => ({ el, ref: model.refs.refOf(el.id), label: textField(el, 'label') }));
}

export function commentsView(
  model: ViewModel,
  options: CommentsOptions = {},
): ViewResult<CommentsView> {
  const elements = depthFirst(model.tree.roots).map((n) => n.el);
  const threads = elements.flatMap((el) => threadsOfElement(model, el));
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
    fit: fitOf(fitted),
    json: { header: viewHeader('comments', model.facts), threads: json, elision: fitted.elision },
  };
}
