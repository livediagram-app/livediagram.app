// The steps of the Plan tour (docs/specs/026-plan/plan-tour.md "The steps"): a welcome card that picks a
// track, then Boards (board → cards → moving → the card panel → the header → card types → the palette) or
// Spreadsheets (sheet → cells → formulas → the toolbar → Sheet Settings → the palette), then that track's
// outro. The steps make the tour content they point at through PlanTourApi (PlanTourHost builds it over
// usePlanTourContent), so each step's prepare is idempotent: Back, or a re-prepare after a target is lost,
// finds it already made.

import type { PlanTourTrack } from '@/lib/plan-tour';
import { closeDropdown, ensurePaletteOpen } from './tour-steps';
import { clickTour, findTour } from './tour-dom';
import { stepTelemetryType, type TourStepOf } from './tour-step';

export type PlanTourApi = {
  // Places the example board in the middle of the view (once) and waits for it to draw.
  placeBoard: () => Promise<void>;
  // Places the example sheet in the middle of the view (once) and waits for its grid to draw.
  placeSheet: () => Promise<void>;
  // Selects the example sheet's Total amount (C6), so the formula bar shows its formula.
  selectTotal: () => void;
  sheetElementId: () => string | null;
  addCards: () => Promise<void>;
  moveCard: () => Promise<void>;
  openCard: () => void;
  closeCard: () => void;
  removeContent: () => void;
  boardId: () => string | null;
  firstCardId: () => string | null;
  // The status the example board gave one of its Kanban columns ('todo', 'doing').
  status: (column: string) => string | null;
};

export type PlanTourStep = TourStepOf<PlanTourApi>;

const onBoard = (api: PlanTourApi, inner = '') => {
  const id = api.boardId();
  return id ? `[data-element-id="${id}"]${inner}` : null;
};

const onSheet = (api: PlanTourApi, inner = '') => {
  const id = api.sheetElementId();
  return id ? `[data-element-id="${id}"]${inner}` : null;
};

const WELCOME: PlanTourStep = {
  id: 'welcome',
  card: 'welcome',
  title: 'Welcome to Plan',
  body: 'Plan runs work on boards and spreadsheets. Which would you like a quick look at? We will add an example and tidy it away at the end.',
};

// The palette's category picker, open: the last step of either track, which adds its id and copy (each step
// keeps its own `id:` line, read by the telemetry dashboard).
const PALETTE_STEP = {
  title: 'The Plan palette',
  target: 'palette-category-menu',
  alsoHighlight: 'palette-category',
  prepare: async () => {
    await ensurePaletteOpen();
    if (!findTour('palette-category-menu')) clickTour('palette-category');
  },
  cleanup: () => closeDropdown('palette-category-menu', 'palette-category'),
} satisfies Omit<PlanTourStep, 'id' | 'body'>;

const BOARD_STEPS: PlanTourStep[] = [
  {
    id: 'board',
    title: 'Your board',
    body: "Columns are the stages work moves through. This is a Kanban board; the palette's Boards category has boards for sprints, retros, roadmaps and more.",
    selector: (api) => onBoard(api),
    prepare: (api) => api.placeBoard(),
  },
  {
    id: 'add-cards',
    title: 'Add cards',
    body: "Each column ends in Add card, or drop a card from the palette's Cards category right where it should go. We have added a few to show you.",
    selector: (api) => {
      const status = api.status('todo');
      return status ? onBoard(api, ` [data-plan-status="${status}"]`) : null;
    },
    prepare: async (api) => {
      await api.placeBoard();
      await api.addCards();
    },
  },
  {
    id: 'move-card',
    title: 'Move work along',
    body: 'Drag a card to the next column as the work moves on, or focus it and press Shift with an arrow key. Everyone in the document sees it move.',
    selector: (api) => {
      const id = api.firstCardId();
      return id ? `[data-plan-card="${id}"]` : null;
    },
    prepare: async (api) => {
      await api.placeBoard();
      await api.addCards();
      await api.moveCard();
    },
  },
  {
    id: 'card-panel',
    title: 'The card panel',
    body: 'Click a card to open it: its description, checklist, who it is on and when it is due, all saved as you type.',
    selector: () => '[role="dialog"][aria-label^="Item #"]',
    prepare: async (api) => {
      await api.addCards();
      api.openCard();
    },
    cleanup: (api) => api.closeCard(),
  },
  {
    id: 'board-header',
    title: 'The board header',
    body: "The header's widgets count and filter the board. Drop more from the palette's Widgets; a column's cog sets up its name, colour and limit.",
    selector: (api) => onBoard(api, ' [data-board-header]'),
    prepare: (api) => api.closeCard(),
  },
  {
    id: 'card-types',
    title: 'Card Types',
    body: 'Tasks, notes, ideas and actions each have their own colour and fields. Change them, or make your own, in Card Types.',
    target: 'card-types',
  },
  {
    id: 'palette',
    ...PALETTE_STEP,
    body: 'Cards, boards, widgets, metrics and visualisations all come from here. Metrics and visualisations read every card on the tab.',
  },
  {
    id: 'outro',
    card: 'outro',
    title: "You're ready to plan",
    body: 'We have tidied the example board away. Pick a board to start, and the help centre has a guide for every part of Plan.',
    // The tour content goes as the outro shows, so it is gone by the time it is read.
    prepare: (api) => api.removeContent(),
  },
];

const SHEET_STEPS: PlanTourStep[] = [
  {
    id: 'sheet',
    title: 'Your sheet',
    body: "A sheet is a spreadsheet on the canvas. This one is a small budget; the palette's Sheet category places one from a layout, your cards or a blank grid.",
    selector: (api) => onSheet(api),
    prepare: (api) => api.placeSheet(),
  },
  {
    id: 'cells',
    title: 'Type into cells',
    body: 'Click a cell and type. Enter moves down and Tab moves across; numbers, dates and percentages are read as you type them.',
    selector: (api) => onSheet(api, ' [role="grid"]'),
    prepare: (api) => api.placeSheet(),
  },
  {
    id: 'formulas',
    title: 'Formulas',
    body: 'The total is a formula, shown here in the formula bar. Start a cell with = and click cells to point at them.',
    selector: (api) => onSheet(api, ' [data-sheet-formula-bar]'),
    prepare: async (api) => {
      await api.placeSheet();
      api.selectTotal();
    },
  },
  {
    id: 'sheet-toolbar',
    title: 'The toolbar',
    body: 'Pick a category on its left (Text, Cells, Numbers, Data, Charts or Functions) and its tools show beside it, acting on the selected cells.',
    selector: (api) => onSheet(api, ' [role="toolbar"]'),
  },
  {
    id: 'sheet-settings',
    title: 'Sheet Settings',
    body: "The sheet's cog holds its title, CSV import and download, gridlines, sizes, freeze and named ranges.",
    selector: (api) => onSheet(api, ' button[aria-label="Sheet Settings"]'),
  },
  {
    id: 'sheet-palette',
    ...PALETTE_STEP,
    body: 'Sheets come from the Sheet category, beside the boards and cards a sheet can read with its card functions.',
  },
  {
    id: 'outro',
    card: 'outro',
    title: "You're ready to plan",
    body: 'We have tidied the example sheet away. Place a sheet to start, and the help centre has a guide for every part of Sheets.',
    prepare: (api) => api.removeContent(),
  },
];

// The tour's steps for a track: the welcome card, then the track's steps and outro. Before a pick the Boards
// track stands in, so the welcome card always has a step after it.
export function planTourSteps(track: PlanTourTrack): PlanTourStep[] {
  return [WELCOME, ...(track === 'sheets' ? SHEET_STEPS : BOARD_STEPS)];
}

export const PLAN_TOUR_STEPS: PlanTourStep[] = planTourSteps('boards');

// Telemetry `type` token for a step-viewed event: 'add-cards' → 'PlanTourStepAddCards'.
export function planTourStepTelemetryType(stepId: string): string {
  return stepTelemetryType('PlanTourStep', stepId);
}
