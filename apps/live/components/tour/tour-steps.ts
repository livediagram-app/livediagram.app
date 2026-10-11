// The steps of the interactive editor tour (docs/specs/007-editor/editor-tour.md), in palette →
// mode → explorer → canvas → tabs order. Each step names its anchor (`target`, a
// data-tour-id) and drives the real chrome in `prepare` (opening the panel
// / dropdown / menu it explains) through the TourApi facade TourHost
// builds. `cleanup` undoes whatever prepare opened, and runs on every exit
// path (Next, Back, Skip, finish) so the tour never strands an open menu.

import { clickTour, findTour, waitForSelector } from './tour-dom';
import { stepTelemetryType, type TourStepOf } from './tour-step';

// What a step gets to work with. Built fresh by TourHost so editor-context
// handlers are never stale.
export type TourApi = {
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
}: {
  mobile: boolean;
  esBoard: boolean;
}): TourStep[] {
  return TOUR_STEPS.filter((step) => !(step.mobileSkip && mobile) && !(step.boardSkip && esBoard));
}

// Telemetry `type` token for a step-viewed event: 'selection-modes' → 'TourStepSelectionModes'.
export function tourStepTelemetryType(stepId: string): string {
  return stepTelemetryType('TourStep', stepId);
}

// Wait for the palette strip (docs/specs/007-editor/toolbar-layout.md), always open while the
// chrome is up, so callers can chain.
export async function ensurePaletteOpen() {
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
    title: 'Palette Categories',
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
    // The editor mode switch (docs/specs/007-editor/editor-modes.md "The mode switch"), beside the
    // menu button. Opens its menu, switches nobody's mode.
    id: 'editor-mode',
    title: 'Change Tab Mode',
    body: 'Each tab works in one of five modes: Diagram for shapes, arrows and the palette, Draw for pens, the eraser and sketching by hand, Illustrate for pages, Plan for boards of items and Facilitate for running a session. Switch here, or press Shift+D.',
    target: 'editor-mode-menu',
    alsoHighlight: 'editor-mode',
    // An event-storming board offers no switch, and nor does a phone (its tab menu's Opens in
    // switches there).
    boardSkip: true,
    mobileSkip: true,
    prepare: async () => {
      closeDropdown('palette-category-menu', 'palette-category');
      await waitForSelector('[data-tour-id="editor-mode"]');
      if (!findTour('editor-mode-menu')) clickTour('editor-mode');
    },
    cleanup: () => closeDropdown('editor-mode-menu', 'editor-mode'),
  },
  {
    id: 'explorer',
    title: 'The Explorer',
    body: 'The menu button opens the Explorer: find your documents and folders without leaving the editor. Open, create, and organise from here.',
    target: 'explorer',
    // The Explorer is a popover under the top-left menu button (docs/specs/007-editor/toolbar-layout.md),
    // so the step opens it there and rings the button + popover as one region.
    alsoHighlight: 'dock-explorer',
    prepare: async () => {
      if (!findTour('explorer')) clickTour('dock-explorer');
      await waitForSelector('[data-tour-id="explorer"]');
    },
    cleanup: () => {
      if (findTour('explorer')) clickTour('dock-explorer');
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
