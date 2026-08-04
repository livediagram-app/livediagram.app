'use client';

import { useState, type ReactNode } from 'react';

import type { PendingDraw } from '@/lib/draw-mode';
import { PaletteCategoryBrowser } from './PaletteCategoryBrowser';
import { PaletteToolRows } from './PaletteToolRows';
import type { PaletteTileDef } from './palette-tile-defs';
import type { PaletteTileActions } from './PaletteTileGrid';

// The drill-in browse for a catalogue tab whose contents are grouped by
// `tileGroup` — Behaviour and Collaborate (spec/09 "Sub-categories").
//
// Both tabs were a stack of accordion headers: five collapsed rows for
// Behaviour, two plus a loose row for Collaborate. Accordions read as a table
// of contents rather than a palette, every open group pushed the others off
// the bottom, and the tiles themselves were invisible until you opened one —
// the same three problems the Tools tab had before it grew this navigation,
// and that Icons, Stickers and Technology were converted to afterwards.
//
// So these two join them, on the SAME component (PaletteCategoryBrowser)
// rather than a fourth copy of the pattern: a grid of category tiles, click
// one to see its contents, breadcrumb back, and a search box that cuts across
// every group at once.
//
// What is different here is only what a "category" is made of. Icons derive
// theirs from a glyph catalogue; these derive theirs from the tile catalogue's
// own `tileGroup` field, so a tile added with a group joins its category the
// day it lands, and a group whose tiles are all hidden (an image tile on a
// deployment without uploads) drops out rather than opening onto nothing.

export type TileGroupDef = {
  /** The `tileGroup` value its tiles carry. */
  id: string;
  label: string;
  icon: ReactNode;
};

/** Does this tile match a typed query? The same fields the palette's
 *  cross-category search matches on, so a query behaves the same wherever it
 *  is typed. */
function tileMatches(tile: PaletteTileDef, q: string): boolean {
  return [tile.label, tile.caption ?? '', tile.blurb ?? '', tile.description].some((s) =>
    s.toLowerCase().includes(q),
  );
}

export function PaletteGroupBrowser({
  root,
  tiles,
  groups,
  actions,
  pendingDraw,
  searchInput,
  telemetry,
  emptyMessage,
  leadIn,
}: {
  root: string;
  /** The tab's whole catalogue slice, grouped and ungrouped alike. */
  tiles: PaletteTileDef[];
  groups: TileGroupDef[];
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
  searchInput: {
    placeholder: string;
    ariaLabel: string;
    clearAriaLabel: string;
    clearDescription: string;
  };
  telemetry: { openedType: string; searchedType: string };
  emptyMessage: (query: string) => string;
  /** Tiles that belong to no group, shown above the category grid. */
  leadIn?: ReactNode;
}) {
  // Local to the tab. Switching category and coming back clears it, which is
  // right: a query is about the thing you are looking for now, not a filter
  // you left switched on.
  const [query, setQuery] = useState('');

  // No `description` on a category, so ToolsCategoryGrid draws no tooltip. A
  // hover card restating "Reactions: react on the board" is a delay in
  // exchange for nothing — the same call the Icons grid already made for
  // People and Arrows. The accordions these replaced carried that line under
  // the heading, where it cost nothing; on a tile it would.
  const categories = groups
    .map((g) => ({
      id: g.id,
      label: g.label,
      icon: g.icon,
      items: tiles.filter((t) => t.tileGroup === g.id),
    }))
    .filter((c) => c.items.length > 0);

  return (
    <PaletteCategoryBrowser
      root={root}
      categories={categories}
      // Across every group INCLUDING the ungrouped lead-in tiles: searching
      // "comment" from the Collaborate tab should find the comment panel
      // whether or not it happens to sit in a category.
      search={(q) => tiles.filter((t) => tileMatches(t, q.trim().toLowerCase()))}
      renderItems={(items) => (
        <PaletteToolRows tiles={items} actions={actions} pendingDraw={pendingDraw} />
      )}
      query={query}
      onQueryChange={setQuery}
      searchInput={searchInput}
      telemetry={telemetry}
      emptyMessage={emptyMessage}
      rootLeadIn={leadIn}
    />
  );
}
