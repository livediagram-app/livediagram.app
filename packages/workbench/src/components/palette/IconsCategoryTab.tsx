'use client';

import type { ReactNode } from 'react';
import type { StickerDef } from '@liveworkspace/icons';
import { SegmentedToggle, type SegmentedOption } from '@liveworkspace/ui';
import type { IconDef } from '../../lib/icon-types';
import { useLocalStorageValue, writeLocalStorageValue } from '../../hooks/ui/useLocalStorageValue';
import type { BrowserCategory, CategoryBrowser } from './category-browser-types';

// The palette's Icons category (docs/specs/008-canvas/canvas-and-palette.md "Icons category"): the line-art glyphs and
// the colour stickers in one category, an Icons | Stickers switch beside its search box picking which one it browses.
// One search looks through both, its results in two labelled groups, Icons first. A palette layout that offers no
// stickers (livediagram's Diagram, livedesign's Logo) shows the icons alone, with no switch.

export type IconsSide = 'icons' | 'stickers';

// The side last browsed, kept in this browser so the category reopens on it. A convenience: a refused or cleared
// storage only means it opens on Icons (useLocalStorageValue reads and writes inside try/catch).
export const ICONS_SIDE_KEY = 'palette:icons-side';

/** Which side the Icons category browses: the one last picked, Icons until then. */
export function useIconsSide(): IconsSide {
  return useLocalStorageValue(ICONS_SIDE_KEY) === 'stickers' ? 'stickers' : 'icons';
}

/** Turns the Icons category to a side, for every palette showing it. */
export function setIconsSide(side: IconsSide): void {
  writeLocalStorageValue(ICONS_SIDE_KEY, side);
}

/** The category to open for a request by id. Stickers is no longer a category of its own: a request for it (an old
 *  link, a tour, another surface) opens Icons on its Stickers side. */
export function openedPaletteCategory(id: string): string {
  if (id !== 'stickers') return id;
  setIconsSide('stickers');
  return 'icons';
}

const SIDES: readonly SegmentedOption<IconsSide>[] = [
  { value: 'icons', label: 'Icons', description: 'Single-colour glyphs that follow the theme.' },
  { value: 'stickers', label: 'Stickers', description: 'Colour emoji and word badges.' },
];

type Entry = IconDef | StickerDef;
// A sticker carries its flavour (`kind`); an icon is its primitives.
const isSticker = (entry: Entry): entry is StickerDef => 'kind' in entry;
const isIcon = (entry: Entry): entry is IconDef => !isSticker(entry);

// What an editor hands the category: its browse, and the two catalogues' grids and groups (its IconPickerTab and
// StickerPickerTab bindings).
export type IconsCategoryDeps = {
  PaletteCategoryBrowser: CategoryBrowser;
  IconGrid: (props: {
    icons: IconDef[];
    addIcon: (iconId: string) => void;
    bounded?: boolean;
  }) => ReactNode;
  StickerGrid: (props: {
    stickers: StickerDef[];
    addSticker: (stickerId: string) => void;
    bounded?: boolean;
  }) => ReactNode;
  iconBrowseGroups: () => BrowserCategory<IconDef>[];
  stickerBrowseGroups: () => BrowserCategory<StickerDef>[];
};

// A labelled group of search results, headed as the category flyout's own groups are.
function ResultGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-1.5">
      <h4 className="flex items-center gap-2 px-1 pt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        {title}
        <span aria-hidden className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
      </h4>
      {children}
    </section>
  );
}

/** The palette's Icons category, made once per editor at module scope. */
export function createIconsCategoryTab({
  PaletteCategoryBrowser,
  IconGrid,
  StickerGrid,
  iconBrowseGroups,
  stickerBrowseGroups,
}: IconsCategoryDeps) {
  function IconsCategoryTab({
    addIcon,
    addSticker,
    query,
    setQuery,
    iconResults,
    stickerResults,
    stickers,
    loading = false,
  }: {
    addIcon: (iconId: string) => void;
    addSticker: (stickerId: string) => void;
    // The one query both catalogues are searched with.
    query: string;
    setQuery: (q: string) => void;
    // Every icon and every sticker matching it, each across all its groups.
    iconResults: IconDef[];
    stickerResults: StickerDef[];
    // Whether this palette offers stickers: without them there is no switch and nothing but icons.
    stickers: boolean;
    // The catalogue chunk is still loading (useIconCatalogs).
    loading?: boolean;
  }) {
    const stored = useIconsSide();
    const side: IconsSide = stickers ? stored : 'icons';
    const searching = query.trim() !== '';
    const categories: BrowserCategory<Entry>[] =
      side === 'stickers' ? stickerBrowseGroups() : iconBrowseGroups();
    const renderItems = (items: Entry[]): ReactNode => {
      const icons = items.filter(isIcon);
      const found = items.filter(isSticker);
      if (!searching || !stickers)
        return side === 'stickers' ? (
          <StickerGrid stickers={found} addSticker={addSticker} />
        ) : (
          <IconGrid icons={icons} addIcon={addIcon} />
        );
      // Both catalogues answer a search, Icons first; a group with no match is left out.
      return (
        <div className="flex flex-col gap-3">
          {icons.length > 0 ? (
            <ResultGroup title="Icons">
              <IconGrid icons={icons} addIcon={addIcon} bounded={false} />
            </ResultGroup>
          ) : null}
          {found.length > 0 ? (
            <ResultGroup title="Stickers">
              <StickerGrid stickers={found} addSticker={addSticker} bounded={false} />
            </ResultGroup>
          ) : null}
        </div>
      );
    };
    return (
      <PaletteCategoryBrowser<Entry>
        // Each side keeps its own open group (BrowseMemory, by root) and its own breadcrumb.
        key={side}
        root={side === 'stickers' ? 'Stickers' : 'Icons'}
        categories={categories}
        // The parent already searched both catalogues for this query.
        search={() => (stickers ? [...iconResults, ...stickerResults] : iconResults)}
        renderItems={renderItems}
        query={query}
        onQueryChange={setQuery}
        searchInput={
          stickers
            ? {
                placeholder: 'Search icons and stickers',
                ariaLabel: 'Search icons and stickers',
                clearAriaLabel: 'Clear the icon and sticker search',
                clearDescription: 'Clear the search over icons and stickers.',
              }
            : {
                placeholder: 'Search icons',
                ariaLabel: 'Search icons',
                clearAriaLabel: 'Clear icon search',
                clearDescription: 'Clear the icon search query.',
              }
        }
        // The names each catalogue's browse always counted under, so the charts read on.
        telemetry={
          side === 'stickers'
            ? { openedType: 'StickerGroup', searchedType: 'StickerSearch' }
            : { openedType: 'IconGroup', searchedType: 'IconSearch' }
        }
        // The groups' rail is named for the side ("stickers groups"); a search over both says so when it misses.
        things={searching && stickers ? 'icons or stickers' : side}
        loading={loading}
        loadingMessage={side === 'stickers' ? 'Loading stickers…' : 'Loading icons…'}
        searchAccessory={
          stickers ? (
            <SegmentedToggle
              label="Browse"
              value={side}
              onChange={setIconsSide}
              options={SIDES}
              className="shrink-0"
            />
          ) : undefined
        }
      />
    );
  }

  return { IconsCategoryTab };
}
