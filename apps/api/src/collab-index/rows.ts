// What one tab contributes to the collaboration index (docs/specs/013-workspace/inbox.md §2).
//
// A pure projection of the tab's elements into the rows `collab_actions`
// and `collab_threads` hold: one per element carrying an action, one per
// element carrying a thread with at least one comment. The db layer
// turns these into statements; every tab write path goes through it.
//
// Kept apart from timeline/tab-diff.ts on purpose. That module answers
// "what CHANGED in this save" for the feed; this one answers "what IS
// on this tab now" for the index, and a full snapshot is what lets a
// save be a replace rather than a diff.

import {
  ACTION_CARD_MAX,
  elementActions,
  elementDisplayLabel,
  isBoxed,
  type Comment,
  type Element,
} from '@livediagram/document';

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
  // Distinct user ids and team member ids @-mentioned anywhere in the thread
  // (docs/specs/012-collaboration/comment-mentions.md), so the Inbox lists it for them.
  mentionedIds: string[];
  latestText: string;
  latestAuthorName: string;
  latestAuthorColor: string;
  firstAt: number;
  latestAt: number;
};

export type CollabIndexRows = {
  actions: CollabActionRow[];
  threads: CollabThreadRow[];
};

function threadOf(el: Element): { comments?: Comment[]; resolved?: boolean } | undefined {
  return (el as { commentThread?: { comments?: Comment[]; resolved?: boolean } }).commentThread;
}

export function collabIndexRowsFromElements(elements: Element[]): CollabIndexRows {
  const actions: CollabActionRow[] = [];
  const threads: CollabThreadRow[] = [];
  for (const el of elements) {
    // Actions and threads only ever hang off boxed elements (docs/specs/012-collaboration/assigned-actions.md
    // §1, docs/specs/008-canvas/canvas-and-palette.md), which is also what gives them a display label.
    if (!isBoxed(el)) continue;
    // One row per action: an Action panel holds a list (docs/specs/012-collaboration/action-panel.md).
    // Capped like the stored list, so the index stays bounded even for a tab
    // written before the cap existed.
    for (const action of elementActions(el).slice(0, ACTION_CARD_MAX)) {
      actions.push({
        elementId: el.id,
        actionId: action.id,
        elementLabel: elementDisplayLabel(el),
        name: action.name,
        description: action.description ?? '',
        status: action.status === 'done' ? 'done' : 'open',
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
    const thread = threadOf(el);
    const comments = thread?.comments ?? [];
    if (thread && comments.length > 0) {
      // Newest by timestamp rather than array position: the array is
      // append-ordered in practice, but the timestamp is what the row
      // sorts and displays by, so it should also pick the preview.
      let latest = comments[0]!;
      let first = comments[0]!;
      const participants: string[] = [];
      const mentioned: string[] = [];
      for (const c of comments) {
        for (const m of c.mentions ?? []) {
          for (const id of [m.userId, m.memberId]) {
            if (id && !mentioned.includes(id)) mentioned.push(id);
          }
        }
        if (c.createdAt > latest.createdAt) latest = c;
        if (c.createdAt < first.createdAt) first = c;
        if (c.authorId && !participants.includes(c.authorId)) participants.push(c.authorId);
      }
      threads.push({
        elementId: el.id,
        elementLabel: elementDisplayLabel(el),
        resolved: thread.resolved === true,
        commentCount: comments.length,
        participantIds: participants,
        mentionedIds: mentioned,
        latestText: latest.text,
        latestAuthorName: latest.authorName,
        latestAuthorColor: latest.authorColor,
        firstAt: first.createdAt,
        latestAt: latest.createdAt,
      });
    }
  }
  return { actions, threads };
}
