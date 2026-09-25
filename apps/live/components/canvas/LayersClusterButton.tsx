'use client';

import { LayersStackIcon } from '@/components/panels/layers-panel-icons';
import { Tooltip } from '@/components/primitives/Tooltip';

// The Layers button in the bottom-right cluster (spec/74), in every layout.
//
// In the desktop docking layout the panel ships minimised into it, mirroring
// the Activity strip, and the button un-minimises it (`onExpand`). In the dock
// layouts (minimal, or a phone outside Toolbar) it opens the panel as a
// popover hanging ABOVE it instead (`onTogglePopover`, handed the button to
// anchor to), and shows pressed while that popover is open.
//
// `data-mobile-dock` makes a second press close the popover through the
// toggle rather than the panel's outside-click closing it on pointer-down and
// the click reopening it.
export function LayersClusterButton({
  popoverOpen,
  onExpand,
  onTogglePopover,
}: {
  popoverOpen: boolean;
  onExpand?: () => void;
  // Set in the dock layouts: the button opens the popover rather than the
  // docked panel.
  onTogglePopover?: (button: HTMLElement) => void;
}) {
  const button = (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => (onTogglePopover ? onTogglePopover(e.currentTarget) : onExpand?.())}
      aria-label="Open Layers"
      aria-expanded={onTogglePopover ? popoverOpen : undefined}
      className={`flex h-11 w-11 items-center justify-center transition ${
        popoverOpen
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
      }`}
    >
      <LayersStackIcon />
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
        button
      ) : (
        <Tooltip title="Open Layers" description="Expand the Layers panel.">
          {button}
        </Tooltip>
      )}
    </div>
  );
}
