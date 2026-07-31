'use client';

import { type ReactNode, useRef, useState } from 'react';
import { PaletteSearchInput } from './PaletteSearchInput';
import { ToolsBreadcrumb, ToolsCategoryGrid, type ToolsCategory } from './palette-tools-nav';
import { track } from '@/lib/telemetry';

// The palette's drill-in browse pattern, once (spec/09 "Sub-categories",
// spec/109).
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
  // categories people open, and whether they search instead (spec/22).
  telemetry: { openedType: string; searchedType: string };
  emptyMessage: (query: string) => string;
  // True while an async catalogue chunk is still in flight. Without it an
  // empty grid reads as "nothing matches" when it means "not here yet".
  loading?: boolean;
  loadingMessage?: string;
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
  emptyMessage,
  loading = false,
  loadingMessage = 'Loading…',
}: Props<T>) {
  // null = the category grid. Opening the tab starts there, so you see every
  // category at once rather than one arbitrary group's contents.
  const [openId, setOpenId] = useState<string | null>(null);
  // One 'Searched' event per mount, on the first keystroke — the same
  // engagement-signal pattern as the editor's Search panel.
  const searchedRef = useRef(false);
  const q = query.trim();
  const matches = q ? search(q) : null;
  const openCategory = categories.find((c) => c.id === openId) ?? null;
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center">
        <PaletteSearchInput
          value={query}
          onChange={(next) => {
            onQueryChange(next);
            if (!searchedRef.current && next.trim()) {
              searchedRef.current = true;
              track('UI', 'Searched', telemetry.searchedType);
            }
          }}
          placeholder={searchInput.placeholder}
          ariaLabel={searchInput.ariaLabel}
          clearAriaLabel={searchInput.clearAriaLabel}
          clearDescription={searchInput.clearDescription}
        />
      </div>
      {loading ? (
        <p className="px-1 py-2 text-center text-[11px] text-slate-400">{loadingMessage}</p>
      ) : matches ? (
        // Searching cuts across categories, so it replaces the whole
        // navigation with one flat grid of hits — a breadcrumb would be lying
        // about where the results came from.
        matches.length > 0 ? (
          renderItems(matches)
        ) : (
          <p className="px-1 py-2 text-center text-[11px] text-slate-400">{emptyMessage(query)}</p>
        )
      ) : openCategory ? (
        <>
          <ToolsBreadcrumb root={root} label={openCategory.label} onBack={() => setOpenId(null)} />
          {renderItems(openCategory.items)}
        </>
      ) : (
        <ToolsCategoryGrid
          categories={categories}
          onOpen={(id) => {
            track('UI', 'Opened', telemetry.openedType);
            setOpenId(id);
          }}
        />
      )}
    </div>
  );
}
