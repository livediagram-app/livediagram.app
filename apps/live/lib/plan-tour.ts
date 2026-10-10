import { SHAPE_DEFAULT_SIZE, createShape, type ShapeElement } from '@livediagram/document';
import { placeNewSheet } from './sheet-seeds';
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
// signal, its tracks, the example board, cards and sheet it shows Plan working on, and the leftover record
// that lets a later visit tidy tour content a reload cut short.

// Settings → Plan tour: the "Show Plan Tour" row, turned on from off and closed, reruns the tour. A
// window event keeps the dialog decoupled from PlanTourHost, as the welcome tour's relaunch does.
export const PLAN_TOUR_RELAUNCH_EVENT = 'livediagram:plan-tour-relaunch';

export function requestPlanTourRelaunch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PLAN_TOUR_RELAUNCH_EVENT));
}

// Which half of Plan the tour shows, picked on its welcome card.
export const PLAN_TOUR_TRACKS = ['boards', 'sheets'] as const;
export type PlanTourTrack = (typeof PLAN_TOUR_TRACKS)[number];

export const EXAMPLE_BOARD_TITLE = 'Example Board';
export const EXAMPLE_SHEET_TITLE = 'Example Sheet';

// The example sheet's frame: room for the Budget start's three columns and six rows under the header, toolbar and
// formula bar, smaller than a placed Sheet's 960 x 560 so it sits in the view with the tour's card beside it.
export const EXAMPLE_SHEET_SIZE = { width: 600, height: 400 } as const;

// The cell the Formulas step selects: the Budget start's Total amount, C6.
export const EXAMPLE_TOTAL_CELL = { r: 5, c: 2 } as const;

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

// The example sheet (spec "Tour content"): a Sheet placed already set up from the Budget start, centred on a canvas
// point. Its sheet is made when it first draws, as any placed Sheet's.
export function exampleSheet(centre: { x: number; y: number }): ShapeElement & {
  planSheet: { sheetId: string };
} {
  const { width, height } = EXAMPLE_SHEET_SIZE;
  return {
    ...createShape('plan-sheet', 0, 0),
    planSheet: placeNewSheet({ title: EXAMPLE_SHEET_TITLE, setUp: 'budget' }),
    width,
    height,
    x: centre.x - width / 2,
    y: centre.y - height / 2,
  };
}

// What the tour made, kept until it is taken away: the element it placed (the example board or sheet), the
// example sheet's sheet, and the example cards.
export type PlanTourContent = {
  documentId: string;
  elementId: string;
  sheetId?: string;
  itemIds: string[];
};

export const PLAN_TOUR_CONTENT_KEY = 'livediagram:v2:plan-tour-content';

// A record written before the Sheets track named the element `boardId`; it reads as the same thing.
function asContent(value: unknown): PlanTourContent | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const elementId = v['elementId'] ?? v['boardId'];
  const sheetId = v['sheetId'];
  if (
    typeof v['documentId'] !== 'string' ||
    typeof elementId !== 'string' ||
    (sheetId !== undefined && typeof sheetId !== 'string') ||
    !Array.isArray(v['itemIds']) ||
    !v['itemIds'].every((id) => typeof id === 'string')
  )
    return null;
  return {
    documentId: v['documentId'],
    elementId,
    ...(sheetId ? { sheetId } : {}),
    itemIds: v['itemIds'] as string[],
  };
}

// The leftover record: what a tour cut short (a reload, a closed window) left behind. Malformed or
// unreadable reads as none.
export function readLeftover(): PlanTourContent | null {
  const raw = readLocalStorageSafe(PLAN_TOUR_CONTENT_KEY);
  if (!raw) return null;
  const content = asContent(safeJson(raw));
  if (content) return content;
  removeLocalStorageSafe(PLAN_TOUR_CONTENT_KEY);
  return null;
}

// Storage unavailable: the in-memory record still tidies up a tour that ends normally.
export function writeLeftover(content: PlanTourContent | null): void {
  if (content) writeLocalStorageSafe(PLAN_TOUR_CONTENT_KEY, JSON.stringify(content));
  else removeLocalStorageSafe(PLAN_TOUR_CONTENT_KEY);
}
