// The eight steps of the interactive editor tour (spec/79), in palette →
// explorer → canvas → tabs order. Each step names its anchor (`target`, a
// data-tour-id) and drives the real chrome in `prepare` (opening the panel
// / dropdown / menu it explains) through the TourApi facade TourHost
// builds. `cleanup` undoes whatever prepare opened, and runs on every exit
// path (Next, Back, Skip, finish) so the tour never strands an open menu.

import { clickTour, expandPanelIfCollapsed, findTour, waitForSelector } from './tour-dom';

// What a step gets to work with. Built fresh by TourHost so editor-context
// handlers are never stale.
export type TourApi = {
  // Mobile viewport OR the minimal-panels preference: panels live behind
  // the dock button row, so steps open them by tapping dock buttons.
  compact: boolean;
  // Select an element for the context-menu step, adding a theme-coloured
  // square at the viewport centre when the tab is empty. Resolves once the
  // element's menu is open (or null if it couldn't be).
  openElementContextMenu: () => Promise<void>;
  closeContextMenu: () => void;
};

export type TourStep = {
  id: string;
  title: string;
  body: string;
  // data-tour-id of the element the popover anchors to + highlights.
  target: string;
  prepare?: (api: TourApi) => void | Promise<void>;
  cleanup?: (api: TourApi) => void;
};

// Bring the palette on screen whatever the layout: dock tap on compact,
// banner-expand on desktop. Waits for the panel node so callers can chain.
async function ensurePaletteOpen(api: TourApi) {
  if (api.compact) {
    if (!findTour('palette')) clickTour('dock-palette');
  } else {
    expandPanelIfCollapsed('palette', 'Palette');
  }
  await waitForSelector('[data-tour-id="palette"]');
}

const closeDropdown = (menuId: string, triggerId: string) => {
  if (findTour(menuId)) clickTour(triggerId);
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'palette',
    title: 'The Palette',
    body: 'Every element starts here: shapes, tools, components, icons, and more. Click a tile to draw it onto the canvas.',
    target: 'palette',
    prepare: ensurePaletteOpen,
  },
  {
    id: 'selection-modes',
    title: 'Selection modes',
    body: 'This dropdown switches what your pointer does: Select, Hand to pan, Eraser, and more. Select is the everyday default.',
    target: 'canvas-tool-menu',
    prepare: async (api) => {
      await ensurePaletteOpen(api);
      if (!findTour('canvas-tool-menu')) clickTour('canvas-tool');
    },
    cleanup: () => closeDropdown('canvas-tool-menu', 'canvas-tool'),
  },
  {
    id: 'categories',
    title: 'Shape categories',
    body: 'The palette is organised into categories. Shapes is home base; switch here for Tools, Components, Devices, Icons, and Technology.',
    target: 'palette-category-menu',
    prepare: async (api) => {
      await ensurePaletteOpen(api);
      closeDropdown('canvas-tool-menu', 'canvas-tool');
      if (!findTour('palette-category-menu')) clickTour('palette-category');
    },
    cleanup: () => closeDropdown('palette-category-menu', 'palette-category'),
  },
  {
    id: 'tools',
    title: 'The Tools category',
    body: 'Text, sticky notes, the pencil, arrows, tables, images, and charts all live in Tools. Tap one to drop it on the canvas.',
    target: 'palette',
    prepare: async (api) => {
      await ensurePaletteOpen(api);
      // Pick Tools from the category dropdown. The menu omits the already-
      // selected category, so a missing Tools option means we're there:
      // just close the menu again.
      if (!findTour('palette-category-menu')) clickTour('palette-category');
      const option = await waitForSelector(
        '[data-tour-id="palette-category-menu"] [data-option-id="tools"]',
        800,
      );
      if (option) option.click();
      else closeDropdown('palette-category-menu', 'palette-category');
    },
  },
  {
    id: 'explorer',
    title: 'The Explorer',
    body: 'Your diagrams and folders, without leaving the editor. Open, create, and organise from here.',
    target: 'explorer',
    prepare: async (api) => {
      if (api.compact) {
        // The dock shows one panel at a time, so this also puts the
        // palette away.
        if (!findTour('explorer')) clickTour('dock-explorer');
      } else {
        expandPanelIfCollapsed('explorer', 'Explorer');
      }
      await waitForSelector('[data-tour-id="explorer"]');
    },
    cleanup: (api) => {
      if (api.compact && findTour('explorer')) clickTour('dock-explorer');
    },
  },
  {
    id: 'context-menu',
    title: 'The element menu',
    body: 'Right-click any element (long-press on touch) to style it: colours, borders, text, and layers, plus links, notes, comments, and actions.',
    target: 'context-menu',
    prepare: (api) => api.openElementContextMenu(),
    cleanup: (api) => api.closeContextMenu(),
  },
  {
    id: 'tabs',
    title: 'Tabs',
    body: 'One diagram can hold many pages. Click + to add a tab; drag tabs to reorder them or group them into folders.',
    target: 'add-tab',
  },
  {
    id: 'tab-menu',
    title: 'The tab menu',
    body: 'Each tab has a ⋯ menu: rename, duplicate, lock, import and export, and session tools like timers and votes.',
    target: 'tab-menu',
    prepare: () => {
      if (!findTour('tab-menu')) clickTour('tab-menu-trigger');
    },
    cleanup: () => {
      if (findTour('tab-menu')) clickTour('tab-menu-trigger');
    },
  },
];
