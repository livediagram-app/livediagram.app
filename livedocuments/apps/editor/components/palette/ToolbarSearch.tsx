'use client';

import { useState } from 'react';
import type { Element } from '@livedocuments/document';
import { CompactEmptyState, HoverCard, NoMatches, SearchIcon } from '@livedocuments/ui';
import type { PendingDraw } from '@/lib/draw-mode';
import { SearchInput } from '@liveworkspace/workbench/components/primitives/SearchInput';
import { TOOLBAR_TRIGGER_TONE } from './PaletteDropdown';
import { PaletteTileGrid, tileHandler, type PaletteTileActions } from './PaletteTileGrid';
import { mergeByName, searchElementTiles } from './palette-tile-search';
import { searchCatalogueTiles } from './palette-catalogue-search';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';

// The Toolbar strip's Search (docs/specs/007-editor/toolbar-layout.md "Search: every element type"):
// a button at the strip's far right, and the body of the popover it opens. The popover's card,
// placement and dismissal are the strip's (ToolbarStripPopover); the match is palette-tile-search.

/** Marks the button and the popover, for the popover's outside-press check. */
export const TOOLBAR_SEARCH_SELECTOR = '[data-toolbar-search], [data-toolbar-search-button]';

export function ToolbarSearchButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: (button: HTMLElement) => void;
}) {
  const button = (
    <button
      type="button"
      data-toolbar-search-button=""
      aria-label="Search elements"
      aria-keyshortcuts="S"
      aria-expanded={open}
      onClick={(e) => onToggle(e.currentTarget)}
      // A square the size of a tile, not side padding: a phone's strip trims its pickers' px-2
      // (PHONE_TOOLBAR_ITEMS), which squeezed this icon-only button to 24px beside 36px tiles.
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition ${
        open
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : TOOLBAR_TRIGGER_TONE
      }`}
    >
      <SearchIcon />
    </button>
  );
  // No hover card while open: it would sit over the popover it names. Switched off rather than left out, so the
  // button is not remounted as it opens: Escape hands focus back to it (ToolbarStripPopover).
  return (
    <HoverCard
      disabled={open}
      title="Search Elements"
      description="Find any element by name, from every category. Shortcut: S."
    >
      {button}
    </HoverCard>
  );
}

export function ToolbarSearchPanel({
  actions,
  pendingDraw,
  tabElements,
}: {
  // The tab's elements: before anything is typed, the panel lists the element types on it.
  tabElements: readonly Element[];
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
}) {
  // Mounted only while the popover is open, so it resets each time it opens.
  const [query, setQuery] = useState('');
  // Icons, Stickers and Technology load as a chunk of their own: re-rendered when it lands.
  const cataloguesLoaded = useIconCatalogs();
  const elements = searchElementTiles({
    query,
    hasImage: actions.hasImage,
    tabElements,
  });
  const catalogues = searchCatalogueTiles({ query, tabElements, loaded: cataloguesLoaded });
  // One ranking across element types and catalogue entries: name matches first.
  const here = mergeByName(query, elements, catalogues);
  const browsing = !query.trim();

  // Enter uses the best match.
  const best = here[0];
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !best) return;
    e.preventDefault();
    tileHandler(best, actions)();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        <SearchInput
          value={query}
          onChange={setQuery}
          onKeyDown={onKeyDown}
          placeholder="Search elements"
          ariaLabel="Search elements"
          clearAriaLabel="Clear the element search"
          clearDescription="Clear the search over every element."
        />
      </div>
      {browsing && here.length > 0 ? (
        <div className="px-1 text-[10px] text-slate-500 dark:text-slate-400">On This Tab</div>
      ) : null}
      {here.length > 0 ? (
        <PaletteTileGrid tiles={here} actions={actions} pendingDraw={pendingDraw} />
      ) : // The shared empty state (docs/specs/004-interface-design/empty-states.md).
      browsing ? (
        <CompactEmptyState
          size="small"
          icon={<SearchIcon />}
          title="No elements on this tab yet"
          description="Type to find any element."
        />
      ) : (
        <NoMatches things="elements" query={query} onClear={() => setQuery('')} />
      )}
    </div>
  );
}
