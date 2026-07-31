'use client';

import { useState } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { PaletteTileGrid, type PaletteTileActions } from './PaletteTileGrid';
import { PaletteToolRows } from './PaletteToolRows';
import { PaletteCategoryBrowser } from './PaletteCategoryBrowser';
import {
  TOOL_GROUPS,
  tilesInSection,
  tilesInToolGroup,
  type ToolGroupId,
} from './palette-tile-defs';

// The palette's creation-category tab bodies. Since spec/78 every tile is
// a data entry in the shared catalogue (palette-tile-defs.tsx) rendered
// through PaletteTileGrid, so each tab is just its catalogue slice — the
// per-tile JSX that used to live here (and in PaletteShapesTab /
// PaletteToolsTab / PaletteDataTab / DevicePickerTab) moved into the
// catalogue. The search-driven tabs (Icons / Technology) stay in
// CommandPalette since they own their search / filter state; the
// Favourites tab (spec/78) has its own file (PaletteFavouritesTab).

// Tool groups promoted OUT of the Tools tab into their own top-level palette
// category (spec/110). They keep their `toolGroup` on the tile defs — the
// favourites dialog and the group catalogue still address them by it — so this
// set is what the Tools tab subtracts rather than a second source of truth.
const TOP_LEVEL_GROUPS = new Set<ToolGroupId>(['behaviour']);

type TabProps = {
  pendingDraw: PendingDraw | null | undefined;
  actions: PaletteTileActions;
};

export function PaletteShapesTab({ pendingDraw, actions }: TabProps) {
  return <PaletteTileGrid section="shapes" actions={actions} pendingDraw={pendingDraw} />;
}

// The Tools tab (spec/09 "Sub-categories"): the tools grouped by theme (Write &
// Draw / Structure / Blocks / People & Media / Behaviour, from TOOL_GROUPS — a
// flat twenty-tile wall stopped scanning). The Data charts and the Behaviour
// elements are NOT here: each is its own top-level category (spec/110).
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
  // what it holds.
  const categories = TOOL_GROUPS.filter((g) => !TOP_LEVEL_GROUPS.has(g.id)).map((g) => {
    const items = tilesInToolGroup(g.id);
    return {
      id: g.id,
      label: g.label,
      description: g.description,
      items,
      icon: items[0]?.icon ?? null,
    };
  });
  return (
    <PaletteCategoryBrowser
      root="Tools"
      categories={categories}
      // Matches on caption and description as well as the label, so "chart"
      // finds the pie chart whether or not you know what it's called.
      search={(query) => {
        const q = query.toLowerCase();
        return tilesInSection('tools')
          .filter((t) => !t.toolGroup || !TOP_LEVEL_GROUPS.has(t.toolGroup))
          .filter((t) =>
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

// Charts and meters (spec/53): pie / bar / line charts, progress bars and
// rings, ratings. Its own top-level category rather than a group inside Tools
// (spec/110) — a chart is a thing you place, not a tool you pick up, and
// burying six tiles two levels down made them the hardest elements in the
// palette to reach.
export function PaletteDataTab({ pendingDraw, actions }: TabProps) {
  // Rows with a blurb, like Behaviour: "Pie" and "Donut" name the picture but
  // not the job, and "Proportions of a whole" vs "How far along something is"
  // is the thing you are actually choosing between.
  return (
    <PaletteToolRows tiles={tilesInSection('data')} actions={actions} pendingDraw={pendingDraw} />
  );
}

// The elements that DO something when somebody interacts with them (spec/103
// to spec/107): Selection Mode buttons, Portals, Session buttons, Reveal
// zones, Pickers. Its own top-level category (spec/110) rather than a group
// inside Tools, because these are the palette's newest and least discoverable
// elements and two levels of navigation is where they went to hide.
//
// Rows, not a tile grid: half of these are behaviours whose glyph cannot say
// what they do, so each keeps its one-line blurb (spec/09).
export function PaletteBehaviourTab({ pendingDraw, actions }: TabProps) {
  return (
    <PaletteToolRows
      tiles={tilesInToolGroup('behaviour')}
      actions={actions}
      pendingDraw={pendingDraw}
    />
  );
}

// Ready-made composites (spec/09 "Components"). Rows with a blurb, like
// Behaviour and Data: a composite's thumbnail is a grey wireframe of a layout,
// which shows its arrangement but not its job, so each says what it is for.
export function PaletteComponentsTab({ pendingDraw, actions }: TabProps) {
  return (
    <PaletteToolRows
      tiles={tilesInSection('components')}
      actions={actions}
      pendingDraw={pendingDraw}
    />
  );
}

// Wireframing device-frame primitives (browser / monitor / laptop / phone /
// tablet / smartwatch) — see spec/09 "Devices".
export function DevicePickerTab({ pendingDraw, actions }: TabProps) {
  return <PaletteTileGrid section="devices" actions={actions} pendingDraw={pendingDraw} />;
}
