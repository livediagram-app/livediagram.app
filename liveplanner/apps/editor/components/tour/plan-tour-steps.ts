// The steps of the Plan tour (docs/specs/026-plan/plan-tour.md "The steps"): Boards (board → a column → a card → the
// card panel → the header → card types) or Spreadsheets (sheet → cells → formulas → the toolbar → Sheet
// Settings), then that track's outro. The tour runs on the person's own board or Sheet (the tour subject), the one
// they see: its steps point at its body wherever it is drawn (on the canvas, maximised, filling a Board or Sheet tab),
// never at its canvas node, which sits hidden under a maximised or tab-filling body. It changes nothing on it: its
// steps only point, and the one thing they open is a card's panel, closed again on leaving the step.

import type { BoardSheetTrack } from '@/lib/plan-tour';
import {
  stepTelemetryType,
  type TourStepOf,
} from '@liveworkspace/workbench/components/tour/tour-step';
import { opensFrom } from '@liveworkspace/workbench/components/tour/tour-open';

export type PlanTourApi = {
  // The element ids of the tour subject: the board the Boards track shows, the Sheet the Sheets track shows.
  boardId: () => string | null;
  sheetElementId: () => string | null;
  // The board's first card, as drawn (null when it has none).
  firstCardId: () => string | null;
  openCard: () => void;
  closeCard: () => void;
  // The Boards track's own example card (docs/specs/026-plan/plan-tour.md "Tour content"): added to the board's first
  // column, moved to its next, opened, and taken away when the tour ends, however it ends. Its id, once added.
  addTourCard: () => Promise<string | null>;
  moveTourCard: () => void;
  openTourCard: () => void;
  tourCardId: () => string | null;
  // Brings the subject on screen when it sits on the canvas out of view (a maximised or tab-filling one already is).
  reveal: (track: BoardSheetTrack) => void;
};

export type PlanTourStep = TourStepOf<PlanTourApi>;

// A board's or a Sheet's body, wherever it is drawn: its canvas slot, or the canvas cover while it is maximised or
// fills its tab. Its canvas node (`data-element-id`) is not: under a maximised or tab-filling body it is hidden.
export const boardRoot = (id: string) => `[data-plan-board="${CSS.escape(id)}"]`;
export const sheetRoot = (id: string) => `[data-plan-sheet="${CSS.escape(id)}"]`;

const onBoard = (id: string | null, inner = '') => (id ? `${boardRoot(id)}${inner}` : null);
const onSheet = (id: string | null, inner = '') => (id ? `${sheetRoot(id)}${inner}` : null);

// The board's first card, read from the drawn board.
export function firstCardOn(boardId: string | null): string | null {
  if (!boardId || typeof document === 'undefined') return null;
  return (
    document
      .querySelector(`${boardRoot(boardId)} [data-plan-card]`)
      ?.getAttribute('data-plan-card') ?? null
  );
}

// Whether a drawn body is in the browser window at all.
function onScreen(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return (
    r.width > 0 &&
    r.height > 0 &&
    r.right > 0 &&
    r.bottom > 0 &&
    r.left < window.innerWidth &&
    r.top < window.innerHeight
  );
}

// The board or Sheet the person sees, of those on the tab (docs/specs/026-plan/plan-tour.md "The tour subject"): one
// maximised or filling the tab first, then one on screen, then the first. Null when there are none.
export function visiblePlanWork(
  ids: readonly string[],
  root: (id: string) => string,
): string | null {
  if (ids.length === 0) return null;
  if (typeof document === 'undefined') return ids[0]!;
  const drawn = ids.map((id) => ({ id, el: document.querySelector(root(id)) }));
  const covered = drawn.find((d) => d.el?.closest('[data-canvas-cover]'));
  if (covered) return covered.id;
  return drawn.find((d) => d.el && onScreen(d.el))?.id ?? ids[0]!;
}

// Whether the subject needs bringing on screen: drawn on the canvas (not over it) and not wholly in the window.
export function needsReveal(selector: string | null): boolean {
  if (!selector || typeof document === 'undefined') return false;
  const el = document.querySelector(selector);
  if (!el) return true;
  if (el.closest('[data-canvas-cover]')) return false;
  const r = el.getBoundingClientRect();
  return r.left < 0 || r.top < 0 || r.right > window.innerWidth || r.bottom > window.innerHeight;
}

const BOARD_STEPS: PlanTourStep[] = [
  {
    id: 'board',
    title: 'Your Board',
    body: 'Columns are the stages of the work. Cards move left to right as it gets done.',
    // A card on its own, no ring: one round the whole board would light most of the screen. It still brings the
    // board on screen for the steps after it.
    prepare: (api) => api.reveal('boards'),
  },
  {
    id: 'add-cards',
    title: 'Add Cards',
    body: 'Add card at the bottom of a column adds a new one. Here is one: Your First Card.',
    // The tour's own card, added for the step: the person sees one appear where Add card puts it.
    prepare: async (api) => {
      await api.addTourCard();
    },
    selector: (api) => {
      const id = api.tourCardId();
      return id ? onBoard(api.boardId(), ` [data-plan-card="${id}"]`) : null;
    },
  },
  {
    id: 'move-card',
    title: 'Move Work Along',
    body: 'Drag a card to the next column as work moves on. Everyone sees it move, as you just did.',
    prepare: (api) => api.moveTourCard(),
    selector: (api) => {
      const id = api.tourCardId();
      return id ? onBoard(api.boardId(), ` [data-plan-card="${id}"]`) : null;
    },
  },
  {
    id: 'card-panel',
    title: 'The Card Panel',
    body: 'Click a card to open it: description, checklist, who and when. It saves as you type.',
    selector: () => '[role="dialog"][aria-label^="Item #"]',
    prepare: (api) => api.openTourCard(),
    cleanup: (api) => api.closeCard(),
  },
  {
    id: 'board-header',
    title: 'The Board Header',
    body: "The header's widgets count and filter the board. Add more from the + at their end; a column's cog sets up its name, colour and limit.",
    selector: (api) => onBoard(api.boardId(), ' [data-board-header]'),
    prepare: (api) => api.closeCard(),
  },
  opensFrom(
    {
      id: 'card-types',
      title: 'Card Types',
      body: 'Each kind of card has its own colour and fields. Make your own in Card Types.',
      target: 'card-types',
    },
    () => '[data-tour-id="card-types"]',
  ),
  {
    id: 'outro',
    card: 'outro',
    title: "You're ready to plan",
    body: 'That is your board, just as you left it.',
  },
];

const SHEET_STEPS: PlanTourStep[] = [
  {
    id: 'sheet',
    title: 'Your Sheet',
    body: 'A spreadsheet in your plan, worked on together.',
    // A card on its own, no ring: one round the whole sheet would light most of the screen. It still brings the
    // sheet on screen for the steps after it.
    prepare: (api) => api.reveal('sheets'),
  },
  {
    id: 'cells',
    title: 'Type Into Cells',
    body: 'Click a cell and type. Enter moves down, Tab moves across.',
    // Cell A1 alone, not the grid (SheetCells marks it); scrolled out of view, the step is skipped.
    selector: (api) => onSheet(api.sheetElementId(), ' [data-sheet-a1]'),
  },
  {
    id: 'formulas',
    title: 'Formulas',
    body: "The formula bar shows the selected cell's value or formula. Start a cell with = to write one, and click cells to point at them.",
    selector: (api) => onSheet(api.sheetElementId(), ' [data-sheet-formula-bar]'),
  },
  {
    id: 'sheet-toolbar',
    title: 'The Toolbar',
    body: 'Pick a category on the left to see its tools for the selected cells.',
    selector: (api) => onSheet(api.sheetElementId(), ' [role="toolbar"]'),
  },
  opensFrom<PlanTourApi, PlanTourStep>(
    {
      id: 'sheet-settings',
      title: 'Sheet Settings',
      body: "The sheet's cog holds its title, CSV import and download, gridlines, sizes, freeze and named ranges.",
      selector: (api) => onSheet(api.sheetElementId(), ' button[aria-label="Sheet Settings"]'),
    },
    (api) => onSheet(api.sheetElementId(), ' button[aria-label="Sheet Settings"]'),
  ),
  {
    id: 'outro',
    card: 'outro',
    title: "You're ready to plan",
    body: 'That is your sheet, just as you left it.',
  },
];

// The tour's steps: the track's steps and its outro. Every board has the card steps: the tour adds its own card to
// show them on.
export function planTourSteps(track: BoardSheetTrack): PlanTourStep[] {
  return track === 'sheets' ? SHEET_STEPS : BOARD_STEPS;
}

// Telemetry `type` token for a step-viewed event: 'add-cards' → 'PlanTourStepAddCards'.
export function planTourStepTelemetryType(stepId: string): string {
  return stepTelemetryType('PlanTourStep', stepId);
}
