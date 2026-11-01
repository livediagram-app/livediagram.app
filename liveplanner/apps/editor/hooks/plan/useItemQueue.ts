'use client';

// The item store's waiting changes (docs/specs/007-editor/offline-changes.md; blueprint offline-changes.md "Cards"):
// when they are sent (the connection back, the room rejoined, a doubling wait while the browser says it is online,
// the board's first load), one replay at a time, and the board read again once a replay sent anything.
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  applyItemWrite,
  type ItemPerson,
  type ItemStoreState,
  type ItemWrite,
} from '@liveplanner/items';
import { getOnline } from '@liveworkspace/workbench/lib/online-status';
import { useAssignRef, useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { ItemWriteAnswer } from '@/lib/api/items';
import { replayItemQueue } from '@/lib/offline-queue/item-replay';
import type { PlanQueue, QueuedChange } from '@/lib/offline-queue/plan-queue';
import { onReconnect, retryDelayMs } from '@/lib/offline-queue/reconnect';

// The waiting card changes laid over a store read from the server, so what waits stays shown (spec "What the person
// sees"). A change that no longer applies (its card gone) is left out; its replay settles it.
export function withWaitingItems(
  state: ItemStoreState,
  queue: PlanQueue | null,
  by: ItemPerson,
  now = Date.now(),
): ItemStoreState {
  if (!queue || queue.count('items') === 0) return state;
  let next = state;
  for (const change of queue.changes('items') as Extract<QueuedChange, { store: 'items' }>[]) {
    const r = applyItemWrite(next, change.write, { now, by });
    if (r.ok) next = r.state;
  }
  return next;
}

export function useItemQueue(opts: {
  queueOf: () => PlanQueue | null;
  send: (write: ItemWrite) => Promise<ItemWriteAnswer>;
  landed: (answer: ItemWriteAnswer) => void;
  refused: (write: ItemWrite, e: unknown) => void;
  load: () => Promise<void>;
  // Read again from the server (debounced), when nothing waits.
  refetch: () => void;
  // The board has loaded: what a reload kept is sent now.
  loaded: boolean;
}): { kick: () => void } {
  const latest = useLatest(opts);
  const flushingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  // The replay, as the retry timer calls it.
  const flushRef = useRef<() => void>(() => {});

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const flush = useCallback((): void => {
    const o = latest.current;
    const queue = o.queueOf();
    if (flushingRef.current || !queue || queue.count('items') === 0) return;
    flushingRef.current = true;
    clearTimer();
    void replayItemQueue({ queue, send: o.send, landed: o.landed, refused: o.refused })
      .then(({ outcome, sent }) => {
        debugLog('[offline-queue] items.replay', { outcome, sent });
        flushingRef.current = false;
        if (outcome === 'done') {
          attemptRef.current = 0;
          void latest.current.load();
          return;
        }
        // No answer: try again after a doubling wait while the browser says it is online; offline, the `online`
        // event brings it back.
        if (!getOnline()) return;
        timerRef.current = setTimeout(() => flushRef.current(), retryDelayMs(attemptRef.current++));
      })
      .catch((e: unknown) => {
        flushingRef.current = false;
        console.warn('[offline-queue] items.replay-failed', { error: String(e) });
      });
  }, [latest]);
  useAssignRef(flushRef, flush);

  // A change joined the queue: online, send it now (a replay already running takes it on its way).
  const kick = useCallback(() => {
    if (getOnline() && !timerRef.current) flush();
  }, [flush]);

  // The connection may be back: send what waits, or, with nothing waiting, read the board again (a room connection
  // that outlived an outage brings nothing on its own).
  useEffect(
    () =>
      onReconnect(() => {
        attemptRef.current = 0;
        clearTimer();
        const queue = latest.current.queueOf();
        if (queue && queue.count('items') > 0) flush();
        else latest.current.refetch();
      }),
    [flush, latest],
  );

  useEffect(() => {
    if (opts.loaded) flush();
  }, [opts.loaded, flush]);

  useEffect(() => clearTimer, []);

  return useMemo(() => ({ kick }), [kick]);
}
