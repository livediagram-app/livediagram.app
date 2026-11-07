'use client';

// The palette's category tabs for one editor mode: each category of the mode's layout
// (palette-layouts) with the body it swaps in. Lifted out of the old CommandPalette, which was 562 lines with this inline as
// its largest single expression.
//
// A function rather than a const because one category is a SEARCHABLE catalogue
// (Stickers) whose body needs that catalogue's query, results and add-handler. The
// rest need only the shared pendingDraw + tile actions, so the catalogue's arrive as
// their own small bundle. No Icons (docs/specs/002-project-scope/not-in-livehuddle.md "Icons").
//
// Order IS layout: the category picker renders the dropdown straight from the layout's order,
// grouping by `group` under the CATEGORY_BANDS headings.

import { PALETTE_CATEGORIES } from './palette-categories';
import { StickerPickerTab } from '@/components/palette/StickerPickerTab';
import {
  PaletteCollaborateTab,
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
import { COLLABORATE_CATEGORY_GROUPS } from './palette-tile-defs';

// Deps are named exactly as the tab bodies' own props, and typed off those
// components, so the array below is verbatim from where it used to live and
// cannot drift from what each body actually accepts.
type StickerDeps = Pick<
  ComponentProps<typeof StickerPickerTab>,
  'addSticker' | 'stickerQuery' | 'setStickerQuery' | 'stickerResults' | 'loading'
>;

export { PALETTE_CATEGORIES };

export function paletteCategoryTabs(
  deps: {
    // The mode's palette layout, resolved (paletteCategoriesFor).
    categories: ResolvedPaletteCategory[];
    pendingDraw: PendingDraw | null | undefined;
    tileActions: PaletteTileActions;
  } & StickerDeps,
) {
  const {
    categories,
    pendingDraw,
    tileActions,
    loading,
    addSticker,
    stickerQuery,
    setStickerQuery,
    stickerResults,
  } = deps;
  // The body each category of the mode's layout swaps in. Which categories, in what order, under
  // what name and holding which tiles is the layout's call (palette-layouts, resolved by the
  // caller); a body decides only how its tiles are presented. A category with no body of its own
  // (Popular, or one a layout adds) is a plain tile grid.
  const tab = { pendingDraw, actions: tileActions };
  const bodyFor = (c: ResolvedPaletteCategory): React.ReactNode => {
    const tiles = c.tiles ?? [];
    switch (c.id) {
      case 'stickers':
        return (
          <StickerPickerTab
            addSticker={addSticker}
            stickerQuery={stickerQuery}
            setStickerQuery={setStickerQuery}
            stickerResults={stickerResults}
            loading={loading}
          />
        );
      case 'shapes':
        return <PaletteShapesTab {...tab} tiles={tiles} />;
      case 'build':
        return <PaletteBuildTab {...tab} tiles={tiles} />;
      case 'write':
        return <PaletteWriteTab {...tab} tiles={tiles} />;
      case 'draw':
        return <PaletteDrawTab {...tab} tiles={tiles} />;
      case 'media':
        return <PaletteMediaTab {...tab} tiles={tiles} />;
      case 'components':
        return <PaletteComponentsTab {...tab} tiles={tiles} />;
      default:
        // The meeting categories (the Space categories and Selection Mode) by their group, so a new one needs no case.
        return c.id in COLLABORATE_CATEGORY_GROUPS ? (
          <PaletteCollaborateTab {...tab} tiles={tiles} />
        ) : (
          <PaletteTileGrid {...tab} tiles={tiles} />
        );
    }
  };
  return categories.map((c) => ({ ...c, content: bodyFor(c) }));
}
