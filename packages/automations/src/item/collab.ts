// The comment and action triggers' events, worked out from what a tab's threads and actions were and now are
// (liveworkspace/docs/specs/018-automations/automations.md "Triggers every app has"; blueprint item-engine.md "Collab
// diff"). The apps already build this summary of a tab for the index; the shapes here are the fields of it the diff
// reads, so each app passes its own. A rule's own comment starts no rule. Pure.

import { cutText } from '@liveworkspace/model-core/text-cut';
import { AUTOMATION_PERSON_ID, type AutomationPerson } from '../types';
import { ITEM_COMMENT_MAX, type ItemEvent, type ItemRole } from './types';

export type CollabThread = {
  elementId: string;
  resolved: boolean;
  commentCount: number;
  latestText: string;
  latestAuthorId: string | null;
  latestAuthorName: string;
  latestAuthorColor?: string;
};

export type CollabAction = {
  elementId: string;
  actionId: string;
  name: string;
  status: string;
  assigneeId: string | null;
  assigneeName?: string | null;
};

export type CollabSummary = {
  threads: readonly CollabThread[];
  actions: readonly CollabAction[];
};

// What the diff is told of the write between the two summaries.
export type CollabAbout = {
  tab: string;
  at: number;
  // Whoever alone wrote since `before`, when there was one person: who resolved, assigned or finished.
  by?: AutomationPerson;
  role?: ItemRole;
};

const actionKey = (a: CollabAction) => `${a.elementId}\u0000${a.actionId}`;

/** The events between two summaries of one tab. `before` null (the first summary ever seen): none, so a tab's
 *  standing threads never start a rule. Each event's id is made from what changed, so the same diff twice is one run. */
export function collabEvents(
  before: CollabSummary | null,
  after: CollabSummary,
  about: CollabAbout,
): ItemEvent[] {
  if (!before) return [];
  const { tab, at } = about;
  const who = {
    ...(about.by ? { by: about.by } : {}),
    ...(about.role ? { role: about.role } : {}),
  };
  const out: ItemEvent[] = [];
  const threadsBefore = new Map(before.threads.map((t) => [t.elementId, t]));
  let resolved = false;
  for (const thread of after.threads) {
    const was = threadsBefore.get(thread.elementId);
    if (
      thread.commentCount > (was?.commentCount ?? 0) &&
      thread.latestAuthorId !== AUTOMATION_PERSON_ID
    )
      out.push({
        id: `c:${tab}:${thread.elementId}:${thread.commentCount}`,
        kind: 'comment_added',
        at,
        tab,
        by: {
          id: thread.latestAuthorId ?? '',
          name: thread.latestAuthorName,
          color: thread.latestAuthorColor ?? '',
        },
        ...(about.role ? { role: about.role } : {}),
        data: { comment: cutText(thread.latestText, ITEM_COMMENT_MAX) },
      });
    if (thread.resolved && was && !was.resolved) {
      resolved = true;
      out.push({
        id: `r:${tab}:${thread.elementId}:${at}`,
        kind: 'thread_resolved',
        at,
        tab,
        ...who,
      });
    }
  }
  if (resolved && after.threads.every((t) => t.resolved))
    out.push({ id: `rr:${tab}:${at}`, kind: 'threads_resolved', at, tab, ...who });
  const actionsBefore = new Map(before.actions.map((a) => [actionKey(a), a]));
  for (const action of after.actions) {
    const was = actionsBefore.get(actionKey(action));
    if (action.assigneeId !== null && action.assigneeId !== was?.assigneeId)
      out.push({
        id: `a:${tab}:${action.actionId}:${action.assigneeId}:${at}`,
        kind: 'action_assigned',
        at,
        tab,
        ...who,
        data: { action: action.name, assignee: action.assigneeName ?? '' },
      });
    if (action.status === 'done' && was?.status !== 'done')
      out.push({
        id: `d:${tab}:${action.actionId}:${at}`,
        kind: 'action_done',
        at,
        tab,
        ...who,
        data: { action: action.name },
      });
  }
  return out;
}
