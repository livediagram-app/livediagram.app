// The missions of the Plan tour's Boards and Sheets tracks (docs/specs/026-plan/plan-tour.md "Boards: Practice
// Sprint", "Sheets: Five Small Wins"), and where the tour finds its subject. Each mission is checked from what the
// person really did (missions.ts); the checks here are pure, over a small view of the live state the host builds.
// The telemetry dashboard reads the `id: '…'` lines below for the mission views it expects (computed-emitters.ts).

import type { Item } from '@liveplanner/items';
import { stepTelemetryType } from '@liveworkspace/workbench/components/tour/tour-step';
import type { Mission } from './missions';

// A board's or a Sheet's body, wherever it is drawn: its canvas slot, or the canvas cover while it is maximised or
// fills its tab. Its canvas node (`data-element-id`) is not: under a maximised or tab-filling body it is hidden.
export const boardRoot = (id: string) => `[data-plan-board="${CSS.escape(id)}"]`;
export const sheetRoot = (id: string) => `[data-plan-sheet="${CSS.escape(id)}"]`;

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

// The board or Sheet the person sees, of those on the tab (plan-tour.md "Tour subject"): one maximised or filling the
// tab first, then one on screen, then the first. Null when there are none.
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

// Either track's finish, which sends a view as a mission does.
export const FINISH_STEP = {
  id: 'outro',
} as const;

// ---------------------------------------------------------------- Boards: Practice Sprint

// The practice cards dealt at the start, in order (plan-tour.md "Boards: Practice Sprint").
export const PRACTICE_CARD_TITLES = ['Draft the plan', 'Book a room', 'Send the invite'] as const;

// What the sprint's checks read: the practice cards as they are now, and the board's shape.
export type SprintCtx = {
  boardId: string;
  practice: readonly Item[];
  // The board's first column's status (where the deal lands), the next one's, and the ship column's.
  firstStatus: string;
  nextStatus: string;
  nextName: string;
  shipStatus: string;
  shipName: string;
  openItemId: string | null;
};

// What shapes the sprint's missions, fixed when it starts.
export type SprintShape = Omit<SprintCtx, 'practice' | 'openItemId'> & {
  // Whether the practice cards' type has a Due field.
  hasDue: boolean;
  phone: boolean;
};

const statusOf = (item: Item) => item.fields.status;
const cellOf = (boardId: string, status: string) =>
  `${boardRoot(boardId)} [data-plan-status="${CSS.escape(status)}"]`;
const hasValue = (v: unknown) => v !== undefined && v !== null && v !== '';

// The sprint's missions for this board: Give it a date only when the cards' type has a Due field.
export function sprintMissions(shape: SprintShape): Mission<SprintCtx>[] {
  const move: Mission<SprintCtx> = {
    id: 'move-card',
    title: 'Move one on',
    why: shape.phone
      ? `Hold a dashed practice card, then drag it into ${shape.nextName}.`
      : `Drag a dashed practice card into ${shape.nextName}.`,
    lesson:
      'That is the whole idea: work moves left to right. On a real card, everyone sees it move.',
    hints: [
      {
        text: shape.phone
          ? 'Hold a card until it lifts, then slide it right. Or hold it and pick Move To.'
          : 'Press on a dashed card and drag it right. Or right-click it and pick Move To.',
      },
      {
        text: `Drop it here, in ${shape.nextName}.`,
        ring: () => cellOf(shape.boardId, shape.nextStatus),
      },
    ],
    done: (c) => c.practice.some((i) => statusOf(i) !== c.firstStatus),
  };
  const open: Mission<SprintCtx> = {
    id: 'open-card',
    title: 'Open one',
    why: shape.phone ? 'Tap a practice card to open it.' : 'Click a practice card to open it.',
    lesson: 'Everything about one piece of work lives here, saved as you type.',
    hints: [
      {
        text: shape.phone
          ? 'Tap any dashed card.'
          : 'Click a dashed card, or focus it and press Enter.',
      },
      { text: 'Any of these will do.', ring: () => `${boardRoot(shape.boardId)} [data-practice]` },
    ],
    done: (c) => c.openItemId !== null && c.practice.some((i) => i.id === c.openItemId),
  };
  const due: Mission<SprintCtx> = {
    id: 'due-date',
    title: 'Give it a date',
    why: 'Set a due date on a practice card, in its panel.',
    lesson: 'Dates show on the card, and on calendars and dashboards.',
    hints: [
      { text: 'Open a practice card and find Due.' },
      {
        text: 'Pick any day here.',
        ring: () => '[role="dialog"] [data-item-field="due"]',
      },
    ],
    done: (c) => c.practice.some((i) => hasValue(i.fields.due)),
  };
  const ship: Mission<SprintCtx> = {
    id: 'ship-card',
    title: 'Ship it',
    why: `Drag a practice card all the way into ${shape.shipName}.`,
    lesson: `Done is a column too. The header's widgets count what reaches ${shape.shipName}.`,
    hints: [
      { text: 'Close the card, then drag one right until it lands.' },
      { text: `Here, in ${shape.shipName}.`, ring: () => cellOf(shape.boardId, shape.shipStatus) },
    ],
    done: (c) => c.practice.some((i) => statusOf(i) === c.shipStatus),
  };
  // A board of one column has nowhere to move a card to: only the card's own missions.
  const flows = shape.nextStatus !== shape.firstStatus;
  return [...(flows ? [move] : []), open, ...(shape.hasDue ? [due] : []), ...(flows ? [ship] : [])];
}

// The first column whose WIP limit the board has gone over, by name and limit, or null.
export function overWipColumn(
  columns: readonly { status: string; name: string; wipLimit?: number }[],
  items: Iterable<Item>,
): { name: string; limit: number } | null {
  const counts = new Map<string, number>();
  for (const i of items) {
    const s = statusOf(i);
    if (typeof s === 'string') counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const over = columns.find(
    (c) => c.wipLimit !== undefined && (counts.get(c.status) ?? 0) > c.wipLimit,
  );
  return over && over.wipLimit !== undefined ? { name: over.name, limit: over.wipLimit } : null;
}

export function wipNote(over: { name: string; limit: number }): string {
  return `${over.name} is over its limit of ${over.limit}, so its count turns amber. Finish something before starting more.`;
}

// ---------------------------------------------------------------- Sheets: Five Small Wins

// What the challenges read from the practice sheet, by A1 address.
export type PracticeSheetCtx = {
  // The cell's worked-out value: a number, a string, a boolean, or null when empty or an error.
  value: (a1: string) => number | string | boolean | null;
  // Whether the cell holds a formula.
  isFormula: (a1: string) => boolean;
  // Whether the cell shows its number as currency.
  currency: (a1: string) => boolean;
  // Whether a chart has been made from the sheet's cells.
  charted: boolean;
};

const near = (a: unknown, b: number) => typeof a === 'number' && Math.abs(a - b) < 1e-9;
const num = (ctx: PracticeSheetCtx, a1: string) => {
  const v = ctx.value(a1);
  return typeof v === 'number' ? v : 0;
};

// The cells of a range like B2:D7, as A1 addresses, row by row (single-letter columns: the practice sheet's).
export function a1Range(from: string, to: string): string[] {
  const col = (a: string) => a.charCodeAt(0);
  const row = (a: string) => Number(a.slice(1));
  const out: string[] = [];
  for (let r = row(from); r <= row(to); r++)
    for (let c = col(from); c <= col(to); c++) out.push(`${String.fromCharCode(c)}${r}`);
  return out;
}

// A challenge, with the cells that glow while it is current.
export type SheetMission = Mission<PracticeSheetCtx> & { cells: readonly string[] };

// The five challenges, in order (plan-tour.md "Sheets: Five Small Wins"). `touch`: the fill hint for a finger.
export function sheetMissions(touch: boolean): SheetMission[] {
  const ring = (a1: string) => () => `[data-practice-sheet] [data-practice-cell~="${a1}"]`;
  const switcher = () => '[data-practice-sheet] [aria-label="Toolbar category"]';
  const typeValue: SheetMission = {
    id: 'type-value',
    cells: ['C4'],
    title: 'Type a number',
    why: 'Transport came to 122 this month. Type it into C4.',
    lesson: 'Numbers, dates and percentages are read as you type them.',
    hints: [
      { text: 'Select C4, type 122, then press Enter.' },
      { text: 'This cell.', ring: ring('C4') },
    ],
    done: (c) => near(c.value('C4'), 122),
  };
  const sum: SheetMission = {
    id: 'sum',
    cells: ['C7'],
    title: 'Add it up',
    why: 'Total what you spent, in C7.',
    lesson: 'Start with = to write a formula, and drag over cells to point at them.',
    hints: [
      { text: 'In C7, type =SUM( then drag over C2 to C6, and press Enter.' },
      { text: 'The whole formula is =SUM(C2:C6).', ring: ring('C7') },
    ],
    done: (c) =>
      c.isFormula('C7') &&
      near(
        c.value('C7'),
        a1Range('C2', 'C6').reduce((t, a1) => t + num(c, a1), 0),
      ),
  };
  const fill: SheetMission = {
    id: 'fill-down',
    cells: a1Range('D2', 'D6'),
    title: 'Fill it down',
    why: "D2 works out what's left of Rent. Fill it down to D6.",
    lesson: 'A filled formula follows its row: each one now reads its own Planned and Actual.',
    hints: [
      {
        text: touch
          ? 'Select D2 to D6, then pick Fill Down from the cells menu.'
          : 'Select D2, then drag the small square at its corner down to D6.',
      },
      {
        text: touch ? 'These five cells.' : 'Or select D2 to D6 and press Ctrl+D.',
        ring: ring('D2'),
      },
    ],
    done: (c) =>
      a1Range('D3', 'D6').every(
        (a1) =>
          c.isFormula(a1) &&
          near(c.value(a1), num(c, `B${a1.slice(1)}`) - num(c, `C${a1.slice(1)}`)),
      ),
  };
  const currency: SheetMission = {
    id: 'currency',
    cells: a1Range('B2', 'D7'),
    title: 'Make it money',
    why: 'Show B2 to D7 as currency.',
    lesson: 'The toolbar acts on whatever you have selected.',
    hints: [
      { text: 'Select B2 to D7, then Numbers › Number Format › a Currency.' },
      { text: 'The categories switch here.', ring: switcher },
    ],
    done: (c) => {
      const numbers = a1Range('B2', 'D7').filter((a1) => typeof c.value(a1) === 'number');
      return numbers.length > 0 && numbers.every((a1) => c.currency(a1));
    },
  };
  const chart: SheetMission = {
    id: 'chart',
    cells: a1Range('A1', 'C6'),
    title: 'Chart it',
    why: 'Chart planned against actual.',
    lesson: 'Charts read the cells, so they change when the numbers do.',
    hints: [
      { text: 'Select A1 to C6, then Data › Insert Chart.' },
      { text: 'Data is one of the categories here.', ring: switcher },
    ],
    done: (c) => c.charted,
  };
  return [typeValue, sum, fill, currency, chart];
}

// Telemetry `type` token for a mission view: 'move-card' → 'PlanTourStepMoveCard'.
export function planTourStepTelemetryType(stepId: string): string {
  return stepTelemetryType('PlanTourStep', stepId);
}
