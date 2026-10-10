import { SHAPE_DEFAULT_SIZE, createShape, type ShapeElement } from '@livediagram/document';
import {
  freshBoardSetup,
  newItemId,
  planBoardHeightFor,
  planBoardWidthFor,
  type ItemCreate,
  type PlanBoardSetup,
} from '@livediagram/items';
import {
  readLocalStorageSafe,
  removeLocalStorageSafe,
  safeJson,
  writeLocalStorageSafe,
} from './local-storage-safe';

// The Plan tour's pure parts (docs/specs/026-plan/plan-tour.md, blueprint plan-tour.md): its relaunch
// signal, the example board and cards it shows Plan working on, and the leftover record that lets a
// later visit tidy tour content a reload cut short.

// Settings → Plan tour: the "Show Plan Tour" row, turned on from off and closed, reruns the tour. A
// window event keeps the dialog decoupled from PlanTourHost, as the welcome tour's relaunch does.
export const PLAN_TOUR_RELAUNCH_EVENT = 'livediagram:plan-tour-relaunch';

export function requestPlanTourRelaunch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PLAN_TOUR_RELAUNCH_EVENT));
}

export const EXAMPLE_BOARD_TITLE = 'Example Board';

// The example board: a Kanban board with statuses of its own (freshBoardSetup), so no card the document
// has lands on it and no example card lands on another board, centred on a canvas point.
export function exampleBoard(
  centre: { x: number; y: number },
  random: () => number = Math.random,
): ShapeElement & { planBoard: PlanBoardSetup } {
  const planBoard = { ...freshBoardSetup('kanban', random), title: EXAMPLE_BOARD_TITLE };
  const base = createShape('plan-board', 0, 0);
  const width = Math.max(SHAPE_DEFAULT_SIZE['plan-board'].width, planBoardWidthFor(planBoard));
  const height = planBoardHeightFor(planBoard);
  return {
    ...base,
    planBoard,
    width,
    height,
    x: centre.x - width / 2,
    y: centre.y - height / 2,
  };
}

// The status a Kanban column was given on the example board: `todo` → `todo~k3f9`.
export function exampleStatus(setup: PlanBoardSetup, column: string): string | undefined {
  return setup.columns.find((c) => c.id === column)?.status;
}

// The column "Move work along" moves the first card to.
export const EXAMPLE_MOVE_TO = 'doing';

// The example cards (spec "Tour content"), first the one the tour moves and opens. Fresh ids, so the
// tour knows exactly what it made.
export function exampleCards(setup: PlanBoardSetup, newId: () => string = newItemId): ItemCreate[] {
  const todo = exampleStatus(setup, 'todo');
  const backlog = exampleStatus(setup, 'backlog');
  const card = (type: string, title: string, status: string | undefined): ItemCreate => ({
    id: newId(),
    type,
    fields: { title },
    ...(status ? { place: { status } } : {}),
  });
  return [
    card('task', 'Plan the launch', todo),
    card('task', 'Write the release notes', todo),
    card('action', 'Agree the launch date', backlog),
  ];
}

// What the tour made, kept until it is taken away.
export type PlanTourContent = {
  documentId: string;
  boardId: string;
  itemIds: string[];
};

export const PLAN_TOUR_CONTENT_KEY = 'livediagram:v2:plan-tour-content';

function isContent(value: unknown): value is PlanTourContent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['documentId'] === 'string' &&
    typeof v['boardId'] === 'string' &&
    Array.isArray(v['itemIds']) &&
    v['itemIds'].every((id) => typeof id === 'string')
  );
}

// The leftover record: what a tour cut short (a reload, a closed window) left behind. Malformed or
// unreadable reads as none.
export function readLeftover(): PlanTourContent | null {
  const raw = readLocalStorageSafe(PLAN_TOUR_CONTENT_KEY);
  if (!raw) return null;
  const parsed = safeJson(raw);
  if (isContent(parsed)) return parsed;
  removeLocalStorageSafe(PLAN_TOUR_CONTENT_KEY);
  return null;
}

// Storage unavailable: the in-memory record still tidies up a tour that ends normally.
export function writeLeftover(content: PlanTourContent | null): void {
  if (content) writeLocalStorageSafe(PLAN_TOUR_CONTENT_KEY, JSON.stringify(content));
  else removeLocalStorageSafe(PLAN_TOUR_CONTENT_KEY);
}
