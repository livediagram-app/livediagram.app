// The steps of the Plan tour (docs/specs/026-plan/plan-tour.md "The steps"): a welcome card (naming the board
// or sheet it will show, or asking which when the tab has both), then Boards (board → a column → a card → the
// card panel → the header → card types) or Spreadsheets (sheet → cells → formulas → the toolbar → Sheet
// Settings), then that track's outro. The tour runs on the person's own board or Sheet (the tour subject), the one
// they see: its steps point at its body wherever it is drawn (on the canvas, maximised, filling a Board or Sheet tab),
// never at its canvas node, which sits hidden under a maximised or tab-filling body. It changes nothing on it: its
// steps only point, and the one thing they open is a card's panel, closed again on leaving the step.

import type { PlanTourTrack } from '@/lib/plan-tour';
import { stepTelemetryType, type TourStepOf } from './tour-step';

export type PlanTourApi = {
  // The element ids of the tour subject: the board the Boards track shows, the Sheet the Sheets track shows.
  boardId: () => string | null;
  sheetElementId: () => string | null;
  // The board's first card, as drawn (null when it has none).
  firstCardId: () => string | null;
  openCard: () => void;
  closeCard: () => void;
  // Brings the subject on screen when it sits on the canvas out of view (a maximised or tab-filling one already is).
  reveal: (track: PlanTourTrack) => void;
};

export type PlanTourStep = TourStepOf<PlanTourApi>;

// What the welcome card offers: the one track the tab has plan work for, or a choice when it has both.
export type PlanTourOffer = PlanTourTrack | 'choice';

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

const WELCOME_TITLE = 'Welcome to Plan';
const NEVER_CHANGES = 'We will only point things out, never change anything.';

const WELCOMES: Record<PlanTourOffer, PlanTourStep> = {
  boards: {
    id: 'welcome',
    card: 'welcome',
    title: WELCOME_TITLE,
    body: `Plan runs work on boards of cards. Want a quick look around your board? ${NEVER_CHANGES}`,
  },
  sheets: {
    id: 'welcome',
    card: 'welcome',
    title: WELCOME_TITLE,
    body: `Plan runs work on boards and spreadsheets. Want a quick look around your sheet? ${NEVER_CHANGES}`,
  },
  choice: {
    id: 'welcome',
    card: 'welcome',
    title: WELCOME_TITLE,
    body: `This tab has a board and a spreadsheet. Which would you like a quick look at? ${NEVER_CHANGES}`,
  },
};

// The Boards steps that need a card on the board, left out up front when it has none.
const CARD_STEPS = new Set(['move-card', 'card-panel']);

const BOARD_STEPS: PlanTourStep[] = [
  {
    id: 'board',
    title: 'Your Board',
    body: 'Columns are the stages work moves through, left to right. Cards move along them as the work gets done.',
    selector: (api) => onBoard(api.boardId()),
    prepare: (api) => api.reveal('boards'),
  },
  {
    id: 'add-cards',
    title: 'Add Cards',
    body: 'Each column ends in Add card, which adds a card of any type the board takes.',
    selector: (api) => onBoard(api.boardId(), ' [data-plan-status]'),
  },
  {
    id: 'move-card',
    title: 'Move Work Along',
    body: 'Drag a card to the next column as the work moves on, or focus it and press Shift with an arrow key. Everyone in the document sees it move.',
    selector: (api) => {
      const id = api.firstCardId();
      return id ? onBoard(api.boardId(), ` [data-plan-card="${id}"]`) : null;
    },
  },
  {
    id: 'card-panel',
    title: 'The Card Panel',
    body: 'Click a card to open it: its description, checklist, who it is on and when it is due, all saved as you type.',
    selector: () => '[role="dialog"][aria-label^="Item #"]',
    prepare: (api) => api.openCard(),
    cleanup: (api) => api.closeCard(),
  },
  {
    id: 'board-header',
    title: 'The Board Header',
    body: "The header's widgets count and filter the board. Add more from the + at their end; a column's cog sets up its name, colour and limit.",
    selector: (api) => onBoard(api.boardId(), ' [data-board-header]'),
    prepare: (api) => api.closeCard(),
  },
  {
    id: 'card-types',
    title: 'Card Types',
    body: 'Tasks, notes, ideas and actions each have their own colour and fields. Change them, or make your own, in Card Types.',
    target: 'card-types',
  },
  {
    id: 'outro',
    card: 'outro',
    title: "You're ready to plan",
    body: 'That is your board, just as you left it. The help centre has a guide for every part of Plan.',
  },
];

const SHEET_STEPS: PlanTourStep[] = [
  {
    id: 'sheet',
    title: 'Your Sheet',
    body: 'A sheet is a spreadsheet in your document: cells, formulas and charts, worked on together.',
    selector: (api) => onSheet(api.sheetElementId()),
    prepare: (api) => api.reveal('sheets'),
  },
  {
    id: 'cells',
    title: 'Type Into Cells',
    body: 'Click a cell and type. Enter moves down and Tab moves across; numbers, dates and percentages are read as you type them.',
    selector: (api) => onSheet(api.sheetElementId(), ' [role="grid"]'),
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
    body: 'Pick a category on its left (Text, Cells, Numbers, Data, Charts or Functions) and its tools show beside it, acting on the selected cells.',
    selector: (api) => onSheet(api.sheetElementId(), ' [role="toolbar"]'),
  },
  {
    id: 'sheet-settings',
    title: 'Sheet Settings',
    body: "The sheet's cog holds its title, CSV import and download, gridlines, sizes, freeze and named ranges.",
    selector: (api) => onSheet(api.sheetElementId(), ' button[aria-label="Sheet Settings"]'),
  },
  {
    id: 'outro',
    card: 'outro',
    title: "You're ready to plan",
    body: 'That is your sheet, just as you left it. The help centre has a guide for every part of Sheets.',
  },
];

// The tour's steps: the welcome card for what is on offer, then the track's steps and outro. Before a pick on
// a choice card the Boards track stands in, so the welcome card always has a step after it. A board with no
// cards leaves out the steps that need one, so the count stays honest.
export function planTourSteps(
  track: PlanTourTrack,
  { offer = track, hasCards = true }: { offer?: PlanTourOffer; hasCards?: boolean } = {},
): PlanTourStep[] {
  const steps =
    track === 'sheets' ? SHEET_STEPS : BOARD_STEPS.filter((s) => hasCards || !CARD_STEPS.has(s.id));
  return [WELCOMES[offer], ...steps];
}

// Telemetry `type` token for a step-viewed event: 'add-cards' → 'PlanTourStepAddCards'.
export function planTourStepTelemetryType(stepId: string): string {
  return stepTelemetryType('PlanTourStep', stepId);
}
