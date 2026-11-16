// What a plan's last seen copy follows beyond the shared follow (docs/specs/006-project/offline-mode.md "Warm open of a
// cloud project", blueprints/last-seen-copy.md "Follow"): the cards on each change of the store, and the first tab's
// sheets on each read of them. Nothing is followed while practice cards are on the board (they are this screen's
// alone), nor for a plan the open kept no copy of (the follower ignores another reader or plan).
import { useCallback, useEffect } from 'react';
import type { ItemStoreState } from '@liveplanner/items';
import type { SheetJson } from '@liveplanner/sheets';
import { firstTabToLoad } from '@liveworkspace/workbench/lib/tab-scope';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { lastSeenCopies } from '@/lib/last-seen';
import { cardsForCopy, sheetsForCopy } from '@/lib/last-seen-plan';

type Follower = Pick<typeof lastSeenCopies, 'followItem'>;

export function usePlanCopyFollow(opts: {
  reader: string;
  projectId: string | null;
  // As the shared follow's: a hydrated cloud plan, never an embed or a workbench.
  following: boolean;
  // Whether the store holds the server's cards yet (a warm store is the copy's own, never followed back).
  loaded: boolean;
  store: ItemStoreState;
  practiceCount: number;
  tabs: readonly { id: string }[];
  tabScope: string | null;
  follower?: Follower;
}): { onSheetsRead: (tabId: string, sheets: readonly SheetJson[]) => void } {
  const { reader, projectId, following, loaded, store, practiceCount } = opts;
  const follower = opts.follower ?? lastSeenCopies;
  useEffect(() => {
    if (!following || !loaded || !projectId || practiceCount > 0) return;
    follower.followItem(reader, projectId, { cards: cardsForCopy(store) });
  }, [following, loaded, projectId, practiceCount, reader, store, follower]);
  const latest = useLatest({ ...opts, follower });
  const onSheetsRead = useCallback(
    (tabId: string, sheets: readonly SheetJson[]) => {
      const o = latest.current;
      if (!o.following || !o.projectId) return;
      if (tabId !== firstTabToLoad(o.tabs, o.tabScope)) return;
      o.follower.followItem(o.reader, o.projectId, { sheets: sheetsForCopy(tabId, sheets) });
    },
    [latest],
  );
  return { onSheetsRead };
}
