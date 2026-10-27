'use client';

// The plan's card comment threads in the editor (docs/specs/026-plan/items.md "Comments", blueprint item-store.md
// "Editor"): every thread on a card of this plan (its own and those shared in from other plans), loaded once the
// items are, kept live by the room's `threads` op, and read again on a reconnect. A write is applied at once by the
// same pure change the api applies, sent, and settled on the answer; a refusal says why and reads them again.
// Outside Undo, as comments always were.
//
// Card faces read their comment count through `store` (thread-store.ts), so a write re-renders only the cards whose
// count it changed, never every card on the board.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CardThreadsRoomOp } from '@liveplanner/api-schema';
import {
  applyThreadChange,
  createComment,
  keepOwnThreadAuthors,
  newThreadId,
  openCommentCounts,
  readThreadTitle,
  sortedThreads,
  startThread,
  threadsOnCard,
  type CardThread,
  type CommentMention,
  type ThreadChange,
} from '@liveplanner/project';
import type { ItemPerson } from '@liveplanner/items';
import { fetchThreads, writeThread, type ThreadAction } from '@/lib/api/card-threads';
import type { ItemsScope } from '@/lib/api/items';
import { track } from '@/lib/telemetry';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { createThreadStore, type ThreadStore } from './thread-store';

const THREAD_REFETCH_DEBOUNCE_MS = 400;

export type CardThreadsStatus = 'loading' | 'ready' | 'error';

export type CardThreads = {
  status: CardThreadsStatus;
  // Every thread, by id.
  threads: ReadonlyMap<string, CardThread>;
  // A card's threads, open first by activity, then resolved ones.
  threadsOf: (itemId: string) => CardThread[];
  // The faces' comment counts, by card, read per card (thread-store.ts).
  store: ThreadStore;
  // One action: applied now, sent, settled. Answers the thread as it then is (a start's new thread), null when it
  // went, or false when it was refused.
  act: (action: ThreadAction) => Promise<CardThread | null | false>;
  receive: (op: CardThreadsRoomOp) => void;
  refetch: () => void;
  projectId: string | null;
  // The thread a link asked to open (#item=…&thread=…): its card's panel expands it and brings it into view, then
  // lets it go.
  focused: string | null;
  focus: (threadId: string | null) => void;
};

// Why a write was refused, in words (docs/specs/026-plan/items.md "Writes").
export function threadRefusalMessage(code: string | null): string {
  switch (code) {
    case 'comments_full':
      return 'This thread holds the most comments it can';
    case 'threads_full':
      return 'That card holds the most threads it can';
    case 'thread_cards_full':
      return 'This thread is on as many cards as it can be';
    case 'thread_on_card':
      return 'This thread is on that card already';
    case 'title_too_long':
      return 'That title is too long: a thread title holds up to 120 characters';
    case 'thread_not_found':
      return 'That thread is gone';
    case 'item_not_found':
      return 'That card is gone';
    case 'forbidden':
      return 'You can’t do that here';
    default:
      return "Couldn't save that comment";
  }
}

// Literal pairs, so the telemetry manifest's coverage test sees each one (docs/specs/017-telemetry/telemetry.md).
function trackAction(action: ThreadAction, here: string | null): void {
  switch (action.kind) {
    case 'start':
      return track('Comment', 'Created', 'Thread');
    case 'reply':
      return track('Comment', 'Added', 'Item');
    case 'edit':
      return track('Comment', 'Changed', 'Item');
    case 'delete':
      return track('Comment', 'Deleted', 'Item');
    case 'resolve':
      return action.resolved
        ? track('Comment', 'Resolved', 'Item')
        : track('Comment', 'Unresolved', 'Item');
    case 'rename':
      return track('Comment', 'Renamed', 'Thread');
    case 'addToCard':
      return action.projectId && action.projectId !== here
        ? track('Comment', 'Linked', 'ThreadOtherPlan')
        : track('Comment', 'Linked', 'Thread');
    case 'deleteThread':
      return track('Comment', 'Deleted', 'Thread');
  }
}

// The change an action makes to a held thread, for showing it at once: null for one shown only once it lands (a
// delete, a card added in another plan, which the answer brings).
function localChange(
  action: Exclude<ThreadAction, { kind: 'start' }>,
  who: { ownerId: string; by: ItemPerson },
): ThreadChange | null {
  switch (action.kind) {
    case 'reply':
      return {
        kind: 'add',
        comment: createComment(
          action.text,
          { id: who.ownerId, name: who.by.name, color: who.by.color },
          action.mentions,
        ),
      };
    case 'edit':
      return {
        kind: 'edit',
        commentId: action.commentId,
        text: action.text,
        ...(action.mentions?.length ? { mentions: action.mentions } : {}),
      };
    case 'delete':
      return { kind: 'remove', commentId: action.commentId };
    case 'resolve':
      return { kind: 'resolve', resolved: action.resolved, by: who.by.name };
    case 'rename': {
      const title = readThreadTitle(action.title);
      return title === null ? null : { kind: 'rename', title };
    }
    case 'addToCard':
    case 'deleteThread':
      return null;
  }
}

export function useCardThreads(opts: {
  projectId: string | null;
  // Loads once the plan's items have (a plan with no cards holds no threads to show).
  ready: boolean;
  ownerId: string;
  self: ItemPerson | null;
  shareCode: string | null;
  tabScope: string | null;
  onError: (message: string) => void;
  // A start or reply with mentions has landed: the editor's mention notice (useCommentMentions).
  onMentioned?: (
    text: string,
    mentions: CommentMention[],
    itemId: string,
    commentId?: string,
  ) => void;
}): CardThreads {
  const { projectId, ready, ownerId, shareCode, tabScope } = opts;
  const callbacks = useLatest({ onError: opts.onError, onMentioned: opts.onMentioned });
  const selfRef = useLatest(opts.self);
  const [threads, setThreads] = useState<ReadonlyMap<string, CardThread>>(() => new Map());
  const [status, setStatus] = useState<CardThreadsStatus>('loading');
  const threadsRef = useRef(threads);
  const set = useCallback((next: ReadonlyMap<string, CardThread>) => {
    threadsRef.current = next;
    setThreads(next);
  }, []);
  const store = useMemo(() => createThreadStore(), []);
  const [focused, focus] = useState<string | null>(null);

  const scope = useMemo<ItemsScope | null>(
    () => (projectId ? { ownerId, projectId, shareCode, tabId: tabScope } : null),
    [ownerId, projectId, shareCode, tabScope],
  );
  const scopeRef = useLatest(scope);

  // The faces' counts follow the threads (only the cards whose count moved hear it).
  useEffect(() => {
    if (projectId) store.setCounts(openCommentCounts(threads.values(), projectId));
  }, [threads, projectId, store]);

  const loadedRef = useRef(false);
  const load = useCallback(async () => {
    const s = scopeRef.current;
    if (!s) return;
    loadedRef.current = true;
    try {
      const fetched = await fetchThreads(s);
      const held = threadsRef.current;
      set(new Map(fetched.map((t) => [t.id, keepOwnThreadAuthors(held.get(t.id), t)])));
      setStatus('ready');
    } catch (err) {
      console.warn('[threads] threads.load-failed', { error: String(err) });
      setStatus((prev) => (prev === 'ready' ? prev : 'error'));
    }
  }, [scopeRef, set]);

  useEffect(() => {
    if (!ready || !scope) return;
    void load();
  }, [ready, scope, load]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetch = useCallback(() => {
    if (!loadedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void load();
    }, THREAD_REFETCH_DEBOUNCE_MS);
  }, [load]);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const receive = useCallback(
    (op: CardThreadsRoomOp) => {
      // A tab-scoped session hears that something moved, without the threads.
      if (op.upserts.length === 0 && op.removed.length === 0) {
        refetch();
        return;
      }
      const next = new Map(threadsRef.current);
      for (const t of op.upserts) next.set(t.id, keepOwnThreadAuthors(next.get(t.id), t));
      for (const id of op.removed) next.delete(id);
      set(next);
    },
    [refetch, set],
  );

  // A thread as the answer has it, folded in; null takes it away.
  const settle = useCallback(
    (id: string, thread: CardThread | null, replaces?: string) => {
      const next = new Map(threadsRef.current);
      if (replaces) next.delete(replaces);
      if (thread) next.set(thread.id, keepOwnThreadAuthors(next.get(thread.id), thread));
      else next.delete(id);
      set(next);
    },
    [set],
  );

  const act = useCallback(
    async (action: ThreadAction): Promise<CardThread | null | false> => {
      const s = scopeRef.current;
      const by = selfRef.current;
      if (!s || !by) return false;
      trackAction(action, s.projectId);
      const who = { ownerId, by };
      const before = threadsRef.current;
      // Shown at once, as this person wrote it; the answer replaces it.
      let pendingId: string | null = null;
      if (action.kind === 'start') {
        pendingId = newThreadId();
        const item = { projectId: s.projectId, itemId: action.itemId, key: null };
        const shown = startThread({
          id: pendingId,
          home: s.projectId,
          card: item,
          comment: createComment(
            action.text,
            { id: ownerId, name: by.name, color: by.color },
            action.mentions,
          ),
          now: Date.now(),
        });
        settle(pendingId, shown);
      } else {
        const held = before.get(action.threadId);
        const change = held ? localChange(action, who) : null;
        if (held && change) {
          const local = applyThreadChange(held, change, Date.now());
          if (local.ok) settle(held.id, local.thread);
        } else if (held && action.kind === 'deleteThread') settle(held.id, null);
      }
      try {
        const answer = await writeThread(s, action, who);
        if ('unchanged' in answer) return before.get('threadId' in action ? action.threadId : '') ?? null;
        const id = 'threadId' in action ? action.threadId : (answer.thread?.id ?? pendingId!);
        settle(id, answer.thread, pendingId ?? undefined);
        // Only once it has landed, so a refused comment never notifies anyone.
        if ((action.kind === 'start' || action.kind === 'reply') && action.mentions?.length) {
          const itemId =
            action.kind === 'start'
              ? action.itemId
              : (answer.thread?.cards.find((c) => c.projectId === s.projectId)?.itemId ?? '');
          callbacks.current.onMentioned?.(action.text, action.mentions, itemId, answer.commentId);
        }
        return answer.thread;
      } catch (err) {
        console.warn('[threads] threads.write.failed', { kind: action.kind, error: String(err) });
        // Put back what was shown, then read again: the stored threads decide.
        set(before);
        callbacks.current.onError(threadRefusalMessage((err as { code?: string }).code ?? null));
        void load();
        return false;
      }
    },
    [scopeRef, selfRef, ownerId, settle, set, load, callbacks],
  );

  const threadsOf = useCallback(
    (itemId: string) =>
      projectId ? sortedThreads(threadsOnCard(threads.values(), projectId, itemId)) : [],
    [threads, projectId],
  );

  return useMemo(
    () => ({
      status,
      threads,
      threadsOf,
      store,
      act,
      receive,
      refetch,
      projectId,
      focused,
      focus,
    }),
    [status, threads, threadsOf, store, act, receive, refetch, projectId, focused],
  );
}
