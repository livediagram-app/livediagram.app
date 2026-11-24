'use client';

// Home's New (liveworkspace/docs/specs/004-index/one-explorer.md "New, on Home"): the four items made most recently in the
// person's own space and their teams' (in this app, or every app under All Apps), newest first, so something just made
// and never opened (an AI tool's batch over MCP, which leaves Recent alone) is one look away. They lead Home's timeline
// (HomeTimeline), each marked as made. This browser's own items are merged in by the same rule. Its read rides on Home's
// one items read (`newest`, data/homeReads.ts), so it costs no request; with nothing made yet, or a failed read, the
// timeline holds Recent's alone.

import { useMemo } from 'react';
import type { ShownItem } from '../data/overlay';
import { useItemList } from '../data/useItemList';
import { HOME_NEW, newestLoader } from '../data/viewLists';
import type { ThisBrowserItem } from '../this-browser';
import { useExplorer } from './context';
import { useThisBrowserItems } from './ThisBrowser';

// Live, and not archived here since the read: what New may still show.
const stillNew = (i: ShownItem) => i.trashedAt === null && !i.archivedAt;

/** New's merge: the index's and this browser's together, the most recently made first, at most `max`. */
export function mergeMade<T extends { createdAt: number }>(
  made: readonly T[],
  local: readonly ThisBrowserItem[],
  max: number,
): (T | ThisBrowserItem)[] {
  if (local.length === 0) return made.slice(0, max);
  return [...made, ...local].sort((a, b) => b.createdAt - a.createdAt).slice(0, max);
}

/** What New shows: the index's newest and this browser's, merged. HomePane reads it so Most Used and Recent leave it out. */
export type HomeNewState = {
  loading: boolean;
  error: unknown;
  shown: (ShownItem | ThisBrowserItem)[];
};

/** New's read and merge, held by HomePane: Most Used and Recent leave out what it shows (one-explorer.md "Each item shows once"). */
export function useHomeNew(): HomeNewState {
  const { client, app, filter, overlay, epoch } = useExplorer();
  const load = useMemo(() => newestLoader(client, app, filter), [client, app, filter]);
  const made = useItemList({
    key: `home-new:${filter}`,
    load,
    overlay,
    belongs: stillNew,
    cap: HOME_NEW,
    epoch,
  });
  const { live: local } = useThisBrowserItems();
  const shown = useMemo(() => mergeMade(made.items, local, HOME_NEW), [made.items, local]);
  return { loading: made.loading, error: made.error, shown };
}
