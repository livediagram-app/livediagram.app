'use client';

import { createContext, useContext } from 'react';

// The Toolbar layout's usage ordering (spec/148), handed down to every tile
// the strip and its More popover render: the recently-used tile ids, and the
// call a tile makes when it is used. Null outside the Toolbar layout, so the
// floating Palette's tiles record nothing and keep their own order.
//
// A context rather than a prop because the More popover renders each
// category's own body (the Favourites grid, the search results), several
// components below the strip that owns the list.
export type PaletteRecentState = {
  recent: readonly string[];
  onUse: (tileId: string) => void;
};

export const PaletteRecentContext = createContext<PaletteRecentState | null>(null);

export function usePaletteRecent(): PaletteRecentState | null {
  return useContext(PaletteRecentContext);
}
