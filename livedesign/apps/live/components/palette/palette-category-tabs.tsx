'use client';

// The palette's category tabs for one editor mode: each category of the mode's layout
// (palette-layouts) with the body it swaps in. Lifted out of the old CommandPalette, which was 562 lines with this inline as
// its largest single expression.
//
// A function rather than a const because two are SEARCHABLE catalogues (Icons, which holds the
// stickers too, and Technology) whose bodies need their query, results and add-handlers. The rest
// need only the shared pendingDraw + tile actions, so those two arrive as their own small bundles
// instead of loose parameters.
//
// Order IS layout: the category picker renders the dropdown straight from the layout's order,
// grouping by `group` under the CATEGORY_BANDS headings.

import { LibraryPaletteTab } from '@liveworkspace/workbench/components/library/LibraryPaletteTab';
import type { LibraryInsertItem } from '@liveworkspace/workbench/hooks/canvas/useLibraryItemInsert';
import { PaletteLogoTab } from './PaletteLogoTab';
import { PALETTE_CATEGORIES } from './palette-categories';
import { IconsCategoryTab } from '@/components/palette/IconsCategoryTab';
import { TechPickerTab } from '@/components/palette/TechPickerTab';
import {
  PaletteDataTab,
  PaletteMediaTab,
  PaletteDrawTab,
  PaletteBuildTab,
  PaletteWriteTab,
  PaletteShapesTab,
  PaletteComponentsTab,
} from '@/components/palette/palette-create-tabs';
import type { ComponentProps } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { PaletteTileGrid, type PaletteTileActions } from '@/components/palette/PaletteTileGrid';
import type { ResolvedPaletteCategory } from './palette-layouts';

// Deps are named exactly as the tab bodies' own props, and typed off those
// components, so the array below is verbatim from where it used to live and
// cannot drift from what each body actually accepts.
type IconDeps = Pick<
  ComponentProps<typeof IconsCategoryTab>,
  'addIcon' | 'addSticker' | 'iconResults' | 'stickerResults' | 'loading'
> & {
  // The Icons category's one query, over its icons and its stickers.
  iconQuery: string;
  setIconQuery: (q: string) => void;
};
type TechDeps = Pick<
  ComponentProps<typeof TechPickerTab>,
  'addTechIcon' | 'techQuery' | 'setTechQuery' | 'techResults'
>;

export { PALETTE_CATEGORIES };

export function paletteCategoryTabs(
  deps: {
    // The mode's palette layout, resolved (paletteCategoriesFor).
    categories: ResolvedPaletteCategory[];
    pendingDraw: PendingDraw | null | undefined;
    tileActions: PaletteTileActions;
    // Places an item from the Library.
    insertLibraryItem: (item: LibraryInsertItem<unknown>) => void;
  } & IconDeps &
    TechDeps,
) {
  const {
    categories,
    pendingDraw,
    tileActions,
    insertLibraryItem,
    addIcon,
    iconQuery,
    setIconQuery,
    iconResults,
    loading: iconCatalogsLoadedInverse,
    addSticker,
    stickerResults,
    addTechIcon,
    techQuery,
    setTechQuery,
    techResults,
  } = deps;
  // The Icons body takes `loading`; the caller holds the loaded flag.
  const iconCatalogsLoaded = !iconCatalogsLoadedInverse;
  // The body each category of the mode's layout swaps in. Which categories, in what order, under
  // what name and holding which tiles is the layout's call (palette-layouts, resolved by the
  // caller); a body decides only how its tiles are presented. A category with no body of its own
  // (Popular, or one a layout adds) is a plain tile grid.
  const tab = { pendingDraw, actions: tileActions };
  const bodyFor = (c: ResolvedPaletteCategory): React.ReactNode => {
    const tiles = c.tiles ?? [];
    switch (c.id) {
      case 'library':
        // The Library every app shares (liveworkspace/docs/specs/006-media/libraries.md).
        return <LibraryPaletteTab onInsert={insertLibraryItem} />;
      case 'icons':
        return (
          <IconsCategoryTab
            addIcon={addIcon}
            addSticker={addSticker}
            query={iconQuery}
            setQuery={setIconQuery}
            iconResults={iconResults}
            stickerResults={stickerResults}
            stickers={!!c.stickers}
            loading={!iconCatalogsLoaded}
          />
        );
      case 'technology':
        return (
          <TechPickerTab
            addTechIcon={addTechIcon}
            techQuery={techQuery}
            setTechQuery={setTechQuery}
            techResults={techResults}
            loading={!iconCatalogsLoaded}
          />
        );
      case 'shapes':
        return <PaletteShapesTab {...tab} tiles={tiles} />;
      case 'build':
        return <PaletteBuildTab {...tab} tiles={tiles} />;
      case 'write':
        return <PaletteWriteTab {...tab} tiles={tiles} />;
      case 'draw':
        // Logo's Draw holds this person's markers too, with their own flyouts (PaletteLogoTab).
        return tiles.some((t) => t.action.type === 'marker') ? (
          <PaletteLogoTab {...tab} tiles={tiles} />
        ) : (
          <PaletteDrawTab {...tab} tiles={tiles} />
        );
      case 'media':
        return <PaletteMediaTab {...tab} tiles={tiles} />;
      case 'components':
        return <PaletteComponentsTab {...tab} tiles={tiles} />;
      case 'data':
        return <PaletteDataTab {...tab} tiles={tiles} />;
      default:
        return <PaletteTileGrid {...tab} tiles={tiles} />;
    }
  };
  return categories.map((c) => ({ ...c, content: bodyFor(c) }));
}
