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
  // Absent = no anchor: the card centres itself (the welcome offer).
  target?: string;
  // Optional second anchor folded into the highlight rect (union of the
  // two). The dropdown steps use it so the ring wraps the trigger button
  // AND its portalled menu as one region, not the floating menu alone.
  alsoHighlight?: string;
  // The welcome offer card: no step count / dots / Back, and the primary /
  // dismiss buttons read "Show me around" / "No thanks". Declining is
  // permanent (the done-guard), so the offer never nags.
  welcome?: boolean;
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
    id: 'welcome',
    welcome: true,
    title: 'Welcome to your first diagram',
    body: 'Get the most out of livediagram, want us to show you around? Seven short steps, about a minute.',
  },
  {
    id: 'palette',
    title: 'The Palette',
    body: 'Everything you need to build an amazing diagram, click or drag what you want onto the canvas.',
    target: 'palette',
    prepare: ensurePaletteOpen,
  },
  {
    id: 'selection-modes',
    title: 'Selection modes',
    body: 'This dropdown changes what your pointer does: Select to move and edit, Hand to pan, Eraser to remove, and more.',
    target: 'canvas-tool-menu',
    alsoHighlight: 'canvas-tool',
    prepare: async (api) => {
      await ensurePaletteOpen(api);
      if (!findTour('canvas-tool-menu')) clickTour('canvas-tool');
    },
    cleanup: () => closeDropdown('canvas-tool-menu', 'canvas-tool'),
  },
  {
    id: 'categories',
    title: 'Shape categories',
    body: 'The palette is organised into categories: Favourites keeps your go-to tiles, then the other categories provide unique opportunities to personalise your diagram.',
    target: 'palette-category-menu',
    alsoHighlight: 'palette-category',
    prepare: async (api) => {
      await ensurePaletteOpen(api);
      closeDropdown('canvas-tool-menu', 'canvas-tool');
      if (!findTour('palette-category-menu')) clickTour('palette-category');
    },
    cleanup: () => closeDropdown('palette-category-menu', 'palette-category'),
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
    body: 'Each tab has a menu containing helpful tools and ways to organise, cleanup and customise.',
    target: 'tab-menu',
    prepare: () => {
      if (!findTour('tab-menu')) clickTour('tab-menu-trigger');
    },
    cleanup: () => {
      if (findTour('tab-menu')) clickTour('tab-menu-trigger');
    },
  },
];
