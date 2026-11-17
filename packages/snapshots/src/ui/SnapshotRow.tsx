'use client';

// One snapshot in the dialog (liveworkspace/docs/specs/014-snapshots/snapshots.md "In the editor"; blueprint SN24): its
// name or time, who took it, how long ago and its size, a `Before revert` badge on an automatic one, and Revert and
// Delete. Delete goes at once (owner, 2026-11-17: no question for it); Revert asks first in the shared ConfirmPopover
// beside its button, as every other confirm in the apps does.

import { useState } from 'react';
import { Button, ConfirmPopover } from '@liveworkspace/ui';
import type { SnapshotSummary } from '../wire';
import { BinGlyph } from './glyphs';
import { snapshotMeta, snapshotTitle } from './snapshot-words';
import type { SnapshotBusy } from './useSnapshots';

export type RowConfirm = { id: string; kind: 'revert' | 'delete' } | null;

export function SnapshotRow({
  snapshot,
  noun,
  viewerId,
  now,
  confirm,
  busy,
  locked,
  onConfirm,
  onRevert,
  onDelete,
  as: Tag = 'li',
}: {
  snapshot: SnapshotSummary;
  noun: string;
  viewerId: string | null;
  now: number;
  confirm: 'revert' | 'delete' | null;
  busy: SnapshotBusy;
  locked: boolean;
  onConfirm: (kind: 'revert' | 'delete' | null) => void;
  onRevert: () => void;
  onDelete: () => void;
  // A plain block on History's rail, which draws the list item itself.
  as?: 'li' | 'div';
}) {
  const title = snapshotTitle(snapshot);
  const reverting = busy?.kind === 'revert' && busy.id === snapshot.id;
  const deleting = busy?.kind === 'delete' && busy.id === snapshot.id;
  // The Revert button, which the confirm stands beside.
  const [revertAt, setRevertAt] = useState<HTMLElement | null>(null);
  return (
    <Tag
      data-snapshot-row={snapshot.id}
      className={`rounded-lg ${
        // On History's rail its text lines up with the events' (the label above it), the hover wash reaching past it.
        Tag === 'div' ? '-mx-2 px-2 py-1.5' : 'px-3 py-2.5'
      } transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {/* Below sm the badge takes its own line, so a phone keeps the name readable. */}
          <div
            data-snapshot-title-line=""
            className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2"
          >
            <span className="max-w-full truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {title}
            </span>
            {snapshot.kind === 'before-revert' ? (
              <span className="shrink-0 rounded-[5px] bg-slate-900/[0.06] px-1.5 py-0.5 text-[11px] font-medium leading-none text-slate-600 dark:bg-white/10 dark:text-slate-300">
                Before revert
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">
            {snapshotMeta(snapshot, viewerId, now)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            disabled={locked && !reverting}
            busy={reverting}
            onClick={(e) => {
              setRevertAt(e.currentTarget);
              onConfirm('revert');
            }}
            aria-label={`Revert to ${title}`}
          >
            {reverting ? 'Reverting…' : 'Revert'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={locked && !deleting}
            busy={deleting}
            onClick={onDelete}
            aria-label="Delete snapshot"
            title="Delete snapshot"
            className="relative touch-target text-slate-500 hover:text-red-700 dark:text-slate-400 dark:hover:text-red-300"
          >
            <BinGlyph />
          </Button>
        </div>
      </div>
      {confirm === 'revert' && revertAt ? (
        <ConfirmPopover
          anchor={revertAt}
          message={`Revert to this snapshot? Everyone's work since then is replaced. A snapshot of the ${noun} as it is now is taken first, so you can undo this.`}
          confirmLabel="Revert"
          onConfirm={() => {
            onConfirm(null);
            onRevert();
          }}
          onCancel={() => onConfirm(null)}
        />
      ) : null}
    </Tag>
  );
}
