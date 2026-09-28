'use client';

// The editor's deleted state (docs/specs/013-workspace/trash.md, "While a
// diagram is in the Trash"). Set when the load answers diagram_trashed, when
// the room says the diagram was trashed, or when a save is refused because
// of it. Whether the reader may restore it is read from their own Trash: the
// row is there exactly when they may (owner, or a joined team member), and
// never for a share-link visitor.
import { useCallback, useEffect, useState } from 'react';
import type { TrashedDiagram } from '@livediagram/api-schema';
import { apiListTrash, apiRestoreDiagram } from '@/lib/api-client';
import { track } from '@/lib/telemetry';

export type DiagramTrashedState = {
  trashed: boolean;
  setDiagramTrashed: (trashed: boolean) => void;
  // The reader's Trash row for this diagram, or null when they may not
  // restore it (or it hasn't been looked up yet).
  restorable: TrashedDiagram | null;
  restore: () => Promise<void>;
};

export function useDiagramTrashed(opts: {
  ownerId: string | null;
  diagramId: string | null;
  // A share-link session never looks: a visitor holds no Trash for it.
  viaShareLink: boolean;
}): DiagramTrashedState {
  const { ownerId, diagramId, viaShareLink } = opts;
  const [trashed, setTrashed] = useState(false);
  const [restorable, setRestorable] = useState<TrashedDiagram | null>(null);
  // Which Trash it sits in, for the telemetry `type`.
  const [from, setFrom] = useState<'Personal' | 'Team' | 'Local'>('Personal');

  const setDiagramTrashed = useCallback((next: boolean) => {
    if (next) console.info('[trash] open diagram is in the Trash');
    setTrashed(next);
  }, []);

  useEffect(() => {
    if (!trashed || viaShareLink || !ownerId || !diagramId) return;
    let live = true;
    void apiListTrash(ownerId).then((listing) => {
      if (!live) return;
      const local = listing.local.find((r) => r.id === diagramId);
      const cloud = listing.cloud?.find((r) => r.id === diagramId);
      setRestorable(local ?? cloud ?? null);
      setFrom(local ? 'Local' : cloud?.teamId ? 'Team' : 'Personal');
    });
    return () => {
      live = false;
    };
  }, [trashed, viaShareLink, ownerId, diagramId]);

  const restore = useCallback(async () => {
    if (!ownerId || !diagramId || !restorable) return;
    await apiRestoreDiagram(ownerId, diagramId);
    track('Trash', 'Restored', from);
    // Reopen it from scratch: a fresh load is the one path that hydrates
    // everything a live diagram has.
    window.location.reload();
  }, [ownerId, diagramId, restorable, from]);

  return { trashed, setDiagramTrashed, restorable, restore };
}
