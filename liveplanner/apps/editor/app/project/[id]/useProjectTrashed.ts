'use client';

// The editor's deleted state (docs/specs/013-workspace/trash.md, "While a
// project is in the Trash"). Set when the load answers project_trashed, when
// the room says the project was trashed, or when a save is refused because
// of it. Whether the reader may restore it is the index's answer
// (liveworkspace/docs/one-explorer-contracts.md): the item, which outlives the trashing, at edit for them (its owner,
// or a member of the team that owns it), and never for a share-link visitor.
import { useCallback, useEffect, useState } from 'react';
import type { TrashedPlan } from '@/components/chrome/ProjectTrashedCard';
import { indexClient } from '@/lib/index-client';
import { track } from '@/lib/telemetry';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { isProjectDeleted } from '@/lib/project-tombstones';

type ProjectTrashedState = {
  trashed: boolean;
  setProjectTrashed: (trashed: boolean) => void;
  // When and why it went to the Trash, or null when the reader may not
  // restore it (or it hasn't been looked up yet).
  restorable: TrashedPlan | null;
  restore: () => Promise<void>;
};

export function useProjectTrashed(opts: {
  projectId: string | null;
  // A share-link session never looks: a visitor holds no Trash for it.
  viaShareLink: boolean;
}): ProjectTrashedState {
  const { projectId, viaShareLink } = opts;
  const [trashed, setTrashed] = useState(false);
  const [restorable, setRestorable] = useState<TrashedPlan | null>(null);
  // Which Trash it sits in, for the telemetry `type`.
  const [from, setFrom] = useState<'Personal' | 'Team'>('Personal');

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
    if (!trashed || viaShareLink || !projectId) return;
    let live = true;
    indexClient
      .getItem(projectId)
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
  }, [trashed, viaShareLink, projectId]);

  const restore = useCallback(async () => {
    if (!projectId || !restorable) return;
    await indexClient.restoreItem(projectId);
    track('Trash', 'Restored', from);
    // Reopen it from scratch: a fresh load is the one path that hydrates
    // everything a live project has.
    window.location.reload();
  }, [projectId, restorable, from]);

  return { trashed, setProjectTrashed, restorable, restore };
}
