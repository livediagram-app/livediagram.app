'use client';

// What the Snapshots dialog reads and does (liveworkspace/docs/specs/014-snapshots/snapshots.md "In the editor";
// blueprint SN25): the list, fetched when the dialog opens; one action at a time, its kind and target kept so its
// button says it is busy and the rest wait; a refusal's message. A revert ends with the page reloading (the room's
// close reaches this editor too), so its success only says so until then. React drops a state change on an unmounted
// dialog, so only the list's fetch, which can land after a close and a reopen, checks it is still live.

import { workbench } from '@liveworkspace/workbench/bindings';
import { useCallback, useEffect, useRef, useState } from 'react';
import { reloadAfterRevert, SnapshotsApiError, type SnapshotsApi } from '../client';
import type { SnapshotRetentionInfo, SnapshotSummary } from '../wire';

export type SnapshotBusy =
  { kind: 'take' } | { kind: 'revert'; id: string } | { kind: 'delete'; id: string } | null;

export type SnapshotsState = {
  snapshots: SnapshotSummary[] | null;
  kept: number;
  /** With Pro on: what the item's owner's tier keeps, as the server answered it. Null with Pro off. */
  retention: SnapshotRetentionInfo | null;
  error: string | null;
  /** The list's own fetch failed: the dialog says so with Try Again rather than an empty list. */
  listFailed: boolean;
  retry: () => void;
  busy: SnapshotBusy;
  reverted: boolean;
  take: (name: string) => Promise<boolean>;
  revert: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const messageOf = (err: unknown) =>
  err instanceof SnapshotsApiError ? err.message : 'Something went wrong. Try again.';

export function useSnapshots(
  api: SnapshotsApi,
  reload: () => void = reloadAfterRevert,
): SnapshotsState {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[] | null>(null);
  const [kept, setKept] = useState(5);
  const [retention, setRetention] = useState<SnapshotRetentionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [busy, setBusy] = useState<SnapshotBusy>(null);
  const [reverted, setReverted] = useState(false);
  const live = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const list = await api.list();
      if (!live.current) return;
      setSnapshots(list.snapshots);
      setKept(list.kept);
      setRetention(list.retention ?? null);
      setListFailed(false);
    } catch {
      if (!live.current) return;
      setSnapshots((prev) => prev ?? []);
      setListFailed(true);
    }
  }, [api]);

  useEffect(() => {
    live.current = true;
    void refresh();
    return () => {
      live.current = false;
    };
  }, [refresh]);

  const run = useCallback(
    async (next: Exclude<SnapshotBusy, null>, work: () => Promise<void>): Promise<boolean> => {
      setBusy(next);
      setError(null);
      try {
        await work();
        return true;
      } catch (err) {
        setError(messageOf(err));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const take = useCallback(
    (name: string) =>
      run({ kind: 'take' }, async () => {
        await api.take(name);
        // Counted once the api took it (docs/specs/014-snapshots/snapshots.md "Telemetry"): no name, id or size.
        workbench.track('Snapshot', 'Created');
        await refresh();
      }),
    [api, refresh, run],
  );

  const remove = useCallback(
    async (id: string) => {
      await run({ kind: 'delete', id }, async () => {
        await api.remove(id);
        workbench.track('Snapshot', 'Deleted');
        setSnapshots((prev) => (prev ?? []).filter((s) => s.id !== id));
      });
    },
    [api, run],
  );

  const revert = useCallback(
    async (id: string) => {
      await run({ kind: 'revert', id }, async () => {
        await api.revert(id);
        workbench.track('Snapshot', 'Reverted');
        setReverted(true);
        // The room closes this editor's socket too; reloading here covers a socket that was already down.
        reload();
      });
    },
    [api, reload, run],
  );

  const retry = useCallback(() => {
    setListFailed(false);
    setSnapshots(null);
    void refresh();
  }, [refresh]);

  return {
    snapshots,
    kept,
    retention,
    error,
    listFailed,
    retry,
    busy,
    reverted,
    take,
    revert,
    remove,
  };
}
