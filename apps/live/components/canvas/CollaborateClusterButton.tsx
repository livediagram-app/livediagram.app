'use client';

import { HoverCard } from '@livediagram/ui';
import { CountBadge } from '@/components/primitives/CountBadge';
import { CollaborateGlyph } from '@/components/panels/collaborate/CollaborateGlyph';

// The Collaborate button in the bottom-right cluster, right after Layers
// (docs/specs/012-collaboration/assigned-actions.md §5). Built like LayersClusterButton, but it opens the
// panel as a popover hanging above it in EVERY layout (`onTogglePopover`,
// handed the button to anchor to), and shows pressed while it is open: a panel
// docked in the bottom-right corner ran up under the Palette on a short
// window. The caller renders it only while the tab has a thread or an action.
//
// The open count rides on the button as a brand badge, so "something is
// waiting" reads from across the screen without opening anything.
//
// `data-mobile-dock` makes a second press close the popover through the
// toggle rather than the panel's outside-click closing it on pointer-down and
// the click reopening it.
export function CollaborateClusterButton({
  openCount,
  popoverOpen,
  onTogglePopover,
}: {
  openCount: number;
  popoverOpen: boolean;
  onTogglePopover: (button: HTMLElement) => void;
}) {
  const label = openCount > 0 ? `Open Collaborate (${openCount} open)` : 'Open Collaborate';
  const button = (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => onTogglePopover(e.currentTarget)}
      aria-label={label}
      aria-expanded={popoverOpen}
      className={`relative flex h-11 w-11 items-center justify-center transition ${
        popoverOpen
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
      }`}
    >
      <CollaborateGlyph size={18} />
      {openCount > 0 ? (
        <CountBadge count={openCount} tone="brand" className="absolute right-1 top-1" />
      ) : null}
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
      {/* No hover card while open: it would sit over the panel it names. */}
      {popoverOpen ? (
        button
      ) : (
        <HoverCard
          title="Collaborate"
          description="Comments and actions on this tab: what is open, and what is done."
        >
          {button}
        </HoverCard>
      )}
    </div>
  );
}
