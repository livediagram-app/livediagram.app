// The steps of the interactive editor tour (docs/specs/007-editor/editor-tour.md), in palette →
// mode → explorer → canvas → tabs order. Each step names its anchor (`target`, a
// data-tour-id) and drives the real chrome in `prepare` (opening the panel
// / dropdown / menu it explains) through the TourApi facade TourHost
// builds. `cleanup` undoes whatever prepare opened, and runs on every exit
// path (Next, Back, Skip, finish) so the tour never strands an open menu.

import { clickTour, expandPanelIfCollapsed, findTour, waitForSelector } from './tour-dom';
import { stepTelemetryType, type TourStepOf } from './tour-step';

// What a step gets to work with. Built fresh by TourHost so editor-context
// handlers are never stale.
export type TourApi = {
  // The Toolbar panel layout (docs/specs/007-editor/toolbar-layout.md): the Explorer is a popover behind
  // the top-left menu button rather than a corner panel.
  toolbar: boolean;
  // Select an element for the context-menu step, adding a theme-coloured
  // square at the viewport centre when the tab is empty. Resolves once the
  // element's menu is open (or null if it couldn't be).
  openElementContextMenu: () => Promise<void>;
  closeContextMenu: () => void;
};

// A welcome-tour step: the shared step shape (tour-step.ts) over this tour's api.
export type TourStep = TourStepOf<TourApi>;

// The steps this surface actually has chrome for. Filtering up front (not
// letting a missing target time out mid-tour) keeps the "N of M" count
// honest and the tour moving.
export function tourStepsFor({
  mobile,
  esBoard,
  toolbar = false,
}: {
  mobile: boolean;
  esBoard: boolean;
  toolbar?: boolean;
}): TourStep[] {
  return TOUR_STEPS.filter(
    (step) => !(step.mobileSkip && mobile) && !(step.boardSkip && esBoard),
  ).map((step) => (toolbar && step.toolbar ? { ...step, ...step.toolbar } : step));
}

// Telemetry `type` token for a step-viewed event: 'selection-modes' → 'TourStepSelectionModes'.
export function tourStepTelemetryType(stepId: string): string {
  return stepTelemetryType('TourStep', stepId);
}

// Bring the palette on screen: expand the floating Palette if it is
// collapsed (the Toolbar strip is always open). Waits for the node so
// callers can chain.
export async function ensurePaletteOpen() {
  expandPanelIfCollapsed('palette', 'Palette');
  await waitForSelector('[data-tour-id="palette"]');
}

export const closeDropdown = (menuId: string, triggerId: string) => {
  if (findTour(menuId)) clickTour(triggerId);
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    card: 'welcome',
    title: 'Welcome to livediagram',
    body: 'We can help you to get the most out of livediagram, want us to show you the basics?',
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
    boardSkip: true,
    prepare: async () => {
      await ensurePaletteOpen();
      if (!findTour('canvas-tool-menu')) clickTour('canvas-tool');
    },
    cleanup: () => closeDropdown('canvas-tool-menu', 'canvas-tool'),
  },
  {
    id: 'categories',
    title: 'Shape categories',
    body: 'The palette is organised into categories: Popular holds the tiles most reached for, then the other categories provide unique opportunities to personalise your diagram.',
    target: 'palette-category-menu',
    alsoHighlight: 'palette-category',
    boardSkip: true,
    prepare: async () => {
      await ensurePaletteOpen();
      closeDropdown('canvas-tool-menu', 'canvas-tool');
      if (!findTour('palette-category-menu')) clickTour('palette-category');
    },
    cleanup: () => closeDropdown('palette-category-menu', 'palette-category'),
  },
  {
    // The editor mode switch (docs/specs/007-editor/editor-modes.md "The mode switch"): in the
    // Palette's title row, or beside the Toolbar layout's menu button. Opens its menu, switches
    // nobody's mode.
    id: 'editor-mode',
    title: 'Diagram & Draw',
    body: 'Each tab works in one of two modes: Diagram for shapes, arrows and the palette, Draw for pens, the eraser and sketching by hand. Switch here, or press Shift+D.',
    target: 'editor-mode-menu',
    alsoHighlight: 'editor-mode',
    // An event-storming board offers no switch.
    boardSkip: true,
    prepare: async (api) => {
      if (!api.toolbar) await ensurePaletteOpen();
      closeDropdown('palette-category-menu', 'palette-category');
      await waitForSelector('[data-tour-id="editor-mode"]');
      if (!findTour('editor-mode-menu')) clickTour('editor-mode');
    },
    cleanup: () => closeDropdown('editor-mode-menu', 'editor-mode'),
  },
  {
    id: 'explorer',
    title: 'The Explorer',
    body: 'Find your documents and folders, without leaving the editor. Open, create, and organise from here.',
    target: 'explorer',
    // Toolbar layout (docs/specs/007-editor/toolbar-layout.md): no corner panel to point at, the Explorer
    // opens as a popover under the top-left menu button, so the step opens it
    // there and rings the button + popover as one region.
    toolbar: {
      body: 'The menu button opens the Explorer: find your documents and folders without leaving the editor. Open, create, and organise from here.',
      alsoHighlight: 'dock-explorer',
    },
    prepare: async (api) => {
      if (api.toolbar) {
        if (!findTour('explorer')) clickTour('dock-explorer');
      } else {
        expandPanelIfCollapsed('explorer', 'Explorer');
      }
      await waitForSelector('[data-tour-id="explorer"]');
    },
    cleanup: (api) => {
      if (api.toolbar && findTour('explorer')) clickTour('dock-explorer');
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
    body: 'One document can hold many pages: this is your current tab, and + adds another. Each tab also has a menu of helpful tools and ways to organise, cleanup and customise.',
    // The active pill and the add button highlight as one region.
    target: 'active-tab',
    alsoHighlight: 'add-tab',
  },
  {
    id: 'theme-canvas',
    title: 'Theme & canvas',
    body: "The paintbrush restyles the whole tab in one place: pick a theme for your elements and set the canvas background's colour, pattern, or animation.",
    target: 'canvas-theme',
    // The paintbrush dock button is desktop chrome (mobile reaches the
    // same dialog through the canvas menu).
    mobileSkip: true,
  },
  {
    id: 'outro',
    card: 'outro',
    title: "You're ready to go",
    body: "That's the basics, the canvas is yours. If you ever have a question, the help centre has a guide for it.",
  },
];
