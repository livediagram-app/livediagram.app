'use client';

import { useRef, useState } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { PaletteTileGrid, type PaletteTileActions } from './PaletteTileGrid';
import { PaletteToolRows } from './PaletteToolRows';
import { ToolsBreadcrumb, ToolsCategoryGrid } from './palette-tools-nav';
import { PaletteSearchInput } from './PaletteSearchInput';
import { TOOL_GROUPS, tilesInSection, tilesInToolGroup } from './palette-tile-defs';
import { track } from '@/lib/telemetry';

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
  const sections: {
    id: string;
    label: string;
    description: string;
    tiles?: ReturnType<typeof tilesInToolGroup>;
  }[] = [
    ...TOOL_GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      description: g.description,
      tiles: tilesInToolGroup(g.id),
    })),
    {
      id: 'data',
      label: 'Data',
      description: 'Charts and meters: pie, bar and line charts, progress bars and rings, ratings.',
    },
  ];
  // null = the category grid. Starts there, so opening Tools shows every
  // category at once rather than one arbitrary group's contents.
  const [openId, setOpenId] = useState<string | null>(null);
  // Search across the grouped tools (spec/09 "Sub-categories"): the
  // accordions keep the tab one glance tall but hide most tiles, so a
  // search box (mirroring the Icons / Technology pickers) surfaces any
  // tool by name without knowing its group. A non-empty query swaps the
  // accordions for one flat grid of matches across every group + Data.
  const [query, setQuery] = useState('');
  // One 'Searched' event per mount, on the first keystroke — same
  // engagement-signal pattern as the editor's Search panel.
  const searchedRef = useRef(false);
  const q = query.trim().toLowerCase();
  const matches = q
    ? [...tilesInSection('tools'), ...tilesInSection('data')].filter((t) =>
        [t.label, t.caption ?? '', t.description].some((s) => s.toLowerCase().includes(q)),
      )
    : null;
  const openCategory = (id: string) => {
    track('UI', 'Opened', 'ToolGroup');
    setOpenId(id);
  };
  const openSection = sections.find((s) => s.id === openId) ?? null;
  // Category artwork = the group's first tile, so a category always looks like
  // what it holds. Data's tiles come from its own catalogue section.
  const categories = sections.map((section) => {
    const tiles = section.tiles ?? tilesInSection('data');
    return {
      id: section.id,
      label: section.label,
      icon: tiles[0]?.icon ?? null,
      description: section.description,
    };
  });
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center">
        <PaletteSearchInput
          value={query}
          onChange={(next) => {
            setQuery(next);
            if (!searchedRef.current && next.trim()) {
              searchedRef.current = true;
              track('UI', 'Searched', 'ToolSearch');
            }
          }}
          placeholder="Search tools"
          ariaLabel="Search tools"
          clearAriaLabel="Clear tool search"
          clearDescription="Clear the tool search query."
        />
      </div>
      {matches ? (
        // Searching cuts across categories, so it replaces the whole navigation
        // with one flat grid of hits — the breadcrumb would be lying.
        matches.length > 0 ? (
          <PaletteToolRows tiles={matches} actions={actions} pendingDraw={pendingDraw} />
        ) : (
          <p className="px-1 py-2 text-center text-[11px] text-slate-400">
            No tools match “{query}”.
          </p>
        )
      ) : openSection ? (
        <>
          <ToolsBreadcrumb label={openSection.label} onBack={() => setOpenId(null)} />
          <PaletteToolRows
            tiles={openSection.tiles ?? tilesInSection('data')}
            actions={actions}
            pendingDraw={pendingDraw}
          />
        </>
      ) : (
        <ToolsCategoryGrid categories={categories} onOpen={openCategory} />
      )}
    </div>
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
