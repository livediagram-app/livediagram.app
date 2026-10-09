// The steps of the Plan tour (docs/specs/026-plan/plan-tour.md "The steps"): board → cards → moving →
// the card panel → the header → card types → the palette. The board and card steps make the tour
// content they point at through PlanTourApi (PlanTourHost builds it over usePlanTourContent), so each
// step's prepare is idempotent: Back, or a re-prepare after a target is lost, finds it already made.

import { closeDropdown, ensurePaletteOpen } from './tour-steps';
import { clickTour, findTour } from './tour-dom';
import { stepTelemetryType, type TourStepOf } from './tour-step';

export type PlanTourApi = {
  // Places the example board in the middle of the view (once) and waits for it to draw.
  placeBoard: () => Promise<void>;
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

export const PLAN_TOUR_STEPS: PlanTourStep[] = [
  {
    id: 'welcome',
    card: 'welcome',
    title: 'Welcome to Plan',
    body: 'Plan runs work on boards: columns, cards and the views over them. Want a quick look? We will add an example board and tidy it away at the end.',
  },
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
    title: 'The Plan palette',
    body: 'Cards, boards, widgets, metrics and visualisations all come from here. Metrics and visualisations read every card on the tab.',
    target: 'palette-category-menu',
    alsoHighlight: 'palette-category',
    prepare: async () => {
      await ensurePaletteOpen();
      if (!findTour('palette-category-menu')) clickTour('palette-category');
    },
    cleanup: () => closeDropdown('palette-category-menu', 'palette-category'),
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

// Telemetry `type` token for a step-viewed event: 'add-cards' → 'PlanTourStepAddCards'.
export function planTourStepTelemetryType(stepId: string): string {
  return stepTelemetryType('PlanTourStep', stepId);
}
