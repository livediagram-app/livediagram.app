'use client';

// The palette's category tabs for one editor mode: each category of the mode's layout
// (palette-layouts) with the body it swaps in. Lifted out of CommandPalette, which was 562 lines with this inline as
// its largest single expression.
//
// A function rather than a const because three of the fourteen are SEARCHABLE
// catalogues (Icons, Stickers, Technology) whose bodies need that catalogue's
// query, results and add-handler. The rest need only the shared pendingDraw +
// tile actions, so those three arrive as their own small bundles instead of
// nine loose parameters.
//
// Order IS layout: PaletteTabBar renders the dropdown straight from the layout's order,
// grouping by `group` under the CATEGORY_BANDS headings.

import { PALETTE_CATEGORIES } from './palette-categories';
import { PaletteMyShapesTab } from './PaletteMyShapesTab';
import type { ShapeLibraryItem } from '@livediagram/api-schema';
import { IconPickerTab } from '@/components/palette/IconPickerTab';
import { StickerPickerTab } from '@/components/palette/StickerPickerTab';
import { TechPickerTab } from '@/components/palette/TechPickerTab';
import {
  DevicePickerTab,
  PaletteBehaviourTab,
  PaletteDataTab,
  PaletteMediaTab,
  PaletteDrawTab,
  PaletteBuildTab,
  PaletteWriteTab,
  PaletteEventStormingTab,
  PaletteShapesTab,
  PaletteComponentsTab,
} from '@/components/palette/palette-create-tabs';
import type { ComponentProps } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { PaletteTileGrid, type PaletteTileActions } from '@/components/palette/PaletteTileGrid';
import { PalettePlanCardsTab } from './PalettePlanCardsTab';
import type { ResolvedPaletteCategory } from './palette-layouts';
import type { EsBoardControls } from '@/components/palette/EventStormingBoardRows';

// Deps are named exactly as the tab bodies' own props, and typed off those
// components, so the array below is verbatim from where it used to live and
// cannot drift from what each body actually accepts.
type IconDeps = Pick<
  ComponentProps<typeof IconPickerTab>,
  'addIcon' | 'iconQuery' | 'setIconQuery' | 'iconResults' | 'loading'
>;
type StickerDeps = Pick<
  ComponentProps<typeof StickerPickerTab>,
  'addSticker' | 'stickerQuery' | 'setStickerQuery' | 'stickerResults'
>;
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
    // Board-level switches for the Event Storming category (docs/specs/021-event-storming/event-storming.md),
    // supplied only when the active tab IS one of those boards.
    esBoardControls?: EsBoardControls;
    // Places a shape from My shapes (docs/specs/013-workspace/shape-libraries.md).
    insertLibraryShape: (item: ShapeLibraryItem) => void;
  } & IconDeps &
    StickerDeps &
    TechDeps,
) {
  const {
    categories,
    pendingDraw,
    tileActions,
    esBoardControls,
    insertLibraryShape,
    addIcon,
    iconQuery,
    setIconQuery,
    iconResults,
    loading: iconCatalogsLoadedInverse,
    addSticker,
    stickerQuery,
    setStickerQuery,
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
      case 'my-shapes':
        return <PaletteMyShapesTab onInsert={insertLibraryShape} />;
      case 'icons':
        return (
          <IconPickerTab
            addIcon={addIcon}
            iconQuery={iconQuery}
            setIconQuery={setIconQuery}
            iconResults={iconResults}
            loading={!iconCatalogsLoaded}
          />
        );
      case 'stickers':
        return (
          <StickerPickerTab
            addSticker={addSticker}
            stickerQuery={stickerQuery}
            setStickerQuery={setStickerQuery}
            stickerResults={stickerResults}
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
        return <PaletteDrawTab {...tab} tiles={tiles} />;
      case 'devices':
        return <DevicePickerTab {...tab} tiles={tiles} />;
      case 'event-storming':
        return <PaletteEventStormingTab {...tab} tiles={tiles} board={esBoardControls} />;
      case 'media':
        return <PaletteMediaTab {...tab} tiles={tiles} />;
      case 'components':
        return <PaletteComponentsTab {...tab} tiles={tiles} />;
      case 'data':
        return <PaletteDataTab {...tab} tiles={tiles} />;
      case 'behaviour':
        return <PaletteBehaviourTab {...tab} tiles={tiles} />;
      // Plan mode's cards follow the document's item types
      // (docs/specs/025-plan/item-types.md "Where types show").
      case 'plan-cards':
        return <PalettePlanCardsTab {...tab} />;
      default:
        return <PaletteTileGrid {...tab} tiles={tiles} />;
    }
  };
  return categories.map((c) => ({ ...c, content: bodyFor(c) }));
}
