'use client';

import { debugLog } from '@/lib/debug-log';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ItemsRoomOp } from '@livediagram/api-schema';
import {
  applyItemComment,
  createComment,
  keepOwnCommentAuthors,
  type CommentMention,
  type ItemCommentChange,
} from '@livediagram/document';
import {
  EMPTY_ITEM_STORE,
  applyItemWrite,
  asUndoWrite,
  inverseItemWrites,
  itemPersonId,
  mergeItemChanges,
  withCreateIds,
  type Item,
  type ItemPerson,
  type ItemStoreState,
  type ItemWrite,
} from '@livediagram/items';
import {
  fetchItems,
  writeItem,
  writeItemComment,
  type ItemCommentAction,
  type ItemsScope,
} from '@/lib/api/items';
import { track } from '@/lib/telemetry';
import { useAssignRef, useLatest } from '@/hooks/ui/useLatest';
import type { ItemUndoStep } from './item-undo-journal';
import { isVoteLimitError, VOTE_LIMIT_MESSAGE } from '@/lib/vote-limit';

// A burst of revision gaps refetches once (blueprint item-store.md "Constants").
export const ITEM_REFETCH_DEBOUNCE_MS = 400;

export type PlanItemsStatus = 'loading' | 'ready' | 'error';

export type PlanItems = {
  store: ItemStoreState;
  items: ReadonlyMap<string, Item>;
  status: PlanItemsStatus;
  // This person as items name them: the hashed id, their name and colour (null until hashed).
  self: ItemPerson | null;
  // Applies a write now, sends it, and settles on the answer; every write but a vote is undoable.
  write: (write: ItemWrite) => Promise<boolean>;
  // The same, with no undo step: for content the editor makes and takes away itself (the Plan tour's
  // example cards, docs/specs/026-plan/plan-tour.md "Tour content"), which Undo must never bring back.
  writeQuiet: (write: ItemWrite) => Promise<boolean>;
  receive: (op: ItemsRoomOp) => void;
  refetch: () => void;
  // A card's comment change (docs/specs/026-plan/items.md "Comments"): applied now, sent, settled on the
  // answer. Outside Undo, as the canvas's comments are.
  comment: (itemId: string, action: ItemCommentAction) => Promise<boolean>;
  // This person's owner id: the author id their own comments carry (the delete-own check).
  ownerId: string;
};

// The document's item store in the editor (docs/specs/026-plan/items.md, blueprint item-store.md
// "Editor slice"): loaded once the document is, written optimistically through the same pure
// transitions the api applies, kept live by the room's `items` op, and refetched on a revision gap,
// a reconnect or a resync. Every write but a vote is undoable through `pushUndo`.
export function usePlanItems(opts: {
  documentId: string | null;
  // Loads once the document has hydrated.
  ready: boolean;
  ownerId: string;
  name: string;
  color: string;
  shareCode: string | null;
  tabScope: string | null;
  pushUndo: (step: ItemUndoStep) => void;
  onError: (message: string) => void;
  // A card comment with mentions has landed: notify the mentioned people, as a canvas comment does
  // (docs/specs/012-collaboration/comment-mentions.md "The email").
  onMentioned?: (text: string, mentions: CommentMention[], itemId: string) => void;
}): PlanItems {
  const { documentId, ready, ownerId, name, color, shareCode, tabScope } = opts;
  // Handed over fresh each render: read at call time, so `send` and `write` keep their identity.
  const callbacks = useLatest({
    pushUndo: opts.pushUndo,
    onError: opts.onError,
    onMentioned: opts.onMentioned,
  });
  const [store, setStore] = useState<ItemStoreState>(EMPTY_ITEM_STORE);
  const [status, setStatus] = useState<PlanItemsStatus>('loading');
  const [personId, setPersonId] = useState<string | null>(null);
  // The newest store, which an optimistic write also moves on at once (before React renders it).
  const storeRef = useRef(store);
  useAssignRef(storeRef, store);
  // The last revision the server told us of (an answer or an op), for gap detection; local
  // optimistic writes never move it.
  const serverRevRef = useRef(0);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    void itemPersonId(ownerId).then((id) => live && setPersonId(id));
    return () => {
      live = false;
    };
  }, [ownerId]);

  const self = useMemo<ItemPerson | null>(
    () => (personId ? { id: personId, name, color } : null),
    [personId, name, color],
  );
  const selfRef = useLatest(self);

  const scope = useMemo<ItemsScope | null>(
    () => (documentId ? { ownerId, documentId, shareCode, tabId: tabScope } : null),
    [ownerId, documentId, shareCode, tabScope],
  );
  const scopeRef = useLatest(scope);

  // Whether the items have been asked for at all this session.
  const loadedRef = useRef(false);
  const load = useCallback(async () => {
    const s = scopeRef.current;
    if (!s) return;
    loadedRef.current = true;
    try {
      const fetched = await fetchItems(s);
      const fetchedIds = new Set(fetched.items.map((f) => f.id));
      serverRevRef.current = fetched.rev;
      // Keep anything newer that arrived while the fetch was in flight.
      setStore((prev) =>
        mergeItemChanges(
          fetched,
          prev.items.filter((i) => fetchedIds.has(i.id)),
          [],
          fetched.rev,
        ),
      );
      setStatus('ready');
    } catch (err) {
      console.warn('[plan] plan.items.load-failed', { error: String(err) });
      setStatus((prev) => (prev === 'ready' ? prev : 'error'));
    }
  }, [scopeRef]);

  useEffect(() => {
    if (!ready || !scope) return;
    void load();
  }, [ready, scope, load]);

  const refetch = useCallback(() => {
    // Never loaded (a document without Plan content): there is nothing to bring up to date.
    if (!loadedRef.current) return;
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => {
      refetchTimerRef.current = null;
      void load();
    }, ITEM_REFETCH_DEBOUNCE_MS);
  }, [load]);

  useEffect(
    () => () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    },
    [],
  );

  const receive = useCallback(
    (op: ItemsRoomOp) => {
      const gap = op.rev > serverRevRef.current + 1;
      serverRevRef.current = Math.max(serverRevRef.current, op.rev);
      setStore((prev) => {
        // The room's copy carries no comment author ids; ours keep the ones the api answered us with.
        const byId = new Map(prev.items.map((i) => [i.id, i]));
        const upserts = op.upserts.map((u) => keepOwnCommentAuthors(byId.get(u.id), u));
        return mergeItemChanges(prev, upserts, op.removed, op.rev);
      });
      // A tab-scoped session hears the rev without the items; anyone may have missed one.
      if (gap || (op.upserts.length === 0 && op.removed.length === 0)) {
        debugLog('[items] items.refetch.gap', { rev: op.rev });
        refetch();
      }
    },
    [refetch],
  );

  // Applies, sends and settles one write; false when it was refused (the store is refetched).
  const send = useCallback(
    async (write: ItemWrite): Promise<{ ok: boolean; made: Item[] }> => {
      const s = scopeRef.current;
      const by = selfRef.current;
      if (!s || !by) return { ok: false, made: [] };
      const local = applyItemWrite(storeRef.current, write, { now: Date.now(), by });
      if (!local.ok) {
        console.warn('[items] items.rejected', { error: local.error });
        return { ok: false, made: [] };
      }
      storeRef.current = local.state;
      setStore(local.state);
      try {
        const answer = await writeItem(s, write, by);
        if (answer.rev >= 0) serverRevRef.current = Math.max(serverRevRef.current, answer.rev);
        setStore((prev) => mergeItemChanges(prev, answer.upserts, answer.removed, answer.rev));
        return { ok: true, made: answer.upserts };
      } catch (err) {
        console.warn('[items] items.write.failed', { kind: write.kind, error: String(err) });
        callbacks.current.onError(
          (err as { code?: string }).code === 'items_full'
            ? 'This document already holds the most items it can'
            : isVoteLimitError(err)
              ? VOTE_LIMIT_MESSAGE
              : "Couldn't save that change",
        );
        void load();
        return { ok: false, made: [] };
      }
    },
    [load, callbacks, scopeRef, selfRef],
  );

  const write = useCallback(
    async (input: ItemWrite): Promise<boolean> => {
      const w = withCreateIds(input);
      const before = storeRef.current;
      const inverse = inverseItemWrites(before, w);
      const result = await send(w);
      if (!result.ok || !inverse) return result.ok;
      // A redo makes the same items again, keys included.
      const redo: ItemWrite =
        w.kind === 'create'
          ? {
              kind: 'create',
              creates: w.creates.map((c) => ({
                ...c,
                key: result.made.find((m) => m.id === c.id)?.key ?? c.key,
              })),
            }
          : w;
      // Both sides are marked as an undo, so a card type's left-out statuses never refuse putting a change back.
      callbacks.current.pushUndo({
        undo: () => {
          for (const back of inverse) void send(asUndoWrite(back));
        },
        redo: () => void send(asUndoWrite(redo)),
      });
      return true;
    },
    [send, callbacks],
  );

  const writeQuiet = useCallback(
    async (input: ItemWrite): Promise<boolean> => (await send(withCreateIds(input))).ok,
    [send],
  );

  const comment = useCallback(
    async (itemId: string, action: ItemCommentAction): Promise<boolean> => {
      const s = scopeRef.current;
      const by = selfRef.current;
      if (!s || !by) return false;
      // Literal pairs, so the telemetry manifest test sees each one.
      if (action.kind === 'add') track('Comment', 'Added', 'Item');
      else if (action.kind === 'delete') track('Comment', 'Deleted', 'Item');
      else if (action.resolved) track('Comment', 'Resolved', 'Item');
      else track('Comment', 'Unresolved', 'Item');
      // Shown at once; the api's answer (its own comment id, its stamp) replaces it.
      const item = storeRef.current.items.find((i) => i.id === itemId);
      const change: ItemCommentChange =
        action.kind === 'add'
          ? {
              kind: 'add',
              comment: createComment(action.text, { id: ownerId, name, color }, action.mentions),
            }
          : action.kind === 'delete'
            ? { kind: 'remove', commentId: action.commentId }
            : action;
      const local = item ? applyItemComment(item, change, { now: Date.now(), by }) : null;
      if (local?.ok) {
        const next = {
          ...storeRef.current,
          items: storeRef.current.items.map((i) => (i.id === itemId ? local.item : i)),
        };
        storeRef.current = next;
        setStore(next);
      }
      try {
        const answer = await writeItemComment(s, itemId, action, { ownerId, by });
        if (answer) {
          if (answer.rev >= 0) serverRevRef.current = Math.max(serverRevRef.current, answer.rev);
          setStore((prev) => mergeItemChanges(prev, answer.upserts, answer.removed, answer.rev));
        }
        // Only once the comment has landed, so a refused comment never emails anyone.
        if (action.kind === 'add' && action.mentions?.length) {
          callbacks.current.onMentioned?.(action.text, action.mentions, itemId);
        }
        return true;
      } catch (err) {
        console.warn('[items] items.comment.failed', { kind: action.kind, error: String(err) });
        callbacks.current.onError(
          (err as { code?: string }).code === 'comments_full'
            ? 'This card holds the most comments it can'
            : "Couldn't save that comment",
        );
        void load();
        return false;
      }
    },
    [load, callbacks, scopeRef, selfRef, ownerId, name, color],
  );

  const items = useMemo(() => new Map(store.items.map((i) => [i.id, i])), [store.items]);

  return { store, items, status, self, write, writeQuiet, receive, refetch, comment, ownerId };
}
