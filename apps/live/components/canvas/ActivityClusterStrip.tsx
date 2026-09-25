'use client';

import { ActivityIcon, RedoIcon, UndoIcon } from '@/components/panels/ActivityPanel';
import { Tooltip } from '@/components/primitives/Tooltip';

// The Activity strip in the bottom-right cluster (spec/12): the Tab Activity
// button with inline Undo / Redo, so the most common history actions don't
// need the panel. Leftmost of the cluster, before Layers + Theme & Canvas.
// Edit sessions only: undo / redo and the audit trail aren't actionable for a
// view-role visitor, so the caller renders nothing for them.
//
// Like the Layers button (LayersClusterButton): in the desktop docking layout
// the panel ships minimised into it and the Activity button un-minimises it
// (`onExpand`). In the dock layouts (minimal, or a phone outside Toolbar) the
// button opens the panel as a popover hanging ABOVE it instead
// (`onTogglePopover`), pressed while it's open. `data-mobile-dock` makes a
// second press close it through the toggle, and keeps Undo / Redo presses
// from closing it.
export function ActivityClusterStrip({
  popoverOpen,
  onExpand,
  onTogglePopover,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  popoverOpen: boolean;
  onExpand?: () => void;
  onTogglePopover?: (button: HTMLElement) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}) {
  const activityButton = (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => (onTogglePopover ? onTogglePopover(e.currentTarget) : onExpand?.())}
      aria-label="Open Tab Activity"
      aria-expanded={onTogglePopover ? popoverOpen : undefined}
      className={`flex h-11 w-11 items-center justify-center border-r border-slate-200 transition dark:border-slate-700 ${
        popoverOpen
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
      }`}
    >
      <ActivityIcon />
    </button>
  );
  return (
    <div
      data-mobile-dock=""
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="pointer-events-auto flex animate-pop-in items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
    >
      {/* No tooltip while open: it would sit over the panel it names. */}
      {popoverOpen ? (
        activityButton
      ) : (
        <Tooltip title="Open Tab Activity" description="Expand the Tab Activity panel.">
          {activityButton}
        </Tooltip>
      )}
      <Tooltip title="Undo" description="Undo last edit.">
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
      </Tooltip>
      <Tooltip title="Redo" description="Redo last undone edit.">
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
      </Tooltip>
    </div>
  );
}
