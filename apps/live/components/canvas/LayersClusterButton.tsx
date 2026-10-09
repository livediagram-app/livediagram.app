'use client';

import { LayersStackIcon } from '@/components/panels/layers-panel-icons';
import { HoverCard } from '@livediagram/ui';
import { CLUSTER_STRIP, CLUSTER_CONTROL_REST } from '@/components/canvas/cluster-strip';

// The Layers button in the bottom-right cluster (docs/specs/006-document/layers.md). It opens the
// panel as a popover hanging ABOVE it (`onTogglePopover`, handed the button
// to anchor to), and shows pressed while that popover is open.
//
// `data-dock-button` makes a second press close the popover through the
// toggle rather than the panel's outside-click closing it on pointer-down and
// the click reopening it.
export function LayersClusterButton({
  popoverOpen,
  onTogglePopover,
}: {
  popoverOpen: boolean;
  onTogglePopover: (button: HTMLElement) => void;
}) {
  const button = (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => onTogglePopover(e.currentTarget)}
      aria-label="Open Layers"
      aria-expanded={popoverOpen}
      className={`flex h-11 w-11 items-center justify-center transition ${
        popoverOpen
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : CLUSTER_CONTROL_REST
      }`}
    >
      <LayersStackIcon />
    </button>
  );
  return (
    <div
      data-dock-button=""
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className={CLUSTER_STRIP}
    >
      {/* No hover card while open: it would sit over the panel it names. */}
      {popoverOpen ? (
        button
      ) : (
        <HoverCard title="Open Layers" description="Show this tab's layers.">
          {button}
        </HoverCard>
      )}
    </div>
  );
}
