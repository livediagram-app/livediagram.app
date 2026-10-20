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

// A Diagram tour step: the shared step shape (tour-step.ts) over this tour's api, plus the words a touch
// screen reads where the desktop's would name a hover or a click it does not have.
export type TourStep = TourStepOf<TourApi> & { touchBody?: string };

// The steps this surface actually has chrome for. Filtering up front (not
// letting a missing target time out mid-tour) keeps the "N of M" count
// honest and the tour moving.
// A touch screen (a coarse pointer, phone or tablet) reads each step's touchBody in place of its body.
export function tourStepsFor({
  mobile,
  esBoard,
  touch = false,
}: {
  mobile: boolean;
  esBoard: boolean;
  touch?: boolean;
}): TourStep[] {
  return TOUR_STEPS.filter(
    (step) => !(step.mobileSkip && mobile) && !(step.boardSkip && esBoard),
  ).map((step) => (touch && step.touchBody ? { ...step, body: step.touchBody } : step));
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

// The Tab Style panel the paintbrush opens (CanvasThemeDialog), closed by a press on its backdrop (Escape is the
// tour's while it runs). Whether its step has been left, so a panel still opening as the step ends is closed too.
const TAB_STYLE = '[role="dialog"][aria-label="Tab style"]';
const closeTabStyle = () => document.querySelector<HTMLElement>(TAB_STYLE)?.parentElement?.click();
let tabStyleLeft = false;

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    card: 'welcome',
    title: 'Getting started with Diagrams?',
    body: 'A quick look at the editor? It takes about a minute.',
  },
  {
    id: 'palette',
    title: 'The Palette',
    body: 'Add whatever you need to your canvas to start drawing after the tour.',
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
    touchBody: 'Tap a category to see what is in it. Tap to add, or drag onto the canvas.',
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
    touchBody: 'Long-press anything to style it, or add a note, link or comment.',
    target: 'context-menu',
    prepare: (api) => api.openElementContextMenu(),
    cleanup: (api) => api.closeContextMenu(),
  },
  {
    id: 'tabs',
    title: 'Tabs',
    body: 'Each tab holds its own work, in its own mode. + adds a tab, and a tab’s ⋯ menu renames, duplicates, locks or exports it, or opens it side by side.',
    // The tab's own ⋯ menu, opened for the step and closed again after, ringed with the tab it belongs to.
    target: 'tab-menu',
    alsoHighlight: 'active-tab',
    prepare: () => {
      if (!findTour('tab-menu')) clickTour('tab-menu-trigger');
    },
    cleanup: () => closeDropdown('tab-menu', 'tab-menu-trigger'),
  },
  {
    id: 'theme-canvas',
    title: 'Theme & Canvas',
    body: "The Style button opens Tab Style for the whole tab: pick a theme for your elements and set the canvas background's colour, pattern, or animation.",
    // The Tab Style panel itself, opened for the step and closed again after (docs/specs/007-editor/editor-tour.md
    // "Steps open what they explain"), ringed with the brush that opens it, over the dialog layer it sits in.
    selector: () => TAB_STYLE,
    alsoHighlight: 'canvas-theme',
    layer: 'modal',
    prepare: async () => {
      tabStyleLeft = false;
      if (!document.querySelector(TAB_STYLE)) clickTour('canvas-theme');
      await waitForSelector(TAB_STYLE, 2000);
      // Left while it was still opening (Escape mid-step): it closes as it arrives.
      if (tabStyleLeft) closeTabStyle();
    },
    cleanup: () => {
      tabStyleLeft = true;
      closeTabStyle();
    },
    // Desktop only: a phone opens Tab Style as a modal sheet, and the tour stands aside while a modal is open, so the
    // step would show the sheet with no card to go on from.
    mobileSkip: true,
  },
  {
    id: 'outro',
    card: 'outro',
    title: "You're ready to diagram",
    body: "That's the basics, the canvas is yours. If you ever have a question, the help centre has a guide for it.",
  },
];
