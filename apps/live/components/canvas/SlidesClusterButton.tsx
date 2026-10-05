'use client';

import { SlideDeckIcon } from '@/components/palette/palette-icons';
import { HoverCard } from '@livediagram/ui';

// The Slides button in the bottom-right cluster, in Illustrate mode (docs/specs/007-editor/
// illustrate-pages.md "Slides"): an infographic is likely to be presented, so its deck sits one
// press away, where Layers sits in the other modes. It opens the Slide Deck panel as a popover
// hanging ABOVE it, as the Layers button does, and shows pressed while it is open.
//
// `data-dock-button` makes a second press close the popover through the toggle rather than the
// panel's outside-click closing it on pointer-down and the click reopening it.
export function SlidesClusterButton({
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
      aria-label="Open Slides"
      aria-expanded={popoverOpen}
      className={`flex h-11 w-11 items-center justify-center transition ${
        popoverOpen
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
      }`}
    >
      <SlideDeckIcon />
    </button>
  );
  return (
    <div
      data-dock-button=""
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="pointer-events-auto flex animate-fade-in items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
    >
      {/* No hover card while open: it would sit over the panel it names. */}
      {popoverOpen ? (
        button
      ) : (
        <HoverCard
          title="Open Slides"
          description="Build a slide deck from your pages and present it."
        >
          {button}
        </HoverCard>
      )}
    </div>
  );
}
