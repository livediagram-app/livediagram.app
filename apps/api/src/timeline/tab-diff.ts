// What changed on a tab, for timeline emission (spec/138 §4.3).
//
// Comments and assigned actions live INSIDE element JSON
// (packages/diagram), not in tables — there is no comments table to
// hang a trigger off, and no actions table either. So the only place
// that can tell "a comment was added" is the save that added it, by
// diffing the incoming elements against the stored ones.
//
// The worker already does exactly this diff for a different reason:
// `rewriteCommentAuthors` compares by comment id to stamp
// server-trusted authorship, and `hasNewComments` answers the same
// question as a boolean for the email notification. This module
// returns the actual rows instead of a yes/no, and covers actions and
// thread resolution too.
//
// Kept out of ../comments.ts on purpose: that module is the author
// trust boundary, and it should stay small enough to audit.

import type { Comment, Element, ElementAction } from '@livediagram/diagram';

function threadOf(el: Element): { comments?: Comment[]; resolved?: boolean } | undefined {
  return (el as { commentThread?: { comments?: Comment[]; resolved?: boolean } }).commentThread;
}

function actionOf(el: Element): ElementAction | undefined {
  return (el as { action?: ElementAction }).action;
}

// Comments present in `next` whose id isn't in `prev`. Ordered as the
// elements are, which for a single save is the order they were written.
export function newComments(next: Element[], prev: Element[]): Comment[] {
  const seen = new Set<string>();
  for (const el of prev) {
    for (const c of threadOf(el)?.comments ?? []) seen.add(c.id);
  }
  const added: Comment[] = [];
  for (const el of next) {
    for (const c of threadOf(el)?.comments ?? []) {
      if (!seen.has(c.id)) added.push(c);
    }
  }
  return added;
}

// Element ids whose thread flipped from unresolved (or absent) to
// resolved in this save. Keyed by element id rather than a thread id
// because a thread has none — it hangs off its element.
export function newlyResolvedThreads(next: Element[], prev: Element[]): string[] {
  const wasResolved = new Map<string, boolean>();
  for (const el of prev) {
    const thread = threadOf(el);
    if (thread) wasResolved.set(el.id, thread.resolved === true);
  }
  const flipped: string[] = [];
  for (const el of next) {
    const thread = threadOf(el);
    if (!thread?.resolved) continue;
    // `false` (was open) flips; `undefined` (no thread before) means
    // the whole thread arrived resolved in one save, which is not a
    // resolution moment anyone watched happen.
    if (wasResolved.get(el.id) === false) flipped.push(el.id);
  }
  return flipped;
}

// Actions that appeared in this save. An action's id is stable across
// edits (spec/68: at most one per element, created once), so "not seen
// before" is exactly "assigned now".
export function newActions(next: Element[], prev: Element[]): ElementAction[] {
  const seen = new Set<string>();
  for (const el of prev) {
    const action = actionOf(el);
    if (action) seen.add(action.id);
  }
  const added: ElementAction[] = [];
  for (const el of next) {
    const action = actionOf(el);
    if (action && !seen.has(action.id)) added.push(action);
  }
  return added;
}

// Actions whose status flipped to 'done' in this save. An action that
// arrived already done (assigned and completed in one save, or a
// duplicated diagram carrying a finished action across) is not a
// completion moment and is excluded.
export function completedActions(next: Element[], prev: Element[]): ElementAction[] {
  const previousStatus = new Map<string, string>();
  for (const el of prev) {
    const action = actionOf(el);
    if (action) previousStatus.set(action.id, action.status);
  }
  const done: ElementAction[] = [];
  for (const el of next) {
    const action = actionOf(el);
    if (action?.status === 'done' && previousStatus.get(action.id) === 'open') done.push(action);
  }
  return done;
}
