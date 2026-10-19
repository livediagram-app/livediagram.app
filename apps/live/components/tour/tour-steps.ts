// The steps of the Diagram tour (docs/specs/007-editor/editor-tour.md; the welcome tour until October 2026),
// in palette → mode → canvas → tabs → theme order, all about diagramming. Each step names its anchor (`target`, a
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

// A Diagram tour step: the shared step shape (tour-step.ts) over this tour's api.
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

const closeDropdown = (menuId: string, triggerId: string) => {
  if (findTour(menuId)) clickTour(triggerId);
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    card: 'welcome',
    title: 'New to diagrams?',
    body: 'A quick look at the editor: adding shapes, connecting them and making them look the way you want.',
  },
  {
    id: 'palette',
    title: 'The Palette',
    body: 'Shapes, arrows and icons live here. Click one, or drag it onto the canvas.',
    target: 'palette',
    prepare: ensurePaletteOpen,
  },
  {
    id: 'selection-modes',
    title: 'Selection Modes',
    body: 'Choose what your pointer does: select, pan, erase and more.',
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
    body: 'Rest on a category to see what is in it. Click to add, or drag onto the canvas.',
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
    id: 'context-menu',
    title: 'The Element Menu',
    body: 'Right-click anything (long-press on touch) to style it, or add a note, link or comment.',
    target: 'context-menu',
    prepare: (api) => api.openElementContextMenu(),
    cleanup: (api) => api.closeContextMenu(),
  },
  {
    id: 'tabs',
    title: 'Tabs',
    body: 'Each tab is its own diagram. + adds another, and the tab’s menu has tools to tidy it.',
    // The active pill and the add button highlight as one region.
    target: 'active-tab',
    alsoHighlight: 'add-tab',
  },
  {
    id: 'theme-canvas',
    title: 'Theme & Canvas',
    body: "The paintbrush restyles the whole tab in one place: pick a theme for your elements and set the canvas background's colour, pattern, or animation.",
    target: 'canvas-theme',
    // The paintbrush dock button is desktop chrome (mobile reaches the
    // same dialog through the canvas menu).
    mobileSkip: true,
  },
  {
    id: 'outro',
    card: 'outro',
    title: "You're ready to diagram",
    body: "That's the basics, the canvas is yours. If you ever have a question, the help centre has a guide for it.",
  },
];
