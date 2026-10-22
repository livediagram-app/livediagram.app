'use client';

import { useState, type ReactNode } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { BehaviourTabIcon } from '@livedesign/ui';
import { PaletteCategoryBrowser } from './PaletteCategoryBrowser';
import { tileHandler, visibleTiles, type PaletteTileActions } from './PaletteTileGrid';
import { rankTiles } from './palette-tile-search';
import { CardList } from './category-flyout-items';
import { flyoutTagline } from './category-flyout-groups';
import type { PaletteTileDef } from './palette-tile-defs';
import type { BarCategory } from './CategoryBar';

// Session, on the category bar (docs/specs/007-editor/toolbar-layout.md "The category bar"): five of Workshop's
// Collaborate categories (Tools, Record, React, Selection Mode, Navigate) as one bar category, browsed the way Icons
// is: a grid of the groups, one opened with a breadcrumb back, and a search across all of them. Five buttons for one
// job crowded the bar; the groups stay what they were, one level down. Ask keeps its own place on the bar: putting a
// question to the room is the session's main act, not one of its tools. Session reopens on the group it was left on
// (BrowseMemory, keyed "Session").

export const SESSION_CATEGORY_ID = 'session';

// The categories Session gathers, in the bar's order.
export const SESSION_GROUP_IDS: readonly string[] = [
  'collab-tools',
  'collab-record',
  'collab-react',
  'collab-mode',
  'collab-navigate',
];

/** The bar's categories with the Collaborate ones gathered into Session, where the first of them stood. A mode
 *  without them is returned as it is. */
export function withSessionCategory(
  categories: readonly BarCategory[],
  body: (groups: readonly BarCategory[]) => ReactNode,
): BarCategory[] {
  const groups = categories.filter((c) => SESSION_GROUP_IDS.includes(c.id));
  if (groups.length === 0) return [...categories];
  const out: BarCategory[] = [];
  for (const c of categories) {
    if (!SESSION_GROUP_IDS.includes(c.id)) out.push(c);
    else if (c === groups[0])
      out.push({
        id: SESSION_CATEGORY_ID,
        label: 'Session',
        description: 'Run the room: time, record, react, switch modes and move around.',
        icon: <BehaviourTabIcon />,
        group: c.group,
        tiles: null,
        content: body(groups),
      });
  }
  return out;
}

/** Session's flyout body: the groups to browse, and a search across every one of their tiles. */
export function SessionBrowse({
  groups,
  actions,
  pendingDraw,
}: {
  groups: readonly BarCategory[];
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null;
}) {
  const [query, setQuery] = useState('');
  const browse = groups.map((g) => ({
    id: g.id,
    label: g.label,
    icon: g.icon,
    description: flyoutTagline(g.id, g.description),
    items: visibleTiles([...(g.tiles ?? [])], actions.hasImage),
  }));
  const all = browse.flatMap((g) => g.items);
  const renderItems = (items: PaletteTileDef[]) => (
    <CardList
      tiles={items}
      columns={1}
      actions={actions}
      pendingDraw={pendingDraw}
      onPress={(def) => tileHandler(def, actions, pendingDraw)()}
      onHover={() => {}}
    />
  );
  return (
    <PaletteCategoryBrowser
      root="Session"
      categories={browse}
      search={(q) => rankTiles(q, all)}
      renderItems={renderItems}
      query={query}
      onQueryChange={setQuery}
      searchInput={{
        placeholder: 'Search session tools',
        ariaLabel: 'Search session tools',
        clearAriaLabel: 'Clear search',
        clearDescription: 'Show the groups again.',
      }}
      telemetry={{ openedType: 'BehaviourGroup', searchedType: 'BehaviourSearch' }}
      things="session tools"
    />
  );
}
