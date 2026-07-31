'use client';

import { useState } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { PaletteTileGrid, type PaletteTileActions } from './PaletteTileGrid';
import { PaletteToolRows } from './PaletteToolRows';
import { PaletteCategoryBrowser } from './PaletteCategoryBrowser';
import { TOOL_GROUPS, tilesInSection, tilesInToolGroup } from './palette-tile-defs';

// The palette's creation-category tab bodies. Since spec/78 every tile is
// a data entry in the shared catalogue (palette-tile-defs.tsx) rendered
// through PaletteTileGrid, so each tab is just its catalogue slice — the
// per-tile JSX that used to live here (and in PaletteShapesTab /
// PaletteToolsTab / PaletteDataTab / DevicePickerTab) moved into the
// catalogue. The search-driven tabs (Icons / Technology) stay in
// CommandPalette since they own their search / filter state; the
// Favourites tab (spec/78) has its own file (PaletteFavouritesTab).

type TabProps = {
  pendingDraw: PendingDraw | null | undefined;
  actions: PaletteTileActions;
};

export function PaletteShapesTab({ pendingDraw, actions }: TabProps) {
  return <PaletteTileGrid section="shapes" actions={actions} pendingDraw={pendingDraw} />;
}

// The Tools tab (spec/09 "Sub-categories"): the tools grouped by theme (Write &
// Draw / Structure / Blocks / People & Media / Behaviour, from TOOL_GROUPS — a
// flat twenty-tile wall stopped scanning), plus the Data charts (spec/53,
// folded in from the old standalone Data category).
//
// Navigation is DRILL-IN: a grid of category tiles, then that category's tools
// with a breadcrumb back. It replaced a stack of accordions,
// where the tools were invisible until you opened a group, opening one pushed
// the others off the bottom, and the palette — a wall of pictures everywhere
// else — presented itself as a list of words.
export function PaletteToolsTab({ pendingDraw, actions }: TabProps) {
  // Search box state is local: it's a way to get somewhere in this tab, not a
  // filter you'd expect to survive leaving it.
  const [query, setQuery] = useState('');
  // Category artwork = the group's first tile, so a category always looks like
  // what it holds. Data's tiles come from its own catalogue section rather
  // than a tool group.
  const categories = [
    ...TOOL_GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      description: g.description,
      items: tilesInToolGroup(g.id),
    })),
    {
      id: 'data',
      label: 'Data',
      description: 'Charts and meters: pie, bar and line charts, progress bars and rings, ratings.',
      items: tilesInSection('data'),
    },
  ].map((c) => ({ ...c, icon: c.items[0]?.icon ?? null }));
  return (
    <PaletteCategoryBrowser
      root="Tools"
      categories={categories}
      // Matches on caption and description as well as the label, so "chart"
      // finds the pie chart whether or not you know what it's called.
      search={(query) => {
        const q = query.toLowerCase();
        return [...tilesInSection('tools'), ...tilesInSection('data')].filter((t) =>
          [t.label, t.caption ?? '', t.description].some((s) => s.toLowerCase().includes(q)),
        );
      }}
      renderItems={(tiles) => (
        <PaletteToolRows tiles={tiles} actions={actions} pendingDraw={pendingDraw} />
      )}
      query={query}
      onQueryChange={setQuery}
      searchInput={{
        placeholder: 'Search tools',
        ariaLabel: 'Search tools',
        clearAriaLabel: 'Clear tool search',
        clearDescription: 'Clear the tool search query.',
      }}
      telemetry={{ openedType: 'ToolGroup', searchedType: 'ToolSearch' }}
      emptyMessage={(q) => `No tools match “${q}”.`}
    />
  );
}

export function PaletteComponentsTab({ pendingDraw, actions }: TabProps) {
  return <PaletteTileGrid section="components" actions={actions} pendingDraw={pendingDraw} />;
}

// Wireframing device-frame primitives (browser / monitor / laptop / phone /
// tablet / smartwatch) — see spec/09 "Devices".
export function DevicePickerTab({ pendingDraw, actions }: TabProps) {
  return <PaletteTileGrid section="devices" actions={actions} pendingDraw={pendingDraw} />;
}
