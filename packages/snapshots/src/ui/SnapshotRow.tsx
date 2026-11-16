'use client';

// One snapshot in the dialog (liveworkspace/docs/specs/013-snapshots/snapshots.md "In the editor"; blueprint SN24): its
// name or time, who took it, how long ago and its size, a `Before revert` badge on an automatic one, and Revert and
// Delete. Each confirms in place: the row's actions give way to the question and its two buttons, focus moves to
// Cancel, and Escape there cancels.

import type { KeyboardEvent } from 'react';
import { Button } from '@liveworkspace/ui';
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
}) {
  const title = snapshotTitle(snapshot);
  const reverting = busy?.kind === 'revert' && busy.id === snapshot.id;
  const deleting = busy?.kind === 'delete' && busy.id === snapshot.id;
  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onConfirm(null);
  };
  return (
    <li
      data-snapshot-row={snapshot.id}
      className={`rounded-lg px-3 py-2.5 transition-colors ${
        confirm
          ? 'bg-slate-100 dark:bg-slate-800/80'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
      }`}
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
        {confirm === null ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              disabled={locked}
              onClick={() => onConfirm('revert')}
              aria-label={`Revert to ${title}`}
            >
              Revert
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={locked}
              onClick={() => onConfirm('delete')}
              aria-label="Delete snapshot"
              title="Delete snapshot"
              className="relative touch-target text-slate-500 hover:text-red-700 dark:text-slate-400 dark:hover:text-red-300"
            >
              <BinGlyph />
            </Button>
          </div>
        ) : null}
      </div>
      {confirm ? (
        <div
          role="group"
          aria-label={confirm === 'revert' ? 'Confirm revert' : 'Confirm delete'}
          onKeyDown={cancelOnEscape}
          className="mt-2.5 flex flex-col gap-2.5 border-t border-slate-200 pt-2.5 sm:flex-row sm:items-center dark:border-slate-700"
        >
          <p className="flex-1 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
            {confirm === 'revert'
              ? `Everyone's work since then is replaced. A snapshot of the ${noun} as it is now is taken first, so you can undo this.`
              : "Delete this snapshot? This can't be undone."}
          </p>
          <div className="flex shrink-0 justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              autoFocus
              disabled={reverting || deleting}
              onClick={() => onConfirm(null)}
            >
              Cancel
            </Button>
            {confirm === 'revert' ? (
              <Button variant="primary" size="sm" busy={reverting} onClick={onRevert}>
                {reverting ? 'Reverting…' : 'Revert'}
              </Button>
            ) : (
              <Button
                variant="solid"
                size="sm"
                busy={deleting}
                onClick={onDelete}
                className="bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}
