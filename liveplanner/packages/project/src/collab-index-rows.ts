// What one tab contributes to the collaboration index (docs/specs/013-workspace/inbox.md §2), and what
// a tab of a project in This Browser contributes to the Inbox read in the browser (§2.6).
//
// A pure projection of the tab's elements into the rows `collab_actions`
// and `collab_threads` hold: one per element carrying an action, one per
// element carrying a thread with at least one comment, and one per Sheet cell
// carrying one (docs/specs/029-sheets/sheet.md "Cell comments" "Inbox"). The api's db layer
// turns these into statements (every tab write path goes through it); the
// editor's offline Inbox read filters them directly.
//
// Kept apart from the api's timeline/tab-diff.ts on purpose. That module answers
// "what CHANGED in this save" for the feed; this one answers "what IS
// on this tab now" for the index, and a full snapshot is what lets a
// save be a replace rather than a diff.

import {
  CELL_INBOX_ROWS_MAX,
  cellThreadKey,
  cellThreadsOf,
  takesCellThreads,
} from './cell-comments';
import type { Comment } from './comments';
import { ACTION_CARD_MAX, elementActions, isClosedAction } from './element-action';
import { elementDisplayLabel } from './element-display-label';
import { isBoxed, type Element } from './index';

export type CollabActionRow = {
  elementId: string;
  actionId: string;
  elementLabel: string;
  name: string;
  description: string;
  status: 'open' | 'done';
  assigneeUserId: string | null;
  assigneeMemberId: string | null;
  assigneeName: string | null;
  assignerId: string;
  assignerName: string | null;
  teamId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CollabThreadRow = {
  elementId: string;
  elementLabel: string;
  resolved: boolean;
  commentCount: number;
  // Distinct server-stamped author ids, in first-appearance order.
  // Comments written before `authorId` existed contribute nothing here;
  // the thread still indexes, it just can't be attributed to them.
  participantIds: string[];
  // Authors who wrote in it only through an agent (a comment marked `ai`, posted with an API token): the Inbox
  // reaches them but still reads the thread as waiting on them (one-explorer-contracts.md "What an item pushes").
  agentIds: string[];
  // Distinct user ids and team member ids @-mentioned anywhere in the thread
  // (docs/specs/012-collaboration/comment-mentions.md), so the Inbox lists it for them.
  mentionedIds: string[];
  latestText: string;
  latestAuthorName: string;
  // The latest comment's server-stamped author, for the Timeline's "Comment Added"; null before authorId existed.
  latestAuthorId: string | null;
  latestAuthorColor: string;
  firstAt: number;
  latestAt: number;
};

export type CollabIndexRows = {
  actions: CollabActionRow[];
  threads: CollabThreadRow[];
};

// The longest id the index takes for an element (liveworkspace/apps/index/src/config.ts ID_MAX): a cell thread's
// key past it would make the index refuse the tab's whole push, so such a cell sends no row.
export const INDEX_PART_ID_MAX = 128;

// The A1 of a Sheet's cell for its Inbox label: a string, null when the cell's row or column is gone, undefined
// when the sheet is not at hand (the label is then the Sheet's alone).
export type CellRefOf = (el: Element, cell: string) => string | null | undefined;

type ThreadLike = { comments?: Comment[]; resolved?: boolean };

function threadOf(el: Element): ThreadLike | undefined {
  return (el as { commentThread?: ThreadLike }).commentThread;
}

// A thread's row, from its comments (at least one).
function threadRow(
  elementId: string,
  elementLabel: string,
  comments: Comment[],
  resolved: boolean | undefined,
): CollabThreadRow {
  // Newest by timestamp rather than array position: the array is
  // append-ordered in practice, but the timestamp is what the row
  // sorts and displays by, so it should also pick the preview.
  let latest = comments[0]!;
  let first = comments[0]!;
  const participants: string[] = [];
  const agents: string[] = [];
  const mentioned: string[] = [];
  for (const c of comments) {
    for (const m of c.mentions ?? []) {
      for (const id of [m.userId, m.memberId]) {
        if (id && !mentioned.includes(id)) mentioned.push(id);
      }
    }
    if (c.createdAt > latest.createdAt) latest = c;
    if (c.createdAt < first.createdAt) first = c;
    const by = c.ai ? agents : participants;
    if (c.authorId && !by.includes(c.authorId)) by.push(c.authorId);
  }
  return {
    elementId,
    elementLabel,
    resolved: resolved === true,
    commentCount: comments.length,
    participantIds: participants,
    agentIds: agents.filter((id) => !participants.includes(id)),
    mentionedIds: mentioned,
    latestText: latest.text,
    latestAuthorName: latest.authorName,
    latestAuthorId: latest.authorId ?? null,
    latestAuthorColor: latest.authorColor,
    firstAt: first.createdAt,
    latestAt: latest.createdAt,
  };
}

// The newest comment's time in a thread: what picks a big Sheet's cell rows.
function latestAtOf(comments: Comment[]): number {
  let at = -Infinity;
  for (const c of comments) if (c.createdAt > at) at = c.createdAt;
  return at;
}

// A Sheet's cell threads as rows (sheet.md "Cell comments" "Inbox"), keyed by cell and labelled `Sheet!A1`, in cell
// key order: at most CELL_INBOX_ROWS_MAX, those with the newest comments, picked before any row is built.
function cellThreadRows(
  el: Element,
  labelOf: () => string,
  cellRefOf: CellRefOf,
): CollabThreadRow[] {
  const cells = cellThreadsOf(el);
  if (!cells || !takesCellThreads(el)) return [];
  let picked: [string, Comment[], boolean | undefined][] = [];
  for (const cell of Object.keys(cells)) {
    const thread = cells[cell]!;
    const comments = thread.comments;
    if (!comments?.length) continue;
    if (cellThreadKey(el.id, cell).length > INDEX_PART_ID_MAX) continue;
    picked.push([cell, comments, thread.resolved]);
  }
  if (picked.length > CELL_INBOX_ROWS_MAX) {
    const at = new Map(picked.map(([cell, comments]) => [cell, latestAtOf(comments)]));
    picked = picked.sort((a, b) => at.get(b[0])! - at.get(a[0])!).slice(0, CELL_INBOX_ROWS_MAX);
  }
  picked.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const rows: CollabThreadRow[] = [];
  const label = picked.length > 0 ? labelOf() : '';
  for (const [cell, comments, resolved] of picked) {
    const ref = cellRefOf(el, cell);
    const cellLabel =
      ref === undefined ? label : ref === null ? `${label} (Deleted Cell)` : `${label}!${ref}`;
    rows.push(threadRow(cellThreadKey(el.id, cell), cellLabel, comments, resolved));
  }
  return rows;
}

const noCellRefs: CellRefOf = () => undefined;

export function collabIndexRowsFromElements(
  elements: Element[],
  cellRefOf: CellRefOf = noCellRefs,
): CollabIndexRows {
  const actions: CollabActionRow[] = [];
  const threads: CollabThreadRow[] = [];
  for (const el of elements) {
    // Actions and threads only ever hang off boxed elements (docs/specs/012-collaboration/assigned-actions.md
    // §1, docs/specs/008-canvas/canvas-and-palette.md), which is also what gives them a display label.
    if (!isBoxed(el)) continue;
    // Worked out only for an element with something to list.
    let label: string | undefined;
    const labelOf = () => (label ??= elementDisplayLabel(el));
    // One row per action: an Action panel holds a list (docs/specs/012-collaboration/action-panel.md).
    // Capped like the stored list, so the index stays bounded even for a tab
    // written before the cap existed.
    for (const action of elementActions(el).slice(0, ACTION_CARD_MAX)) {
      actions.push({
        elementId: el.id,
        actionId: action.id,
        elementLabel: labelOf(),
        name: action.name,
        description: action.description ?? '',
        // Won't Do is closed too (docs/specs/026-plan/linked-boards.md "On the canvas"): never listed as open.
        status: isClosedAction(action) ? 'done' : 'open',
        assigneeUserId: action.assignee.userId ?? null,
        assigneeMemberId: action.assignee.memberId ?? null,
        assigneeName: action.assignee.name ?? null,
        assignerId: action.assignerId,
        assignerName: action.assignerName ?? null,
        teamId: action.teamId ?? null,
        createdAt: action.createdAt,
        updatedAt: action.updatedAt,
      });
    }
    const own = threadOf(el);
    if (own?.comments?.length)
      threads.push(threadRow(el.id, labelOf(), own.comments, own.resolved));
    // A Sheet's cells' threads follow its own.
    for (const row of cellThreadRows(el, labelOf, cellRefOf)) threads.push(row);
  }
  return { actions, threads };
}
