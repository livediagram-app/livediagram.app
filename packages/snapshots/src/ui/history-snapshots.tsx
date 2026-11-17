'use client';

// Snapshots inside History (owner, 2026-11-17; liveworkspace/docs/specs/014-snapshots/snapshots.md "In History";
// blueprint SN26): the footer's Tools has one row, History, and Snapshots live in it. For someone with the item's
// account history, Take Snapshot heads the timeline and each snapshot is an entry on its rail at the time it was
// taken, pinned (named, in the brand's tone), with Revert and Delete confirmed in place as in the dialog. For someone
// who may take snapshots but has no history to read (an Editor through a share link), History shows the snapshots on
// their own (SnapshotsDialog). The app's History host takes both from `useHistorySnapshotsHost`, so the workbench never
// imports this package.

import { lazy, Suspense, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { useSnapshotsDoor, type SnapshotsDoor } from './door';
import { SnapshotGlyph } from './glyphs';
import { SnapshotNotices, TakeSnapshotForm } from './snapshot-parts';
import { SnapshotRow, type RowConfirm } from './SnapshotRow';
import { useSnapshots } from './useSnapshots';

const SnapshotsDialog = lazy(() =>
  import('./SnapshotsDialog').then((m) => ({ default: m.SnapshotsDialog })),
);

/** One entry History lays on its rail among its own, newest first by `at`. */
export type HistoryPin = { key: string; at: number; render: (last: boolean) => ReactNode };
/** What a tool adds to History: a block over the timeline, and entries on it. */
export type HistoryExtras = { top?: ReactNode; pins: readonly HistoryPin[] };

/** The History host's view of Snapshots: the hook its timeline calls, and Snapshots on their own. */
export type HistorySnapshotsHost = {
  useExtras: () => HistoryExtras;
  Alone: ComponentType<{ onClose: () => void; after?: ReactNode }>;
};

/** Snapshots as History's top block and pins, for the open door. */
export function useSnapshotsExtras(door: SnapshotsDoor, now = Date.now): HistoryExtras {
  const state = useSnapshots(door.api);
  const [confirm, setConfirm] = useState<RowConfirm>(null);
  const [at] = useState(now);
  const working = state.busy !== null || state.reverted;
  const top = (
    <div data-history-snapshots="" className="flex flex-col gap-2">
      <TakeSnapshotForm state={state} className="" />
      <SnapshotNotices state={state} className="" />
    </div>
  );
  const pins: HistoryPin[] = (state.snapshots ?? []).map((snapshot) => ({
    key: `snapshot:${snapshot.id}`,
    at: snapshot.createdAt,
    render: (last) => (
      <li data-history-snapshot={snapshot.id} className="relative flex gap-3 pb-4">
        {last ? null : (
          <span
            aria-hidden
            className="absolute bottom-0 left-4 top-8 w-px bg-slate-200 dark:bg-slate-700/70"
          />
        )}
        {/* The pin: the camera on the brand's wash, ringed, so a save point stands out on the rail. */}
        <span
          aria-hidden
          className="relative z-[1] mt-1.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-4 ring-white dark:bg-brand-500/15 dark:text-brand-200 dark:ring-slate-900"
        >
          <SnapshotGlyph size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
            Snapshot
          </p>
          <SnapshotRow
            as="div"
            snapshot={snapshot}
            noun={door.noun}
            viewerId={door.viewerId}
            now={at}
            confirm={confirm?.id === snapshot.id ? confirm.kind : null}
            busy={state.busy}
            locked={working}
            onConfirm={(kind) => setConfirm(kind ? { id: snapshot.id, kind } : null)}
            onRevert={async () => {
              await state.revert(snapshot.id);
              setConfirm(null);
            }}
            onDelete={async () => {
              await state.remove(snapshot.id);
              setConfirm(null);
            }}
          />
        </div>
      </li>
    ),
  }));
  return { top, pins };
}

function useDoorExtras(): HistoryExtras {
  // Called only while the door is open (the host hands this hook out only then).
  return useSnapshotsExtras(useSnapshotsDoor()!.door);
}

function Alone({ onClose, after }: { onClose: () => void; after?: ReactNode }) {
  const door = useSnapshotsDoor();
  if (!door) return null;
  return (
    <Suspense fallback={null}>
      <SnapshotsDialog door={door.door} onClose={onClose} after={after} />
    </Suspense>
  );
}

const HOST: HistorySnapshotsHost = { useExtras: useDoorExtras, Alone };

/** Snapshots for the History host while this person may take them (the door is open), else null. */
export function useHistorySnapshotsHost(): HistorySnapshotsHost | null {
  const open = !!useSnapshotsDoor();
  return useMemo(() => (open ? HOST : null), [open]);
}
