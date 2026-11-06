'use client';

import { useRef, type ReactNode } from 'react';
import { ChevronDownIcon, HoverCard } from '@livehuddle/ui';
import type { PaletteTileDef } from './palette-tile-defs';

// An opener tile on the strip and what a strip popover opened on (docs/specs/007-editor/toolbar-layout.md): a tile's
// presets open from a group tile.

export type StripGroup = { id: string; label: string; icon: ReactNode };

// What a strip popover opened on: a catalogue's group, an opener for a category or one of its
// groups, or a tile's presets (`variants`, docs/specs/009-elements/card.md "Card presets"). `key` is the tile that
// opened it.
export type StripOpen = {
  key: string;
  category: string;
  group: string | null;
  label: string;
  variants?: { description: string; tiles: readonly PaletteTileDef[] };
};

/** One group on the strip. Drawn as an opener, not a tile: its artwork with a chevron, as the strip's other pickers
 *  are, so it reads as "open this group" rather than "drag this icon". Pressing it toggles its popover, hung from the
 *  tile; the wrapper carries the More button's marker so a press on it never counts as outside the popover it owns. */
export function CatalogueGroupTile({
  group,
  open,
  onToggle,
}: {
  group: StripGroup;
  open: boolean;
  onToggle: (anchor: HTMLElement) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const button = (
    <button
      type="button"
      aria-label={group.label}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => {
        if (ref.current) onToggle(ref.current);
      }}
      className={`relative flex h-9 touch-target-y items-center gap-0.5 rounded-md pl-1.5 pr-1 transition ${
        open
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      <span
        aria-hidden
        className="flex h-[22px] w-[22px] items-center justify-center [&>svg]:max-h-full [&>svg]:max-w-full"
      >
        {group.icon}
      </span>
      <ChevronDownIcon
        className={`h-3 w-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
      />
    </button>
  );
  return (
    <span ref={ref} data-toolbar-more-button="" className="flex">
      {/* No hover card while open: it would sit over the group's menu. Disabled, not unwrapped, so the button keeps
          its focus as the menu opens. */}
      <HoverCard title={group.label} description="Open this group." disabled={open}>
        {button}
      </HoverCard>
    </span>
  );
}
