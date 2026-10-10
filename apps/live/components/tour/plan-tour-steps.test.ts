// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PLAN_TOUR_STEPS,
  planTourSteps,
  planTourStepTelemetryType,
  type PlanTourApi,
} from './plan-tour-steps';

// The Plan tour's steps (docs/specs/026-plan/plan-tour.md "The steps").

const clickTour = vi.hoisted(() => vi.fn());
const findTour = vi.hoisted(() => vi.fn((_id: string): HTMLElement | null => null));
vi.mock('./tour-dom', () => ({
  clickTour,
  findTour,
  waitForSelector: async () => null,
}));

const api = (over: Partial<PlanTourApi> = {}): PlanTourApi => ({
  placeBoard: vi.fn(async () => {}),
  placeSheet: vi.fn(async () => {}),
  selectTotal: vi.fn(),
  sheetElementId: () => 'sheet1',
  addCards: vi.fn(async () => {}),
  moveCard: vi.fn(async () => {}),
  openCard: vi.fn(),
  closeCard: vi.fn(),
  removeContent: vi.fn(),
  boardId: () => 'board1',
  firstCardId: () => 'card1',
  status: (column) => `${column}~abcd`,
  ...over,
});
const step = (id: string) => PLAN_TOUR_STEPS.find((s) => s.id === id)!;
const SHEET_STEPS = planTourSteps('sheets');
const sheetStep = (id: string) => SHEET_STEPS.find((s) => s.id === id)!;

afterEach(() => vi.clearAllMocks());

describe('PLAN_TOUR_STEPS', () => {
  it('runs welcome, seven steps, then the outro', () => {
    expect(PLAN_TOUR_STEPS.map((s) => s.id)).toEqual([
      'welcome',
      'board',
      'add-cards',
      'move-card',
      'card-panel',
      'board-header',
      'card-types',
      'palette',
      'outro',
    ]);
    expect(PLAN_TOUR_STEPS[0]!.card).toBe('welcome');
    expect(PLAN_TOUR_STEPS.at(-1)!.card).toBe('outro');
    expect(PLAN_TOUR_STEPS.filter((s) => !s.card)).toHaveLength(7);
  });

  it('keeps its copy short and free of em dashes', () => {
    for (const s of [...PLAN_TOUR_STEPS, ...SHEET_STEPS]) {
      expect(s.body.length, s.id).toBeLessThanOrEqual(180);
      expect(`${s.title}${s.body}`).not.toContain('\u2014');
    }
  });

  it('points the board steps at the example board, its column, card and header', () => {
    const a = api();
    expect(step('board').selector!(a)).toBe('[data-element-id="board1"]');
    expect(step('add-cards').selector!(a)).toBe(
      '[data-element-id="board1"] [data-plan-status="todo~abcd"]',
    );
    expect(step('move-card').selector!(a)).toBe('[data-plan-card="card1"]');
    expect(step('card-panel').selector!(a)).toBe('[role="dialog"][aria-label^="Item #"]');
    expect(step('board-header').selector!(a)).toBe(
      '[data-element-id="board1"] [data-board-header]',
    );
  });

  it('has no anchor yet before the tour content exists', () => {
    const a = api({ boardId: () => null, firstCardId: () => null, status: () => null });
    expect(step('board').selector!(a)).toBeNull();
    expect(step('add-cards').selector!(a)).toBeNull();
    expect(step('move-card').selector!(a)).toBeNull();
    expect(step('board-header').selector!(a)).toBeNull();
  });

  it('makes the tour content as it goes, each step finding what came before', async () => {
    const a = api();
    await step('board').prepare!(a);
    expect(a.placeBoard).toHaveBeenCalledTimes(1);
    await step('add-cards').prepare!(a);
    expect(a.addCards).toHaveBeenCalledTimes(1);
    await step('move-card').prepare!(a);
    expect(a.moveCard).toHaveBeenCalledTimes(1);
    expect(a.placeBoard).toHaveBeenCalledTimes(3);
  });

  it('opens the first card for the panel step and closes it after', async () => {
    const a = api();
    await step('card-panel').prepare!(a);
    expect(a.openCard).toHaveBeenCalled();
    step('card-panel').cleanup!(a);
    expect(a.closeCard).toHaveBeenCalled();
    await step('board-header').prepare!(a);
    expect(a.closeCard).toHaveBeenCalledTimes(2);
  });

  it('opens the category picker for the palette step, and closes it on leaving', async () => {
    await step('palette').prepare!(api());
    expect(clickTour).toHaveBeenCalledWith('palette-category');
    findTour.mockReturnValue(document.body);
    clickTour.mockClear();
    step('palette').cleanup!(api());
    expect(clickTour).toHaveBeenCalledWith('palette-category');
  });

  it('takes the tour content away as the outro shows', async () => {
    const a = api();
    await step('outro').prepare!(a);
    expect(a.removeContent).toHaveBeenCalled();
  });
});

describe("planTourSteps('sheets')", () => {
  it('runs the same welcome, six sheet steps, then its own outro', () => {
    expect(SHEET_STEPS.map((s) => s.id)).toEqual([
      'welcome',
      'sheet',
      'cells',
      'formulas',
      'sheet-toolbar',
      'sheet-settings',
      'sheet-palette',
      'outro',
    ]);
    expect(SHEET_STEPS[0]).toBe(PLAN_TOUR_STEPS[0]);
    expect(SHEET_STEPS.filter((s) => !s.card)).toHaveLength(6);
    expect(SHEET_STEPS.at(-1)!.body).toContain('example sheet');
  });

  it('points each step at a part of the example sheet', () => {
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

  it('places the sheet, then selects its total for the formula step', async () => {
    const a = api();
    await sheetStep('sheet').prepare!(a);
    await sheetStep('cells').prepare!(a);
    expect(a.placeSheet).toHaveBeenCalledTimes(2);
    expect(a.selectTotal).not.toHaveBeenCalled();
    await sheetStep('formulas').prepare!(a);
    expect(a.selectTotal).toHaveBeenCalledTimes(1);
    expect(a.placeBoard).not.toHaveBeenCalled();
  });

  it('opens the category picker, and takes the sheet away as the outro shows', async () => {
    findTour.mockReturnValue(null);
    await sheetStep('sheet-palette').prepare!(api());
    expect(clickTour).toHaveBeenCalledWith('palette-category');
    const a = api();
    await sheetStep('outro').prepare!(a);
    expect(a.removeContent).toHaveBeenCalled();
  });
});

describe('planTourStepTelemetryType', () => {
  it('names a step PlanTourStep<Id>', () => {
    expect(planTourStepTelemetryType('add-cards')).toBe('PlanTourStepAddCards');
    expect(planTourStepTelemetryType('outro')).toBe('PlanTourStepOutro');
    expect(planTourStepTelemetryType('sheet-settings')).toBe('PlanTourStepSheetSettings');
  });
});
