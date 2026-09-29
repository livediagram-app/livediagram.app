'use client';

// The Trash view's state and actions (docs/specs/013-workspace/trash.md):
// one listing over the cloud Trash and this browser's, and Restore / Delete
// permanently / Empty Trash with their telemetry and toasts. `onChanged` lets
// the host refresh the lists a restore puts a document back into.
import { useCallback, useEffect, useState } from 'react';
import {
  apiEmptyTrash,
  apiListTrash,
  apiPurgeDocument,
  apiRestoreDocument,
  type TrashListing,
} from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import type { TrashGroup } from '@/lib/trash-groups';
import type { useToast } from '@/hooks/ui/useToast';

export type TrashController = {
  listing: TrashListing | null;
  restore: (id: string, group: TrashGroup) => Promise<void>;
  purge: (id: string, group: TrashGroup) => Promise<void>;
  empty: (group: TrashGroup) => Promise<void>;
};

function without(listing: TrashListing, ids: Set<string>): TrashListing {
  return {
    cloud: listing.cloud?.filter((r) => !ids.has(r.id)) ?? null,
    local: listing.local.filter((r) => !ids.has(r.id)),
  };
}

export function useTrash(
  ownerId: string | null,
  toast: ReturnType<typeof useToast>,
  onChanged: () => void,
): TrashController {
  const [listing, setListing] = useState<TrashListing | null>(null);

  const apply = useCallback(
    (next: TrashListing) => {
      setListing(next);
      if (next.cloud === null)
        toast.error('Could not reach your Trash. Showing this browser only.');
    },
    [toast],
  );

  // Re-read after an action that failed, or that a teammate may have raced.
  const load = useCallback(() => {
    if (ownerId) void apiListTrash(ownerId).then(apply);
  }, [ownerId, apply]);

  useEffect(() => {
    if (!ownerId) return;
    let live = true;
    void apiListTrash(ownerId).then((next) => {
      if (live) apply(next);
    });
    return () => {
      live = false;
    };
  }, [ownerId, apply]);

  const drop = (ids: string[]) => setListing((prev) => (prev ? without(prev, new Set(ids)) : prev));

  const restore = useCallback(
    async (id: string, group: TrashGroup) => {
      if (!ownerId) return;
      try {
        await apiRestoreDocument(ownerId, id);
        drop([id]);
        track('Trash', 'Restored', group.telemetryType);
        toast.success('Document restored');
        onChanged();
      } catch {
        toast.error('Could not restore that document. Please try again.');
        load();
      }
    },
    [ownerId, toast, onChanged, load],
  );

  const purge = useCallback(
    async (id: string, group: TrashGroup) => {
      if (!ownerId) return;
      try {
        await apiPurgeDocument(ownerId, id);
        drop([id]);
        track('Trash', 'Deleted', group.telemetryType);
      } catch {
        toast.error('Could not delete that document. Please try again.');
        load();
      }
    },
    [ownerId, toast, load],
  );

  const empty = useCallback(
    async (group: TrashGroup) => {
      if (!ownerId) return;
      try {
        await apiEmptyTrash(ownerId, group.scope);
        drop(group.rows.map((r) => r.id));
        track('Trash', 'Cleared', group.telemetryType);
      } catch {
        toast.error('Could not empty the Trash. Please try again.');
      }
      // Re-read either way: a teammate may have binned something meanwhile.
      load();
    },
    [ownerId, toast, load],
  );

  return { listing, restore, purge, empty };
}
