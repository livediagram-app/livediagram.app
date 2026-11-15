import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef } from 'react';
import type {
  LastSeenFollower,
  LastSeenItem,
  LastSeenLanding,
  LastSeenTab,
} from '../../lib/api/last-seen-follower';

// The open item's last seen copy keeps up with it (each product's docs/specs/006-*/offline-mode.md "Warm open of a
// cloud document", livediagram's blueprints/last-seen-copy.md "Follow"): the name and the tab list each time they
// change, the first tab each time a save of it lands (`onSaveLanded`, handed to the autosave), and a copy whose item
// went to This Browser is forgotten. The follower decides what is written and when; this hook only tells it.

// What separates one tab list from another for the copy: each tab's id, name and folder, in order. Built once per
// `tabs` change, so an edit inside a tab costs one pass over the tab list, never over its elements.
const listSignature = (tabs: readonly LastSeenTab[]): string =>
  tabs.map((t) => `${t.id}\u0000${t.name}\u0000${t.folder ?? ''}`).join('\u0001');

export function useLastSeenFollow<Item extends LastSeenItem>({
  follower,
  reader,
  itemId,
  following,
  serverStored,
  hydrated,
  name,
  tabs,
}: {
  follower: Pick<LastSeenFollower<Item>, 'follows' | 'followMeta' | 'followSave' | 'forget'>;
  reader: string;
  itemId: string | null;
  // Hydrated, server stored, not an embed and not a workbench: the editor's own gate on top of the follower's.
  following: boolean;
  serverStored: boolean;
  hydrated: boolean;
  name: string;
  tabs: readonly LastSeenTab[];
}): { onSaveLanded: (landing: LastSeenLanding<LastSeenTab>) => void } {
  const signature = useMemo(() => listSignature(tabs), [tabs]);
  // Reads this render's tabs; only the name and the signature re-run it, never an edit inside a tab.
  const followMeta = useEffectEvent((id: string) =>
    follower.followMeta(reader, id, { name, tabs }),
  );
  useEffect(() => {
    if (following && itemId) followMeta(itemId);
  }, [following, reader, itemId, name, signature]);

  // Taken offline in place: a This Browser item keeps no copy.
  useEffect(() => {
    if (!hydrated || serverStored || !itemId || !follower.follows(reader, itemId)) return;
    void follower.forget(reader, itemId);
  }, [follower, hydrated, serverStored, reader, itemId]);

  const latest = useRef({ following, reader, itemId });
  useLayoutEffect(() => {
    latest.current = { following, reader, itemId };
  }, [following, reader, itemId]);
  const onSaveLanded = useCallback(
    (landing: LastSeenLanding<LastSeenTab>) => {
      const now = latest.current;
      if (now.following && now.itemId) follower.followSave(now.reader, now.itemId, landing);
    },
    [follower],
  );
  return { onSaveLanded };
}
