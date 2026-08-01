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

import { IconPickerTab } from '@/components/palette/IconPickerTab';
import { StickerPickerTab } from '@/components/palette/StickerPickerTab';
import { TechPickerTab } from '@/components/palette/TechPickerTab';
import {
  BehaviourTabIcon,
  CollaborateTabIcon,
  ComponentsTabIcon,
  DataTabIcon,
  DevicesTabIcon,
  MediaTabIcon,
  FavouritesTabIcon,
  IconsTabIcon,
  BuildTabIcon,
  ShapesTabIcon,
  StickersTabIcon,
  TechTabIcon,
  DrawTabIcon,
  WriteTabIcon,
} from './palette-tab-icons';
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
  return [
    {
      id: 'favourites',
      label: 'Favourites',
      // No band: it is every category at once, so it spans the row
      // above the first heading rather than sitting under one.
      fullWidth: true,
      description:
        'Your go-to tiles from every category in one grid. Edit to add or remove controls.',
      icon: <FavouritesTabIcon />,
      content: <PaletteFavouritesTab pendingDraw={pendingDraw} actions={tileActions} />,
    },
    {
      id: 'shapes',
      label: 'Shapes',
      group: 0,
      description: 'Square, circle, diamond, and the flowchart shape vocabulary.',
      icon: <ShapesTabIcon />,
      content: <PaletteShapesTab pendingDraw={pendingDraw} actions={tileActions} />,
    },
    {
      id: 'build',
      label: 'Build',
      group: 0,
      description: 'The structural elements: mind nodes, lanes, frames, timelines, and tables.',
      icon: <BuildTabIcon />,
      content: <PaletteBuildTab pendingDraw={pendingDraw} actions={tileActions} />,
    },
    {
      id: 'write',
      label: 'Write',
      group: 0,
      description: 'The wordy elements: pages, text, sticky notes, and annotations.',
      icon: <WriteTabIcon />,
      content: <PaletteWriteTab pendingDraw={pendingDraw} actions={tileActions} />,
    },
    {
      id: 'draw',
      label: 'Draw',
      group: 0,
      description: 'The gesture tools: pencil, highlighter, polygon, and arrows.',
      icon: <DrawTabIcon />,
      content: <PaletteDrawTab pendingDraw={pendingDraw} actions={tileActions} />,
    },
    {
      id: 'devices',
      label: 'Devices',
      group: 0,
      description:
        'Wireframing device frames: browser, monitor, laptop, phone, tablet, smartwatch.',
      icon: <DevicesTabIcon />,
      content: <DevicePickerTab pendingDraw={pendingDraw} actions={tileActions} />,
    },
    {
      id: 'icons',
      label: 'Icons',
      group: 1,
      description: 'Searchable catalogue of single-colour glyphs.',
      icon: <IconsTabIcon />,
      content: (
        <IconPickerTab
          addIcon={addIcon}
          iconQuery={iconQuery}
          setIconQuery={setIconQuery}
          iconResults={iconResults}
          loading={!iconCatalogsLoaded}
        />
      ),
    },
    {
      id: 'stickers',
      label: 'Stickers',
      group: 1,
      description:
        'Colour emoji for reacting, showing how you feel, marking status, pointing at things, celebrating, and prettying the board up.',
      icon: <StickersTabIcon />,
      content: (
        <StickerPickerTab
          addSticker={addSticker}
          stickerQuery={stickerQuery}
          setStickerQuery={setStickerQuery}
          stickerResults={stickerResults}
          loading={!iconCatalogsLoaded}
        />
      ),
    },
    {
      id: 'technology',
      label: 'Tech',
      group: 1,
      description:
        'Full-colour AWS, Azure, and generic-infrastructure icons for system-architecture diagrams.',
      icon: <TechTabIcon />,
      content: (
        <TechPickerTab
          addTechIcon={addTechIcon}
          techQuery={techQuery}
          setTechQuery={setTechQuery}
          techResults={techResults}
          loading={!iconCatalogsLoaded}
        />
      ),
    },
    {
      id: 'media',
      label: 'Media',
      group: 1,
      description: 'Pictures and figures: an uploaded image, or a circular avatar.',
      icon: <MediaTabIcon />,
      content: <PaletteMediaTab pendingDraw={pendingDraw} actions={tileActions} />,
    },
    {
      id: 'components',
      label: 'Components',
      group: 1,
      description:
        'Ready-made composites that follow the tab theme: Banner, Hero, and Header. Each drops as a group you can recolour, retitle, or ungroup.',
      icon: <ComponentsTabIcon />,
      content: <PaletteComponentsTab pendingDraw={pendingDraw} actions={tileActions} />,
    },
    {
      id: 'data',
      label: 'Data',
      group: 2,
      description:
        'Charts and meters: pie, bar and line charts, progress bars and rings, and ratings.',
      icon: <DataTabIcon />,
      content: <PaletteDataTab pendingDraw={pendingDraw} actions={tileActions} />,
    },
    {
      id: 'behaviour',
      label: 'Behaviour',
      group: 2,
      description:
        'Elements that do something when somebody interacts with them: Selection Mode buttons, Portals, Session buttons, Reveal zones, and Pickers.',
      icon: <BehaviourTabIcon />,
      content: <PaletteBehaviourTab pendingDraw={pendingDraw} actions={tileActions} />,
    },
    {
      // Collaborate (spec/123 to spec/129): the elements that collect
      // what the room thinks. Dynamic band, beside Behaviour — both
      // hold elements whose content arrives at runtime rather than
      // being drawn by the author.
      id: 'collaborate',
      label: 'Collaborate',
      group: 2,
      description:
        'Elements that collect what the room thinks: estimate cards, temperature checks, idea boxes, agendas, decision records, and roll calls.',
      icon: <CollaborateTabIcon />,
      content: <PaletteCollaborateTab pendingDraw={pendingDraw} actions={tileActions} />,
    },
  ];
}
