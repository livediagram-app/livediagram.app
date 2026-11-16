// What a plan's last seen copy follows beyond the shared follow (docs/specs/006-project/offline-mode.md "Warm open of a
// cloud project", blueprints/last-seen-copy.md "Follow"): the cards on each change of the store, the first tab's
// sheets on each read of them, and, for a Dashboard first tab, the tabs its tiles show once each has loaded (a Sheet's
// with its sheets as read). Nothing is followed while practice cards are on the board (they are this screen's alone),
// nor for a plan the open kept no copy of (the follower ignores another reader or plan).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ItemStoreState } from '@liveplanner/items';
import { tabKindOf, type Tab } from '@liveplanner/project';
import type { SheetJson } from '@liveplanner/sheets';
import { firstTabToLoad } from '@liveworkspace/workbench/lib/tab-scope';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { lastSeenCopies } from '@/lib/last-seen';
import {
  cardsForCopy,
  dashboardShownTabs,
  refsForCopy,
  sheetsForCopy,
  type KeptSheets,
} from '@/lib/last-seen-plan';

type Follower = Pick<typeof lastSeenCopies, 'followItem'>;

// What the shown tabs were last followed as: their objects and reads, compared by identity.
type Followed = { tabs: readonly Tab[]; sheets: readonly (KeptSheets | null)[] };
function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function usePlanCopyFollow(opts: {
  reader: string;
  projectId: string | null;
  // As the shared follow's: a hydrated cloud plan, never an embed or a workbench.
  following: boolean;
  // Whether the store holds the server's cards yet (a warm store is the copy's own, never followed back).
  loaded: boolean;
  store: ItemStoreState;
  practiceCount: number;
  tabs: readonly Tab[];
  // The tabs whose content has arrived: a Dashboard's shown tab is kept only once it has.
  loadedTabIds: ReadonlySet<string>;
  tabScope: string | null;
  follower?: Follower;
}): { onSheetsRead: (tabId: string, sheets: readonly SheetJson[]) => void } {
  const { reader, projectId, following, loaded, store, practiceCount, tabs, loadedTabIds } = opts;
  const follower = opts.follower ?? lastSeenCopies;
  useEffect(() => {
    if (!following || !loaded || !projectId || practiceCount > 0) return;
    follower.followItem(reader, projectId, { cards: cardsForCopy(store) });
  }, [following, loaded, projectId, practiceCount, reader, store, follower]);
  // The tabs a Dashboard first tab's tiles show, those still in the plan (a deleted one paints as deleted).
  const firstId = firstTabToLoad(tabs, opts.tabScope);
  const first = tabs.find((t) => t.id === firstId);
  const shownKey = first
    ? dashboardShownTabs(first)
        .filter((id) => tabs.some((t) => t.id === id))
        .join(',')
    : '';
  const shown = useMemo(() => (shownKey ? shownKey.split(',') : []), [shownKey]);
  // Each shown Sheet tab's last read, as the copy would keep it (null past its cap).
  const [shownReads, setShownReads] = useState<ReadonlyMap<string, KeptSheets | null>>(
    () => new Map(),
  );
  const followedRef = useRef<Followed | null>(null);
  useEffect(() => {
    if (!following || !projectId || shown.length === 0) return;
    const shownTabs: Tab[] = [];
    const reads: (KeptSheets | null)[] = [];
    for (const id of shown) {
      const tab = tabs.find((t) => t.id === id);
      if (!tab || !loadedTabIds.has(id)) return;
      if (tabKindOf(tab) === 'sheet') {
        if (!shownReads.has(id)) return;
        reads.push(shownReads.get(id) ?? null);
      }
      shownTabs.push(tab);
    }
    // Only a change to a shown tab or its read refreshes: another tab's edit costs these comparisons and no write.
    const last = followedRef.current;
    if (last && sameItems(last.tabs, shownTabs) && sameItems(last.sheets, reads)) return;
    followedRef.current = { tabs: shownTabs, sheets: reads };
    follower.followItem(reader, projectId, { refs: refsForCopy(shownTabs, reads) });
  }, [following, projectId, shown, tabs, loadedTabIds, shownReads, reader, follower]);
  const latest = useLatest({ ...opts, follower, shown });
  const onSheetsRead = useCallback(
    (tabId: string, sheets: readonly SheetJson[]) => {
      const o = latest.current;
      if (!o.following || !o.projectId) return;
      if (o.shown.includes(tabId)) {
        const kept = sheetsForCopy(tabId, sheets);
        setShownReads((prev) => new Map(prev).set(tabId, kept));
      }
      if (tabId !== firstTabToLoad(o.tabs, o.tabScope)) return;
      o.follower.followItem(o.reader, o.projectId, { sheets: sheetsForCopy(tabId, sheets) });
    },
    [latest],
  );
  return { onSheetsRead };
}
