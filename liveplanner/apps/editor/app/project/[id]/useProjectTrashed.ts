'use client';

// The editor's deleted state (docs/specs/013-workspace/trash.md, "While a
// project is in the Trash"). Set when the load answers project_trashed, when
// the room says the project was trashed, or when a save is refused because
// of it. Whether the reader may restore it is read from their own Trash: the
// row is there exactly when they may (owner, or a joined team member), and
// never for a share-link visitor.
import { useCallback, useEffect, useState } from 'react';
import type { TrashedProject } from '@liveplanner/api-schema';
import { apiListTrash, apiRestoreProject } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { debugLog } from '@/lib/debug-log';
import { isProjectDeleted } from '@/lib/project-tombstones';

type ProjectTrashedState = {
  trashed: boolean;
  setProjectTrashed: (trashed: boolean) => void;
  // The reader's Trash row for this project, or null when they may not
  // restore it (or it hasn't been looked up yet).
  restorable: TrashedProject | null;
  restore: () => Promise<void>;
};

export function useProjectTrashed(opts: {
  ownerId: string | null;
  projectId: string | null;
  // A share-link session never looks: a visitor holds no Trash for it.
  viaShareLink: boolean;
}): ProjectTrashedState {
  const { ownerId, projectId, viaShareLink } = opts;
  const [trashed, setTrashed] = useState(false);
  const [restorable, setRestorable] = useState<TrashedProject | null>(null);
  // Which Trash it sits in, for the telemetry `type`.
  const [from, setFrom] = useState<'Personal' | 'Team' | 'Local'>('Personal');

  const setProjectTrashed = useCallback(
    (next: boolean) => {
      // Deleted from this page (the Explorer's delete of the open project): it is already on its way to the
      // Explorer, so the room's echo of the delete must not flash the deleted page first.
      if (next && projectId && isProjectDeleted(projectId)) {
        debugLog('[trash] own delete, leaving for the Explorer');
        return;
      }
      if (next) debugLog('[trash] open project is in the Trash');
      setTrashed(next);
    },
    [projectId],
  );

  useEffect(() => {
    if (!trashed || viaShareLink || !ownerId || !projectId) return;
    let live = true;
    void apiListTrash(ownerId).then((listing) => {
      if (!live) return;
      const local = listing.local.find((r) => r.id === projectId);
      const cloud = listing.cloud?.find((r) => r.id === projectId);
      setRestorable(local ?? cloud ?? null);
      setFrom(local ? 'Local' : cloud?.teamId ? 'Team' : 'Personal');
    });
    return () => {
      live = false;
    };
  }, [trashed, viaShareLink, ownerId, projectId]);

  const restore = useCallback(async () => {
    if (!ownerId || !projectId || !restorable) return;
    await apiRestoreProject(ownerId, projectId);
    track('Trash', 'Restored', from);
    // Reopen it from scratch: a fresh load is the one path that hydrates
    // everything a live project has.
    window.location.reload();
  }, [ownerId, projectId, restorable, from]);

  return { trashed, setProjectTrashed, restorable, restore };
}
