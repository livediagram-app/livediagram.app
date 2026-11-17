'use client';

import { RedoIcon, UndoIcon } from '@liveworkspace/ui';
import { CLUSTER_STRIP } from './cluster-strip';

// The Undo / Redo strip in the bottom-right cluster: the leftmost item,
// before Layers + Theme & Canvas. Edit sessions only: undo / redo aren't
// actionable for a view-role visitor, so the caller renders nothing for
// them. No hover cards: the arrows say what they do (owner, 2026-11-16).
//
// `data-dock-button` keeps Undo / Redo presses from closing an open cluster
// popover (Layers, Collaborate), the same as pressing their own buttons.
export function UndoRedoClusterStrip({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}) {
  return (
    <div
      data-dock-button=""
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className={CLUSTER_STRIP}
    >
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo"
        className="flex h-11 w-11 items-center justify-center text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:disabled:text-slate-600 dark:disabled:hover:bg-transparent"
      >
        <UndoIcon />
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Redo"
        className="flex h-11 w-11 items-center justify-center border-l border-slate-100 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:disabled:text-slate-600 dark:disabled:hover:bg-transparent"
      >
        <RedoIcon />
      </button>
    </div>
  );
}
