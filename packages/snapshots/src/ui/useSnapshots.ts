'use client';

// What the Snapshots dialog reads and does (liveworkspace/docs/specs/014-snapshots/snapshots.md "In the editor";
// blueprint SN25): the list, fetched when the dialog opens; one action at a time, its kind and target kept so its
// button says it is busy and the rest wait; a refusal's message. A revert ends with the page reloading (the room's
// close reaches this editor too), so its success only says so until then. React drops a state change on an unmounted
// dialog, so only the list's fetch, which can land after a close and a reopen, checks it is still live.

import { workbench } from '@liveworkspace/workbench/bindings';
import {
  errorMessage,
  errorWords,
  whenBackOnline,
  type ErrorWords,
} from '@liveworkspace/ui/error-words';
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
  /**
   * Why the list failed, in words (error-words.md): Try Again only where it can help, and an offline list loads again
   * by itself once the browser is back online.
   */
  listError: ErrorWords | null;
  retry: () => void;
  busy: SnapshotBusy;
  reverted: boolean;
  take: (name: string) => Promise<boolean>;
  revert: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const messageOf = (err: unknown) =>
  err instanceof SnapshotsApiError ? err.message : errorMessage(err);

export function useSnapshots(
  api: SnapshotsApi,
  reload: () => void = reloadAfterRevert,
): SnapshotsState {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[] | null>(null);
  const [kept, setKept] = useState(5);
  const [retention, setRetention] = useState<SnapshotRetentionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<ErrorWords | null>(null);
  const listFailed = listError !== null;
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
      setListError(null);
    } catch (err) {
      if (!live.current) return;
      setSnapshots((prev) => prev ?? []);
      const words = errorWords(err, { retriesItself: true });
      // The server's own words for its refusal, where it gave some.
      setListError(err instanceof SnapshotsApiError ? { ...words, message: err.message } : words);
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
    setListError(null);
    setSnapshots(null);
    void refresh();
  }, [refresh]);

  // Offline: the list loads again by itself once the browser is back online.
  const offline = listError?.kind === 'offline';
  useEffect(() => (offline ? whenBackOnline(retry) : undefined), [offline, retry]);

  return {
    snapshots,
    kept,
    retention,
    error,
    listFailed,
    listError,
    retry,
    busy,
    reverted,
    take,
    revert,
    remove,
  };
}
