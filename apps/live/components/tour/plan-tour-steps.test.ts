// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PLAN_TOUR_STEPS,
  firstCardOn,
  planTourSteps,
  planTourStepTelemetryType,
  type PlanTourApi,
} from './plan-tour-steps';

// The Plan tour's steps (docs/specs/026-plan/plan-tour.md "The steps"): they run on the person's own board or
// Sheet (the tour subject) and only point at it, opening nothing but a card's panel.

const api = (over: Partial<PlanTourApi> = {}): PlanTourApi => ({
  boardId: () => 'board1',
  sheetElementId: () => 'sheet1',
  firstCardId: () => 'card1',
  openCard: vi.fn(),
  closeCard: vi.fn(),
  ...over,
});
const step = (id: string) => PLAN_TOUR_STEPS.find((s) => s.id === id)!;
const SHEET_STEPS = planTourSteps('sheets');
const sheetStep = (id: string) => SHEET_STEPS.find((s) => s.id === id)!;

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('PLAN_TOUR_STEPS', () => {
  it('runs welcome, six steps, then the outro', () => {
    expect(PLAN_TOUR_STEPS.map((s) => s.id)).toEqual([
      'welcome',
      'board',
      'add-cards',
      'move-card',
      'card-panel',
      'board-header',
      'card-types',
      'outro',
    ]);
    expect(PLAN_TOUR_STEPS[0]!.card).toBe('welcome');
    expect(PLAN_TOUR_STEPS.at(-1)!.card).toBe('outro');
    expect(PLAN_TOUR_STEPS.filter((s) => !s.card)).toHaveLength(6);
  });

  it('keeps its copy short and free of em dashes', () => {
    for (const s of [
      ...PLAN_TOUR_STEPS,
      ...SHEET_STEPS,
      planTourSteps('boards', { offer: 'choice' })[0]!,
    ]) {
      expect(s.body.length, s.id).toBeLessThanOrEqual(180);
      expect(`${s.title}${s.body}`).not.toContain('\u2014');
    }
  });

  it('titles every step in Title Case', () => {
    for (const s of [...PLAN_TOUR_STEPS, ...SHEET_STEPS].filter((x) => !x.card))
      for (const word of s.title.split(' ').filter((w) => w !== 'the'))
        expect(word.charAt(0), s.id).toBe(word.charAt(0).toUpperCase());
  });

  it("points the board steps at the person's board, its first column, card and header", () => {
    const a = api();
    expect(step('board').selector!(a)).toBe('[data-element-id="board1"]');
    expect(step('add-cards').selector!(a)).toBe('[data-element-id="board1"] [data-plan-status]');
    expect(step('move-card').selector!(a)).toBe(
      '[data-element-id="board1"] [data-plan-card="card1"]',
    );
    expect(step('card-panel').selector!(a)).toBe('[role="dialog"][aria-label^="Item #"]');
    expect(step('board-header').selector!(a)).toBe(
      '[data-element-id="board1"] [data-board-header]',
    );
  });

  it('has no anchor without a board or a card', () => {
    const a = api({ boardId: () => null, firstCardId: () => null });
    expect(step('board').selector!(a)).toBeNull();
    expect(step('add-cards').selector!(a)).toBeNull();
    expect(step('move-card').selector!(a)).toBeNull();
    expect(step('board-header').selector!(a)).toBeNull();
  });

  // Spec "Tour subject": it changes nothing; the only step that prepares anything opens a card's panel.
  it('changes nothing on the board: only the card panel step opens anything, and closes it after', async () => {
    const a = api();
    const preparing = PLAN_TOUR_STEPS.filter((s) => s.prepare).map((s) => s.id);
    expect(preparing).toEqual(['card-panel', 'board-header']);
    await step('card-panel').prepare!(a);
    expect(a.openCard).toHaveBeenCalledTimes(1);
    step('card-panel').cleanup!(a);
    expect(a.closeCard).toHaveBeenCalledTimes(1);
    await step('board-header').prepare!(a);
    expect(a.closeCard).toHaveBeenCalledTimes(2);
    expect(a.openCard).toHaveBeenCalledTimes(1);
  });

  it('leaves out the card steps for a board with no cards', () => {
    expect(planTourSteps('boards', { hasCards: false }).map((s) => s.id)).toEqual([
      'welcome',
      'board',
      'add-cards',
      'board-header',
      'card-types',
      'outro',
    ]);
  });

  it('says the board is left as it was', () => {
    expect(step('outro').body).toMatch(/just as you left it/);
    expect(step('outro').prepare).toBeUndefined();
  });
});

describe('the welcome card', () => {
  it('names the one track on offer, and asks which when the tab has both', () => {
    expect(planTourSteps('boards')[0]!.body).toMatch(/your board/);
    expect(planTourSteps('sheets')[0]!.body).toMatch(/your sheet/);
    expect(planTourSteps('boards', { offer: 'choice' })[0]!.body).toMatch(/Which/);
    expect(planTourSteps('sheets', { offer: 'choice' })[0]!.body).toMatch(/Which/);
    for (const offer of ['boards', 'sheets', 'choice'] as const)
      expect(planTourSteps('boards', { offer })[0]!.body).toMatch(/never change anything/);
  });
});

describe("planTourSteps('sheets')", () => {
  it('runs a welcome, five sheet steps, then its own outro', () => {
    expect(SHEET_STEPS.map((s) => s.id)).toEqual([
      'welcome',
      'sheet',
      'cells',
      'formulas',
      'sheet-toolbar',
      'sheet-settings',
      'outro',
    ]);
    expect(SHEET_STEPS.filter((s) => !s.card)).toHaveLength(5);
    expect(SHEET_STEPS.at(-1)!.body).toContain('your sheet');
  });

  it("points each step at a part of the person's sheet", () => {
    const a = api();
    const on = '[data-element-id="sheet1"]';
    expect(sheetStep('sheet').selector!(a)).toBe(on);
    expect(sheetStep('cells').selector!(a)).toBe(`${on} [role="grid"]`);
    expect(sheetStep('formulas').selector!(a)).toBe(`${on} [data-sheet-formula-bar]`);
    expect(sheetStep('sheet-toolbar').selector!(a)).toBe(`${on} [role="toolbar"]`);
    expect(sheetStep('sheet-settings').selector!(a)).toBe(
      `${on} button[aria-label="Sheet Settings"]`,
    );
    const none = api({ sheetElementId: () => null });
    for (const id of ['sheet', 'cells', 'formulas', 'sheet-toolbar', 'sheet-settings'])
      expect(sheetStep(id).selector!(none), id).toBeNull();
  });

  it('prepares nothing: no step selects a cell or places anything', () => {
    expect(SHEET_STEPS.filter((s) => s.prepare || s.cleanup)).toEqual([]);
  });
});

describe('firstCardOn', () => {
  it("reads the board's first drawn card", () => {
    document.body.innerHTML =
      '<div data-element-id="b1"><div data-plan-card="c1"></div><div data-plan-card="c2"></div></div>' +
      '<div data-element-id="b2"></div>';
    expect(firstCardOn('b1')).toBe('c1');
    expect(firstCardOn('b2')).toBeNull();
    expect(firstCardOn(null)).toBeNull();
  });
});

describe('planTourStepTelemetryType', () => {
  it('names a step PlanTourStep<Id>', () => {
    expect(planTourStepTelemetryType('add-cards')).toBe('PlanTourStepAddCards');
    expect(planTourStepTelemetryType('outro')).toBe('PlanTourStepOutro');
    expect(planTourStepTelemetryType('sheet-settings')).toBe('PlanTourStepSheetSettings');
  });
});
