'use client';

import type { ReactNode } from 'react';

// The tile family of the menu rows (PortalMenu.tsx holds the menu and its list rows): a toolbar of
// icon buttons, and icon-over-label tiles in a grid. Each takes its role from the menu it sits in
// (docs/specs/004-interface-design/menus.md): a menu item in a command menu, a button elsewhere.

// Grid wrapper for MenuTile rows (2 / 3 / 4 equal columns).
export function MenuTileGrid({ cols = 3, children }: { cols?: 2 | 3 | 4; children: ReactNode }) {
  const colClass = cols === 2 ? 'grid-cols-2' : cols === 4 ? 'grid-cols-4' : 'grid-cols-3';
  // `auto-rows-fr` so a row with one wrapped label doesn't leave its
  // neighbours shorter: every tile in a row is the row's height.
  return <div className={`grid auto-rows-fr gap-1 px-2 py-1.5 ${colClass}`}>{children}</div>;
}
