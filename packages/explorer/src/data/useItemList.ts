'use client';

// One Explorer list: the first page in one request, the next page only when the person scrolls near the end
// (LIST_PAGE a page, the index's maximum), a superseded request cancelled rather than left to land late, and
// the optimistic overlay laid over what came back. `belongs` says whether an item still belongs in the view
// once patched (a folder's list drops an item moved out; the Trash drops one restored), so a change shows at
// once and its rollback brings the row back.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Item } from '@liveworkspace/index-client';
import { LIST_LIMIT_MAX } from '@liveworkspace/index-client';
import type { ItemOverlay, ShownItem } from './overlay';
import { isAbort } from './errors';

export const LIST_PAGE = LIST_LIMIT_MAX;

export type ListPage = { items: Item[]; nextCursor: string | null };
export type ListLoader = (cursor: string | null, signal: AbortSignal) => Promise<ListPage>;

export type ItemListState = {
  items: ShownItem[];
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
};

type Loaded = {
  key: string;
  items: Item[];
  cursor: string | null;
  error: boolean;
  done: boolean;
};

export function useItemList({
  key,
  load,
  overlay,
  belongs,
  epoch = 0,
  enabled = true,
}: {
  // What the list is: a new key starts again from the first page.
  key: string;
  load: ListLoader;
  overlay: ItemOverlay;
  belongs?: (item: ShownItem) => boolean;
  // Bumped to reload every list (after a copy, a restore, a folder delete).
  epoch?: number;
  enabled?: boolean;
}): ItemListState {
  const fullKey = `${key}#${epoch}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const more = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    more.current?.abort();
    loadRef
      .current(null, controller.signal)
      .then((page) =>
        setLoaded({
          key: fullKey,
          items: page.items,
          cursor: page.nextCursor,
          error: false,
          done: page.nextCursor === null,
        }),
      )
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setLoaded({ key: fullKey, items: [], cursor: null, error: true, done: true });
      });
    return () => controller.abort();
  }, [fullKey, enabled, attempt]);

  useEffect(() => () => more.current?.abort(), []);

  const current = loaded?.key === fullKey ? loaded : null;

  const loadMore = useCallback(() => {
    if (!current || current.done || current.error || more.current) return;
    const controller = new AbortController();
    more.current = controller;
    setLoadingMore(true);
    loadRef
      .current(current.cursor, controller.signal)
      .then((page) => {
        setLoaded((prev) =>
          prev && prev.key === current.key
            ? {
                ...prev,
                // A row already listed (it changed while paging) is not listed twice.
                items: appendNew(prev.items, page.items),
                cursor: page.nextCursor,
                done: page.nextCursor === null,
              }
            : prev,
        );
      })
      .catch((error: unknown) => {
        if (!isAbort(error)) setLoaded((prev) => (prev ? { ...prev, done: true } : prev));
      })
      .finally(() => {
        if (more.current === controller) more.current = null;
        setLoadingMore(false);
      });
  }, [current]);

  const version = useSyncExternalStore(overlay.subscribe, overlay.version, overlay.version);
  const raw = current?.items;
  const items = useMemo(() => {
    if (!raw) return EMPTY;
    const out: ShownItem[] = [];
    for (const item of raw) {
      const shown = overlay.apply(item);
      if (shown.gone) continue;
      if (belongs && !belongs(shown)) continue;
      out.push(shown);
    }
    return out;
    // `version` re-runs the overlay when a patch lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, version, belongs, overlay]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return {
    items,
    loading: enabled && !current,
    loadingMore,
    error: current?.error ?? false,
    hasMore: current ? !current.done : false,
    loadMore,
    retry,
  };
}

const EMPTY: ShownItem[] = [];

function appendNew(have: Item[], next: Item[]): Item[] {
  const seen = new Set(have.map((i) => i.id));
  return [...have, ...next.filter((i) => !seen.has(i.id))];
}
