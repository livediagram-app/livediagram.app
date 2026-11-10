'use client';

// What the Archived view's address asks of one archived document (one-explorer.md "Archived"): `?move=<id>`, from an
// editor's archived card, opens Change Folder on it; `?open=<id>`, from a Search panel's result, opens its archived
// dialog. Once, after the list is in, and taken out of the address so a reload or Back never asks again. An id that
// is no archived document of the person's (moved out since, another person's) asks nothing.

import { useEffect, useRef } from 'react';
import type { Item } from '@liveworkspace/index-client';
import type { ThisBrowserItem } from '../this-browser';
import { useExplorer } from './context';

export const ARCHIVED_MOVE_PARAM = 'move';
export const ARCHIVED_OPEN_PARAM = 'open';

/** The Archived view's address asking for `what` on `id`. */
export function archivedAskHref(base: string, what: 'move' | 'open', id: string): string {
  return `${base}?${new URLSearchParams({ [what === 'move' ? ARCHIVED_MOVE_PARAM : ARCHIVED_OPEN_PARAM]: id })}`;
}

function readAsk(): { what: 'move' | 'open'; id: string } | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const move = params.get(ARCHIVED_MOVE_PARAM);
  if (move) return { what: 'move', id: move };
  const open = params.get(ARCHIVED_OPEN_PARAM);
  return open ? { what: 'open', id: open } : null;
}

function dropAsk(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(ARCHIVED_MOVE_PARAM);
  url.searchParams.delete(ARCHIVED_OPEN_PARAM);
  // null, never history.state: Next skips its own state, which would leave useSearchParams stale (next-config/history-state.test.js).
  window.history.replaceState(null, '', url);
}

export function useArchivedAsk(
  active: boolean,
  items: readonly Item[],
  local: readonly ThisBrowserItem[],
  loading: boolean,
): void {
  const { client, openDialog } = useExplorer();
  const asked = useRef(false);
  useEffect(() => {
    if (!active || loading || asked.current) return;
    const ask = readAsk();
    if (!ask) return;
    asked.current = true;
    dropAsk();
    const kept = local.find((i) => i.id === ask.id);
    if (kept) {
      openDialog(
        ask.what === 'move'
          ? { kind: 'move-local', item: kept }
          : { kind: 'archived-local', item: kept },
      );
      return;
    }
    const open = (item: Item) =>
      openDialog(ask.what === 'move' ? { kind: 'move-item', item } : { kind: 'archived', item });
    const listed = items.find((i) => i.id === ask.id);
    if (listed) return open(listed);
    // Past the first page: asked of the index, and only an archived one.
    void client.getItem(ask.id).then(
      ({ item }) => {
        if (item.archivedAt) open(item);
      },
      () => {},
    );
  }, [active, loading, items, local, client, openDialog]);
}
