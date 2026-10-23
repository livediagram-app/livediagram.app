'use client';

// The editor's deleted state (docs/specs/013-workspace/trash.md, "While a
// design is in the Trash"). Set when the load answers design_trashed, when
// the room says the design was trashed, or when a save is refused because
// of it. Whether the reader may restore it is the index's answer
// (liveworkspace/docs/one-explorer-contracts.md): the item, which outlives the trashing, at edit for them (its owner,
// or a member of the team that owns it), and never for a share-link visitor.
import { useCallback, useEffect, useState } from 'react';
import type { TrashedDesign } from '@/components/chrome/DesignTrashedCard';
import { indexClient } from '@/lib/index-client';
import { track } from '@/lib/telemetry';
import { debugLog } from '@/lib/debug-log';
import { isDesignDeleted } from '@/lib/design-tombstones';

type DesignTrashedState = {
  trashed: boolean;
  setDesignTrashed: (trashed: boolean) => void;
  // When and why it went to the Trash, or null when the reader may not
  // restore it (or it hasn't been looked up yet).
  restorable: TrashedDesign | null;
  restore: () => Promise<void>;
};

export function useDesignTrashed(opts: {
  designId: string | null;
  // A share-link session never looks: a visitor holds no Trash for it.
  viaShareLink: boolean;
}): DesignTrashedState {
  const { designId, viaShareLink } = opts;
  const [trashed, setTrashed] = useState(false);
  const [restorable, setRestorable] = useState<TrashedDesign | null>(null);
  // Which Trash it sits in, for the telemetry `type`.
  const [from, setFrom] = useState<'Personal' | 'Team'>('Personal');

  const setDesignTrashed = useCallback(
    (next: boolean) => {
      // Deleted from this page (the Explorer's delete of the open design): it is already on its way to the
      // Explorer, so the room's echo of the delete must not flash the deleted page first.
      if (next && designId && isDesignDeleted(designId)) {
        debugLog('[trash] own delete, leaving for the Explorer');
        return;
      }
      if (next) debugLog('[trash] open design is in the Trash');
      setTrashed(next);
    },
    [designId],
  );

  useEffect(() => {
    if (!trashed || viaShareLink || !designId) return;
    let live = true;
    indexClient
      .getItem(designId)
      .then(({ item }) => {
        if (!live || item.trashedAt === null || item.access !== 'edit') return;
        setRestorable({ trashedAt: item.trashedAt, reason: item.trashReason });
        setFrom(item.teamId ? 'Team' : 'Personal');
      })
      // Not the reader's to restore, or the index unreachable: the card says it was deleted.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [trashed, viaShareLink, designId]);

  const restore = useCallback(async () => {
    if (!designId || !restorable) return;
    await indexClient.restoreItem(designId);
    track('Trash', 'Restored', from);
    // Reopen it from scratch: a fresh load is the one path that hydrates
    // everything a live design has.
    window.location.reload();
  }, [designId, restorable, from]);

  return { trashed, setDesignTrashed, restorable, restore };
}
