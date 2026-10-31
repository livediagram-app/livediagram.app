'use client';

// The open card's history (docs/specs/026-plan/items.md "History", blueprint item-store.md "History"): read when its
// panel shows activity, and again, after a short pause, whenever the card changes (its `rev` moves: someone's write,
// or yours). An answer for a card no longer shown is dropped. A This Browser plan keeps none ('offline').

import { useEffect, useRef, useState } from 'react';
import type { ItemHistoryEntry } from '@liveplanner/items';
import { fetchItemHistory } from '@/lib/api/item-history';
import type { ItemsScope } from '@/lib/api/items';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

// A burst of writes to the card (a drag, a run of field edits) reads its history once.
export const ITEM_HISTORY_REFETCH_MS = 400;

export type CardHistoryStatus = 'idle' | 'loading' | 'ready' | 'error' | 'offline';

export type CardHistory = {
  status: CardHistoryStatus;
  entries: readonly ItemHistoryEntry[];
  retry: () => void;
};

const NONE: readonly ItemHistoryEntry[] = [];

export function useCardHistory(opts: {
  scope: ItemsScope | null;
  itemId: string;
  rev: number;
  enabled: boolean;
}): CardHistory {
  const { scope, itemId, rev, enabled } = opts;
  const [state, setState] = useState<{
    status: CardHistoryStatus;
    entries: readonly ItemHistoryEntry[];
  }>({ status: 'idle', entries: NONE });
  const [attempt, setAttempt] = useState(0);
  // Whether this card's history has been read once: the first read goes at once, later ones after the pause.
  const readFor = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !scope) return;
    let live = true;
    const first = readFor.current !== itemId;
    const read = () => {
      readFor.current = itemId;
      if (first) setState((s) => (s.status === 'ready' ? s : { status: 'loading', entries: NONE }));
      fetchItemHistory(scope, itemId).then(
        (answer) => {
          if (!live) return;
          setState(
            answer === 'offline'
              ? { status: 'offline', entries: NONE }
              : { status: 'ready', entries: answer },
          );
        },
        (error: unknown) => {
          if (!live) return;
          debugLog('[items] items.history.failed', { error: String(error) });
          setState((s) => (s.status === 'ready' ? s : { status: 'error', entries: NONE }));
        },
      );
    };
    const timer = first ? null : setTimeout(read, ITEM_HISTORY_REFETCH_MS);
    if (first) read();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, scope, itemId, rev, attempt]);

  return {
    status: enabled && scope ? state.status : 'idle',
    entries: enabled && scope ? state.entries : NONE,
    retry: () => {
      readFor.current = null;
      setAttempt((n) => n + 1);
    },
  };
}
