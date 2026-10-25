'use client';

import { createContext, type ReactNode, useContext, useMemo, useRef, useState } from 'react';
import { NoMatches } from '@livediagram/ui';
import { SearchInput } from '@liveworkspace/workbench/components/primitives/SearchInput';
import {
  ToolsBreadcrumb,
  ToolsCategoryGrid,
  type ToolsCategory,
} from '@liveworkspace/workbench/components/palette/palette-tools-nav';
import { track } from '@/lib/telemetry';
import { PaletteCategoryRail } from './PaletteCategoryRail';

// The palette's drill-in browse pattern, once (docs/specs/008-canvas/canvas-and-palette.md "Sub-categories",
// docs/specs/010-palette/palette-category-browse.md).
//
// Three tabs hold a catalogue too big for one screen — Tools (~25 tiles),
// Icons (183 glyphs), Technology (brand marks) — and all three answer the
// same question the same way: a grid of category tiles, click one to see its
// contents, breadcrumb back, and a search box that cuts across every category
// at once. Tools grew that navigation first; Icons and Technology were still
// on a flat scrolling grid behind a filter dropdown, which hid the catalogue's
// shape behind a control you had to open to read.
//
// So the navigation lives here rather than three times over. The tabs supply
// their catalogue and their tile rendering; nothing about a glyph, a tool
// tile or a brand mark leaks in.

export type BrowserCategory<T> = ToolsCategory & { items: T[] };

// The group a browse opens on, when its host opened it from one: the Toolbar strip's group tiles for Icons, Stickers
// and Technology (docs/specs/007-editor/toolbar-layout.md "More"). Null opens the group grid. Read as the browse mounts,
// so a host shows another group by remounting it. `bare` shows the group's entries alone, without the search or the
// breadcrumb: the strip's group popover, where the strip itself is the way between groups.
export const BrowseStartGroup = createContext<{ id: string; bare: boolean } | null>(null);

// The group each browse last had open, by its root ("Icons", "Tech"), for a host that unmounts the browse between
// visits (the Toolbar strip's popovers): going back to Icons reopens the group you left it on, rather than the grid.
// The host keeps it for the page load; no host means every visit starts on the grid. A query is not kept.
type BrowseMemory = {
  get: (root: string) => string | null;
  set: (root: string, group: string | null) => void;
};
export const BrowseMemoryContext = createContext<BrowseMemory | null>(null);

/** A browse memory for the page load. Stable across renders, so it never re-renders its consumers. */
export function useBrowseMemory(): BrowseMemory {
  const groups = useRef(new Map<string, string | null>());
  return useMemo(
    () => ({
      get: (root) => groups.current.get(root) ?? null,
      set: (root, group) => void groups.current.set(root, group),
    }),
    [],
  );
}

// How a browse lays itself out: the drill-in grid (a category tile per group, a breadcrumb back), or the two-pane
// rail (PaletteCategoryRail) the category bar's flyouts use, with every group in view down the side.
export const BrowseLayoutContext = createContext<'grid' | 'rail'>('grid');

type Props<T> = {
  // Breadcrumb root — the tab's own name, so "Icons › People" reads true.
  root: string;
  categories: BrowserCategory<T>[];
  // Cross-category search. Owned by the caller because a tool matches on its
  // caption and an icon on its keywords, and neither belongs here.
  search: (query: string) => T[];
  renderItems: (items: T[]) => ReactNode;
  query: string;
  onQueryChange: (query: string) => void;
  searchInput: {
    placeholder: string;
    ariaLabel: string;
    clearAriaLabel: string;
    clearDescription: string;
  };
  // Telemetry `type` tokens for the two interactions worth counting: which
  // categories people open, and whether they search instead (docs/specs/017-telemetry/telemetry.md).
  telemetry: { openedType: string; searchedType: string };
  // What the catalogue holds, plural and lowercase ("icons"), for its no-match empty state.
  things: string;
  // True while an async catalogue chunk is still in flight. Without it an
  // empty grid reads as "nothing matches" when it means "not here yet".
  loading?: boolean;
  loadingMessage?: string;
  // Content shown ABOVE the category grid, on the root screen only. For a
  // catalogue with a tile or two that belong to no group and are reached for
  // often enough that burying them in a category would cost more than the
  // tidiness is worth (the Collaborate tab's comment panel). Hidden while
  // drilled in or searching, where it would be answering a question nobody
  // asked.
  rootLeadIn?: ReactNode;
};

export function PaletteCategoryBrowser<T>({
  root,
  categories,
  search,
  renderItems,
  query,
  onQueryChange,
  searchInput,
  telemetry,
  things,
  loading = false,
  loadingMessage = 'Loading…',
  rootLeadIn,
}: Props<T>) {
  // null = the category grid. Opening the tab starts there, so you see every
  // category at once rather than one arbitrary group's contents; a strip's group tile opens on its group.
  // A host's remembered group comes next (BrowseMemory).
  const startGroup = useContext(BrowseStartGroup);
  const memory = useContext(BrowseMemoryContext);
  const [openId, setOpenIdState] = useState<string | null>(
    startGroup?.id ?? memory?.get(root) ?? null,
  );
  const setOpenId = (id: string | null) => {
    setOpenIdState(id);
    // A bare group popover is the strip's own way between groups, not a visit to remember.
    if (!startGroup?.bare) memory?.set(root, id);
  };
  // One 'Searched' event per mount, on the first keystroke — the same
  // engagement-signal pattern as the editor's Search panel.
  const searchedRef = useRef(false);
  const q = query.trim();
  const matches = q ? search(q) : null;
  const openCategory = categories.find((c) => c.id === openId) ?? null;
  const layout = useContext(BrowseLayoutContext);
  if (startGroup?.bare && openCategory) return <>{renderItems(openCategory.items)}</>;
  const onSearch = (next: string) => {
    onQueryChange(next);
    if (!searchedRef.current && next.trim()) {
      searchedRef.current = true;
      track('UI', 'Searched', telemetry.searchedType);
    }
  };
  if (layout === 'rail')
    return (
      <PaletteCategoryRail
        categories={categories}
        openId={openId}
        onOpen={(id) => {
          if (id !== openId) track('UI', 'Opened', telemetry.openedType);
          setOpenId(id);
        }}
        renderItems={renderItems}
        query={query}
        onQueryChange={onSearch}
        matches={matches}
        search={searchInput}
        things={things}
        loading={loading}
        loadingMessage={loadingMessage}
      />
    );
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center">
        <SearchInput
          value={query}
          onChange={onSearch}
          placeholder={searchInput.placeholder}
          ariaLabel={searchInput.ariaLabel}
          clearAriaLabel={searchInput.clearAriaLabel}
          clearDescription={searchInput.clearDescription}
        />
      </div>
      {loading ? (
        <p className="px-1 py-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
          {loadingMessage}
        </p>
      ) : matches ? (
        // Searching cuts across categories, so it replaces the whole
        // navigation with one flat grid of hits — a breadcrumb would be lying
        // about where the results came from.
        matches.length > 0 ? (
          renderItems(matches)
        ) : (
          <NoMatches things={things} query={query} onClear={() => onQueryChange('')} />
        )
      ) : openCategory ? (
        <>
          <ToolsBreadcrumb root={root} label={openCategory.label} onBack={() => setOpenId(null)} />
          {renderItems(openCategory.items)}
        </>
      ) : (
        <>
          {rootLeadIn}
          <ToolsCategoryGrid
            categories={categories}
            onOpen={(id) => {
              track('UI', 'Opened', telemetry.openedType);
              setOpenId(id);
            }}
          />
        </>
      )}
    </div>
  );
}
