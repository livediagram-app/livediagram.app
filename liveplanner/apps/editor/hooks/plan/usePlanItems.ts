'use client';

import { subscribeOfflineIds } from '@/lib/offline/offline-store';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ItemsRoomOp } from '@liveplanner/api-schema';
import {
  EMPTY_ITEM_STORE,
  ITEM_TITLE_MAX,
  applyItemWrite,
  asUndoWrite,
  inverseItemWrites,
  itemPersonId,
  itemIdsOfWrite,
  mergeItemChanges,
  refetchedItemStore,
  withCreateIds,
  writeLimitedTo,
  type Item,
  type ItemPerson,
  type ItemStoreState,
  type ItemWrite,
} from '@liveplanner/items';
import { fetchItems, writeItem, type ItemWriteAnswer, type ItemsScope } from '@/lib/api/items';
import { useAssignRef, useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { ItemUndoStep } from './item-undo-journal';

// A burst of revision gaps refetches once (blueprint item-store.md "Constants").
const ITEM_REFETCH_DEBOUNCE_MS = 400;

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
  // `silent`: a refusal tells nobody (the Actions board's heal, docs/specs/026-plan/linked-boards.md "Keeping them
  // together", whose duplicate of a teammate's identical write is refused and is no failure).
  writeQuiet: (write: ItemWrite, opts?: { silent?: boolean }) => Promise<boolean>;
  receive: (op: ItemsRoomOp) => void;
  refetch: () => void;
  // This person's owner id: the author id their own comments carry (the delete-own check).
  ownerId: string;
  // Who is asking for which project, and through which share link (an Image field's uploads and reads, docs/specs/
  // 026-plan/item-types.md "Image fields"); null until the project is known.
  scope?: ItemsScope | null;
};

// The project's item store in the editor (docs/specs/026-plan/items.md, blueprint item-store.md
// "Editor slice"): loaded once the project is, written optimistically through the same pure
// transitions the api applies, kept live by the room's `items` op, and refetched on a revision gap,
// a reconnect or a resync. Every write but a vote is undoable through `pushUndo`.
// What a refused change says, by its reason (the store's or the api's), so a too-long field is named, not a
// generic failure.
export function refusalMessage(code: string): string {
  switch (code) {
    case 'title_too_long':
      return `That title is too long: a card title holds up to ${ITEM_TITLE_MAX} characters`;
    case 'title_required':
      return 'A card needs a title';
    case 'fields_too_large':
      return 'That card is too large to save: shorten its description or fields';
    case 'fields_too_many':
      return 'That card has too many fields to save';
    case 'status_excluded':
      return 'That card’s type doesn’t use that state';
    case 'field_required':
      return 'That field is required on this card type';
    case 'field_value_invalid':
      return 'That value is too long or isn’t one this field takes';
    // A Blocked By link that closes a loop (docs/specs/026-plan/item-types.md "Blocked By"); the card panel refuses
    // it first, naming the chain, so this is a race or an undo.
    case 'blocks_cycle':
      return 'Those cards would block each other in a loop';
    default:
      return "Couldn't save that change";
  }
}

// The undo of a card's delete carries the threads the card was on, as they were when it went.
function withThreads(
  undoes: ItemWrite[],
  threadsOf: ((itemId: string) => readonly unknown[]) | undefined,
): ItemWrite[] {
  if (!threadsOf) return undoes;
  return undoes.map((back) => {
    if (back.kind !== 'create') return back;
    let changed = false;
    const creates = back.creates.map((c) => {
      const threads = c.id ? threadsOf(c.id) : [];
      if (threads.length === 0) return c;
      changed = true;
      return { ...c, threads };
    });
    return changed ? { ...back, creates } : back;
  });
}

export function usePlanItems(opts: {
  projectId: string | null;
  // Loads once the project has hydrated.
  ready: boolean;
  ownerId: string;
  name: string;
  color: string;
  shareCode: string | null;
  tabScope: string | null;
  pushUndo: (step: ItemUndoStep) => void;
  onError: (message: string) => void;
  // The comment threads a card is on, as the editor holds them: an undo of the card's delete carries them, so the
  // card goes back on them (docs/specs/026-plan/items.md "Cards coming and going").
  threadsOf?: (itemId: string) => readonly unknown[];
  // A person's own undoable write, with the store it applies to (docs/specs/026-plan/linked-boards.md "The link").
  onOwnWrite?: (write: ItemWrite, before: ItemStoreState) => void;
}): PlanItems {
  const { projectId, ready, ownerId, name, color, shareCode, tabScope } = opts;
  // Handed over fresh each render: read at call time, so `send` and `write` keep their identity.
  const callbacks = useLatest({
    pushUndo: opts.pushUndo,
    onError: opts.onError,
    threadsOf: opts.threadsOf,
    onOwnWrite: opts.onOwnWrite,
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
  // Items whose last write was refused or failed: the next load takes the server's copy of them as it is.
  const unconfirmedRef = useRef(new Set<string>());

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
    () => (projectId ? { ownerId, projectId, shareCode, tabId: tabScope } : null),
    [ownerId, projectId, shareCode, tabScope],
  );
  const scopeRef = useLatest(scope);

  // Whether the items have been asked for at all this session.
  const loadedRef = useRef(false);
  const load = useCallback(async () => {
    const s = scopeRef.current;
    if (!s) return;
    loadedRef.current = true;
    try {
      // Read before the fetch: a write that fails while it is in flight asks for a load of its own.
      const unconfirmed = new Set(unconfirmedRef.current);
      const fetched = await fetchItems(s);
      serverRevRef.current = fetched.rev;
      unconfirmed.forEach((id) => unconfirmedRef.current.delete(id));
      setStore((prev) => refetchedItemStore(prev, fetched, unconfirmed));
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
    // Never loaded (a project without Plan content): there is nothing to bring up to date.
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

  // The project synced to the server in place (docs/specs/006-project/offline-mode.md "Syncing in
  // place"): the server's store, and its revision, replace the local one the board was reading.
  useEffect(
    () =>
      subscribeOfflineIds((id) => {
        if (loadedRef.current && id === scopeRef.current?.projectId) void load();
      }),
    [load, scopeRef],
  );

  const receive = useCallback(
    (op: ItemsRoomOp) => {
      const gap = op.rev > serverRevRef.current + 1;
      serverRevRef.current = Math.max(serverRevRef.current, op.rev);
      setStore((prev) => mergeItemChanges(prev, op.upserts, op.removed, op.rev));
      // A tab-scoped session hears the rev without the items; anyone may have missed one.
      if (gap || (op.upserts.length === 0 && op.removed.length === 0)) {
        debugLog('[items] items.refetch.gap', { rev: op.rev });
        refetch();
      }
    },
    [refetch],
  );

  // Applies, sends and settles one write; false when it was refused (the store is refetched). `made` is what the api
  // stored; a write refused after part of it landed (ItemWritePartlyLanded) is not ok, with the part in `made`.
  const send = useCallback(
    async (write: ItemWrite, silent = false): Promise<{ ok: boolean; made: Item[] }> => {
      const s = scopeRef.current;
      const by = selfRef.current;
      if (!s || !by) return { ok: false, made: [] };
      const local = applyItemWrite(storeRef.current, write, { now: Date.now(), by });
      if (!local.ok) {
        // Refused before it is sent: nothing changes, and the person is told why (the field goes back).
        console.warn('[items] items.rejected', { error: local.error });
        if (!silent) callbacks.current.onError(refusalMessage(local.error));
        return { ok: false, made: [] };
      }
      storeRef.current = local.state;
      setStore(local.state);
      // Folds an api answer in: a room op newer than it already landed, so an item that op removed stays removed.
      const settle = (answer: ItemWriteAnswer) => {
        const overtaken = answer.rev >= 0 && answer.rev < serverRevRef.current;
        if (answer.rev >= 0) serverRevRef.current = Math.max(serverRevRef.current, answer.rev);
        setStore((prev) => {
          const held = new Set(prev.items.map((i) => i.id));
          const upserts = overtaken ? answer.upserts.filter((u) => held.has(u.id)) : answer.upserts;
          return mergeItemChanges(prev, upserts, answer.removed, answer.rev);
        });
      };
      try {
        const answer = await writeItem(s, write, by);
        settle(answer);
        return { ok: true, made: answer.upserts };
      } catch (err) {
        console.warn('[items] items.write.failed', { kind: write.kind, error: String(err) });
        // ItemWritePartlyLanded carries what landed before the failure.
        const landed = (err as { landed?: ItemWriteAnswer } | null)?.landed ?? null;
        if (landed) settle(landed);
        const kept = new Set(landed?.upserts.map((u) => u.id));
        itemIdsOfWrite(write)
          .filter((id) => !kept.has(id))
          .forEach((id) => unconfirmedRef.current.add(id));
        const code = (err as { code?: string }).code;
        if (!silent)
          callbacks.current.onError(
            code === 'items_full'
              ? 'This plan already holds the most items it can'
              : code
                ? refusalMessage(code)
                : "Couldn't save that change",
          );
        void load();
        return { ok: false, made: landed?.upserts ?? [] };
      }
    },
    [load, callbacks, scopeRef, selfRef],
  );

  const write = useCallback(
    async (input: ItemWrite): Promise<boolean> => {
      const w = withCreateIds(input);
      const before = storeRef.current;
      const inverse = inverseItemWrites(before, w);
      // A person's own change, seen before it is applied (the Actions board deletes a deleted card's action).
      callbacks.current.onOwnWrite?.(w, before);
      const result = await send(w);
      if (!inverse) return result.ok;
      // Refused after part of it landed: the part that landed is still one undo step.
      const landedIds = new Set(result.made.map((m) => m.id));
      const undoes = withThreads(
        result.ok ? inverse : inverse.flatMap((back) => writeLimitedTo(back, landedIds) ?? []),
        callbacks.current.threadsOf,
      );
      const done = result.ok ? w : writeLimitedTo(w, landedIds);
      if (!done || undoes.length === 0) return result.ok;
      // A redo makes the same items again, keys included.
      const redo: ItemWrite =
        done.kind === 'create'
          ? {
              kind: 'create',
              creates: done.creates.map((c) => ({
                ...c,
                key: result.made.find((m) => m.id === c.id)?.key ?? c.key,
              })),
            }
          : done;
      // Both sides are marked as an undo, so a card type's left-out statuses never refuse putting a change back.
      callbacks.current.pushUndo({
        undo: () => {
          for (const back of undoes) void send(asUndoWrite(back));
        },
        redo: () => void send(asUndoWrite(redo)),
      });
      return result.ok;
    },
    [send, callbacks],
  );

  const writeQuiet = useCallback(
    async (input: ItemWrite, opts?: { silent?: boolean }): Promise<boolean> =>
      (await send(withCreateIds(input), opts?.silent)).ok,
    [send],
  );

  const items = useMemo(() => new Map(store.items.map((i) => [i.id, i])), [store.items]);

  return { store, items, status, self, write, writeQuiet, receive, refetch, ownerId, scope };
}
