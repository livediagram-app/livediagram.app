'use client';

import { useRef, type ReactNode } from 'react';
import { ChevronDownIcon, HoverCard } from '@livediagram/ui';
import { isIconCatalogsLoaded } from '@/lib/icon-registry';
import { iconBrowseGroups } from './IconPickerTab';
import { stickerBrowseGroups } from './StickerPickerTab';
import { techBrowseGroups } from './TechPickerTab';

// The Toolbar strip's tiles for Icons, Stickers and Technology (docs/specs/007-editor/toolbar-layout.md "More"): the
// catalogue's browse groups, each opening a popover of its entries. The groups are the browse's own
// (PaletteCategoryBrowser), so the strip and the More body never disagree.

export type StripGroup = { id: string; label: string; icon: ReactNode };

// What a strip popover opened on: a catalogue's group, or an opener (palette-openers) for a category or one of its
// groups. `key` is the tile that opened it.
export type StripOpen = { key: string; category: string; group: string | null; label: string };

/** The category's groups when it is a grouped catalogue, else null (its strip shows tiles). Empty groups (the
 *  catalogue chunk still in flight) are left out, so the strip shows nothing until there is something to open. */
export function catalogueStripGroups(categoryId: string): StripGroup[] | null {
  const cached = CACHE.get(categoryId);
  if (cached) return cached;
  const groups =
    categoryId === 'icons'
      ? iconBrowseGroups()
      : categoryId === 'stickers'
        ? stickerBrowseGroups()
        : categoryId === 'technology'
          ? techBrowseGroups()
          : null;
  if (!groups) return null;
  const strip = groups
    .filter((g) => g.items.length > 0)
    .map(({ id, label, icon }) => ({ id, label, icon }));
  // Built once the catalogues have landed, after which they never change: about 1 ms a build (Icons, Technology)
  // on every strip render otherwise, the AWS opener's glyph on Diagram's landing strip among them.
  if (isIconCatalogsLoaded()) CACHE.set(categoryId, strip);
  return strip;
}

const CACHE = new Map<string, StripGroup[]>();

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
      {open ? (
        button
      ) : (
        <HoverCard title={group.label} description="Open this group.">
          {button}
        </HoverCard>
      )}
    </span>
  );
}
