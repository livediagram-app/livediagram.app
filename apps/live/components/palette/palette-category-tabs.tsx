'use client';

// The palette's category catalogue: which categories exist, in band order,
// each with the label, blurb and icon the picker draws and the body it swaps
// in. Lifted out of CommandPalette, which was 562 lines with this inline as
// its largest single expression.
//
// A function rather than a const because three of the fourteen are SEARCHABLE
// catalogues (Icons, Stickers, Technology) whose bodies need that catalogue's
// query, results and add-handler. The rest need only the shared pendingDraw +
// tile actions, so those three arrive as their own small bundles instead of
// nine loose parameters.
//
// Order IS layout: PaletteTabBar renders the dropdown straight from this
// array, grouping by `group` under the CATEGORY_BANDS headings (0 Common,
// 1 Decorate, 2 Dynamic).

import { PALETTE_CATEGORIES } from './palette-categories';
import { IconPickerTab } from '@/components/palette/IconPickerTab';
import { StickerPickerTab } from '@/components/palette/StickerPickerTab';
import { TechPickerTab } from '@/components/palette/TechPickerTab';
import {
  DevicePickerTab,
  PaletteBehaviourTab,
  PaletteCollaborateTab,
  PaletteDataTab,
  PaletteMediaTab,
  PaletteDrawTab,
  PaletteBuildTab,
  PaletteWriteTab,
  PaletteShapesTab,
  PaletteComponentsTab,
} from '@/components/palette/palette-create-tabs';
import { PaletteFavouritesTab } from '@/components/palette/PaletteFavouritesTab';
import type { ComponentProps } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import type { PaletteTileActions } from '@/components/palette/PaletteTileGrid';

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
    pendingDraw: PendingDraw | null | undefined;
    tileActions: PaletteTileActions;
  } & IconDeps &
    StickerDeps &
    TechDeps,
) {
  const {
    pendingDraw,
    tileActions,
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
  // Bodies only. The identity of each category (label, blurb, glyph,
  // band) lives in PALETTE_CATEGORIES above and is zipped on below, so
  // adding a category is one edit rather than two that can disagree.
  const content: Record<string, React.ReactNode> = {
    favourites: <PaletteFavouritesTab pendingDraw={pendingDraw} actions={tileActions} />,
    shapes: <PaletteShapesTab pendingDraw={pendingDraw} actions={tileActions} />,
    build: <PaletteBuildTab pendingDraw={pendingDraw} actions={tileActions} />,
    write: <PaletteWriteTab pendingDraw={pendingDraw} actions={tileActions} />,
    draw: <PaletteDrawTab pendingDraw={pendingDraw} actions={tileActions} />,
    devices: <DevicePickerTab pendingDraw={pendingDraw} actions={tileActions} />,
    icons: (
      <IconPickerTab
        addIcon={addIcon}
        iconQuery={iconQuery}
        setIconQuery={setIconQuery}
        iconResults={iconResults}
        loading={!iconCatalogsLoaded}
      />
    ),
    stickers: (
      <StickerPickerTab
        addSticker={addSticker}
        stickerQuery={stickerQuery}
        setStickerQuery={setStickerQuery}
        stickerResults={stickerResults}
        loading={!iconCatalogsLoaded}
      />
    ),
    technology: (
      <TechPickerTab
        addTechIcon={addTechIcon}
        techQuery={techQuery}
        setTechQuery={setTechQuery}
        techResults={techResults}
        loading={!iconCatalogsLoaded}
      />
    ),
    media: <PaletteMediaTab pendingDraw={pendingDraw} actions={tileActions} />,
    components: <PaletteComponentsTab pendingDraw={pendingDraw} actions={tileActions} />,
    data: <PaletteDataTab pendingDraw={pendingDraw} actions={tileActions} />,
    behaviour: <PaletteBehaviourTab pendingDraw={pendingDraw} actions={tileActions} />,
    collaborate: <PaletteCollaborateTab pendingDraw={pendingDraw} actions={tileActions} />,
  };
  return PALETTE_CATEGORIES.map((c) => ({ ...c, content: content[c.id] }));
}
