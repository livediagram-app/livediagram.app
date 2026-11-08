// @vitest-environment jsdom

// The Plan tour's missions (docs/specs/026-plan/plan-tour.md "Boards: Practice Sprint", "Sheets: Five Small Wins"):
// each is done by what the person really did, and the subject is the board or Sheet they see.

import type { Item } from '@liveplanner/items';
import { afterEach, describe, expect, it } from 'vitest';
import {
  a1Range,
  boardRoot,
  FINISH_STEP,
  needsReveal,
  overWipColumn,
  planTourStepTelemetryType,
  sheetMissions,
  sheetRoot,
  sprintMissions,
  visiblePlanWork,
  wipNote,
  type PracticeSheetCtx,
  type SprintCtx,
  type SprintShape,
} from './plan-tour-steps';

const card = (id: string, fields: Record<string, unknown>): Item =>
  ({ id, type: 'task', key: 0, rank: 'a', fields }) as unknown as Item;

const SHAPE: SprintShape = {
  boardId: 'b0',
  firstStatus: 'todo',
  nextStatus: 'doing',
  nextName: 'Doing',
  shipStatus: 'done',
  shipName: 'Done',
  hasDue: true,
  phone: false,
};
const ctxOf = (practice: Item[], openItemId: string | null = null): SprintCtx => ({
  ...SHAPE,
  practice,
  openItemId,
});
const dealt = () => [card('p1', { status: 'todo' }), card('p2', { status: 'todo' })];

afterEach(() => {
  document.body.innerHTML = '';
});

describe('sprintMissions', () => {
  it('runs move, open, date and ship in order', () => {
    expect(sprintMissions(SHAPE).map((m) => m.id)).toEqual([
      'move-card',
      'open-card',
      'due-date',
      'ship-card',
    ]);
  });

  it('skips the date without a Due field, and the moves on a one-column board', () => {
    expect(sprintMissions({ ...SHAPE, hasDue: false }).map((m) => m.id)).toEqual([
      'move-card',
      'open-card',
      'ship-card',
    ]);
    expect(sprintMissions({ ...SHAPE, nextStatus: 'todo' }).map((m) => m.id)).toEqual([
      'open-card',
      'due-date',
    ]);
  });

  it('checks each mission from the practice cards as they are', () => {
    const [move, open, due, ship] = sprintMissions(SHAPE);
    expect(move!.done(ctxOf(dealt()))).toBe(false);
    expect(move!.done(ctxOf([card('p1', { status: 'doing' })]))).toBe(true);
    expect(open!.done(ctxOf(dealt()))).toBe(false);
    expect(open!.done(ctxOf(dealt(), 'someone-else'))).toBe(false);
    expect(open!.done(ctxOf(dealt(), 'p2'))).toBe(true);
    expect(due!.done(ctxOf([card('p1', { status: 'todo', due: '' })]))).toBe(false);
    expect(due!.done(ctxOf([card('p1', { status: 'todo', due: '2026-11-09' })]))).toBe(true);
    expect(ship!.done(ctxOf([card('p1', { status: 'doing' })]))).toBe(false);
    expect(ship!.done(ctxOf([card('p1', { status: 'done' })]))).toBe(true);
  });

  it('words drag and open for a phone, and rings the target columns', () => {
    const phone = sprintMissions({ ...SHAPE, phone: true });
    expect(phone[0]!.why).toMatch(/^Hold/);
    expect(phone[0]!.hints[0]!.text).toMatch(/Hold a card/);
    expect(phone[1]!.why).toMatch(/^Tap/);
    expect(phone[1]!.hints[0]!.text).toBe('Tap any dashed card.');
    const desk = sprintMissions(SHAPE);
    expect(desk[0]!.hints[1]!.ring!()).toBe(`${boardRoot('b0')} [data-plan-status="doing"]`);
    expect(desk[1]!.hints[1]!.ring!()).toBe(`${boardRoot('b0')} [data-practice]`);
    expect(desk[2]!.hints[1]!.ring!()).toBe('[role="dialog"] [data-item-field="due"]');
    expect(desk[3]!.hints[1]!.ring!()).toBe(`${boardRoot('b0')} [data-plan-status="done"]`);
  });
});

describe('overWipColumn', () => {
  const cols = [
    { status: 'todo', name: 'To Do' },
    { status: 'doing', name: 'Doing', wipLimit: 1 },
  ];
  it('names the first column over its limit, or null', () => {
    expect(overWipColumn(cols, [card('a', { status: 'doing' })])).toBeNull();
    expect(
      overWipColumn(cols, [card('a', { status: 'doing' }), card('b', { status: 'doing' }), card('c', {})]),
    ).toEqual({ name: 'Doing', limit: 1 });
  });
  it('says what the amber count means', () => {
    expect(wipNote({ name: 'Doing', limit: 1 })).toMatch(/^Doing is over its limit of 1/);
  });
});

describe('sheetMissions', () => {
  // A practice sheet from a map of A1 values; formulas are the cells listed in `formulas`.
  const sheet = (
    values: Record<string, number | string>,
    formulas: string[] = [],
    currency: string[] = [],
    charted = false,
  ): PracticeSheetCtx => ({
    value: (a1) => values[a1] ?? null,
    isFormula: (a1) => formulas.includes(a1),
    currency: (a1) => currency.includes(a1),
    charted,
  });
  const BASE = { B2: 1200, C2: 1200, B3: 400, C3: 436, B4: 150, B5: 200, C5: 265, B6: 500, C6: 500 };

  it('runs the five challenges in order, each with its cells', () => {
    const m = sheetMissions(false);
    expect(m.map((x) => x.id)).toEqual(['type-value', 'sum', 'fill-down', 'currency', 'chart']);
    expect(m[0]!.cells).toEqual(['C4']);
    expect(m[2]!.cells).toEqual(['D2', 'D3', 'D4', 'D5', 'D6']);
  });

  it('checks each challenge from the cells', () => {
    const [type, sum, fill, money, chart] = sheetMissions(false);
    expect(type!.done(sheet(BASE))).toBe(false);
    expect(type!.done(sheet({ ...BASE, C4: 122 }))).toBe(true);
    const spent = 1200 + 436 + 122 + 265 + 500;
    expect(sum!.done(sheet({ ...BASE, C4: 122, C7: spent }))).toBe(false);
    expect(sum!.done(sheet({ ...BASE, C4: 122, C7: spent }, ['C7']))).toBe(true);
    expect(sum!.done(sheet({ ...BASE, C4: 122, C7: 1 }, ['C7']))).toBe(false);
    const left = { D3: -36, D4: 28, D5: -65, D6: 0 };
    const D = ['D3', 'D4', 'D5', 'D6'];
    expect(fill!.done(sheet({ ...BASE, C4: 122, ...left }, D))).toBe(true);
    expect(fill!.done(sheet({ ...BASE, C4: 122, ...left }, ['D3']))).toBe(false);
    expect(fill!.done(sheet({ ...BASE, C4: 122, ...left, D4: 0 }, D))).toBe(false);
    expect(money!.done(sheet({}))).toBe(false);
    expect(money!.done(sheet({ B2: 1, C2: 2 }, [], ['B2']))).toBe(false);
    expect(money!.done(sheet({ B2: 1, C2: 2, A2: 'Rent' }, [], ['B2', 'C2']))).toBe(true);
    expect(chart!.done(sheet({}))).toBe(false);
    expect(chart!.done(sheet({}, [], [], true))).toBe(true);
  });

  it('gives a finger Fill Down from the menu, and rings cells and the category switcher', () => {
    const touch = sheetMissions(true)[2]!;
    expect(touch.hints[0]!.text).toMatch(/Fill Down/);
    expect(touch.hints[1]!.text).toBe('These five cells.');
    const desk = sheetMissions(false);
    expect(desk[2]!.hints[0]!.text).toMatch(/drag the small square/);
    expect(desk[0]!.hints[1]!.ring!()).toBe('[data-practice-sheet] [data-practice-cell~="C4"]');
    expect(desk[3]!.hints[1]!.ring!()).toBe(
      '[data-practice-sheet] [aria-label="Toolbar category"]',
    );
    expect(desk[4]!.hints[1]!.ring!()).toBe(desk[3]!.hints[1]!.ring!());
  });

  it('reads a range row by row', () => {
    expect(a1Range('A1', 'B2')).toEqual(['A1', 'B1', 'A2', 'B2']);
  });
});

describe('tour subject', () => {
  it('picks the body over the canvas, then one on screen, then the first', () => {
    expect(visiblePlanWork([], boardRoot)).toBeNull();
    document.body.innerHTML =
      '<div data-plan-board="b0"></div><div data-canvas-cover><div data-plan-board="b1"></div></div>';
    expect(visiblePlanWork(['b0', 'b1'], boardRoot)).toBe('b1');
    document.body.innerHTML = '<div data-plan-sheet="s0"></div><div data-plan-sheet="s1"></div>';
    expect(visiblePlanWork(['s0', 's1'], sheetRoot)).toBe('s0');
    const s1 = document.querySelector('[data-plan-sheet="s1"]')!;
    s1.getBoundingClientRect = () => ({ left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }) as DOMRect;
    expect(visiblePlanWork(['s0', 's1'], sheetRoot)).toBe('s1');
  });

  it('reveals a body only when it is drawn on the canvas and off screen', () => {
    expect(needsReveal(null)).toBe(false);
    expect(needsReveal(boardRoot('none'))).toBe(true);
    document.body.innerHTML =
      '<div data-canvas-cover><div data-plan-board="b1"></div></div><div data-plan-board="b0"></div>';
    expect(needsReveal(boardRoot('b1'))).toBe(false);
    expect(needsReveal(boardRoot('b0'))).toBe(false);
    const b0 = document.querySelector('[data-plan-board="b0"]')!;
    b0.getBoundingClientRect = () => ({ left: -5, top: 0, right: 10, bottom: 10 }) as DOMRect;
    expect(needsReveal(boardRoot('b0'))).toBe(true);
  });
});

describe('telemetry', () => {
  it('names a mission view and the finish', () => {
    expect(planTourStepTelemetryType('move-card')).toBe('PlanTourStepMoveCard');
    expect(planTourStepTelemetryType(FINISH_STEP.id)).toBe('PlanTourStepOutro');
  });
});
