'use client';

// The editor's deleted state (docs/specs/013-workspace/trash.md, "While a
// design is in the Trash"). Set when the load answers design_trashed, when
// the room says the design was trashed, or when a save is refused because
// of it. Whether the reader may restore it is read from their own Trash: the
// row is there exactly when they may (owner, or a joined team member), and
// never for a share-link visitor.
import { useCallback, useEffect, useState } from 'react';
import type { TrashedDesign } from '@livedesign/api-schema';
import { apiListTrash, apiRestoreDesign } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { debugLog } from '@/lib/debug-log';
import { isDesignDeleted } from '@/lib/design-tombstones';

type DesignTrashedState = {
  trashed: boolean;
  setDesignTrashed: (trashed: boolean) => void;
  // The reader's Trash row for this design, or null when they may not
  // restore it (or it hasn't been looked up yet).
  restorable: TrashedDesign | null;
  restore: () => Promise<void>;
};

export function useDesignTrashed(opts: {
  ownerId: string | null;
  designId: string | null;
  // A share-link session never looks: a visitor holds no Trash for it.
  viaShareLink: boolean;
}): DesignTrashedState {
  const { ownerId, designId, viaShareLink } = opts;
  const [trashed, setTrashed] = useState(false);
  const [restorable, setRestorable] = useState<TrashedDesign | null>(null);
  // Which Trash it sits in, for the telemetry `type`.
  const [from, setFrom] = useState<'Personal' | 'Team' | 'Local'>('Personal');

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
    if (!trashed || viaShareLink || !ownerId || !designId) return;
    let live = true;
    void apiListTrash(ownerId).then((listing) => {
      if (!live) return;
      const local = listing.local.find((r) => r.id === designId);
      const cloud = listing.cloud?.find((r) => r.id === designId);
      setRestorable(local ?? cloud ?? null);
      setFrom(local ? 'Local' : cloud?.teamId ? 'Team' : 'Personal');
    });
    return () => {
      live = false;
    };
  }, [trashed, viaShareLink, ownerId, designId]);

  const restore = useCallback(async () => {
    if (!ownerId || !designId || !restorable) return;
    await apiRestoreDesign(ownerId, designId);
    track('Trash', 'Restored', from);
    // Reopen it from scratch: a fresh load is the one path that hydrates
    // everything a live design has.
    window.location.reload();
  }, [ownerId, designId, restorable, from]);

  return { trashed, setDesignTrashed, restorable, restore };
}
