// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  boardRoot,
  firstCardOn,
  needsReveal,
  sheetRoot,
  visiblePlanWork,
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
  reveal: vi.fn(),
  ...over,
});
const PLAN_TOUR_STEPS = planTourSteps('boards');
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

  // Spec "The tour subject": the board as drawn (its body), never its canvas node, hidden under a maximised or
  // tab-filling body.
  it("points the board steps at the person's drawn board, its first column, card and header", () => {
    const a = api();
    // The opening step is a card with no ring: one round the whole board would light most of the screen.
    expect(step('board').selector).toBeUndefined();
    expect(step('add-cards').selector!(a)).toBe(
      '[data-plan-board="board1"] [data-add-card-trigger]',
    );
    expect(step('move-card').selector!(a)).toBe(
      '[data-plan-board="board1"] [data-plan-card="card1"]',
    );
    expect(step('card-panel').selector!(a)).toBe('[role="dialog"][aria-label^="Item #"]');
    expect(step('board-header').selector!(a)).toBe(
      '[data-plan-board="board1"] [data-board-header]',
    );
    for (const s of PLAN_TOUR_STEPS) expect(s.selector?.(a) ?? '').not.toContain('data-element-id');
  });

  it('has no anchor without a board or a card', () => {
    const a = api({ boardId: () => null, firstCardId: () => null });
    expect(step('add-cards').selector!(a)).toBeNull();
    expect(step('move-card').selector!(a)).toBeNull();
    expect(step('board-header').selector!(a)).toBeNull();
  });

  // Spec "Tour subject": it changes nothing; the only step that prepares anything opens a card's panel.
  it('changes nothing on the board: it brings the board into view, and only the card panel step opens anything', async () => {
    const a = api();
    const preparing = PLAN_TOUR_STEPS.filter((s) => s.prepare).map((s) => s.id);
    expect(preparing).toEqual(['board', 'card-panel', 'board-header']);
    await step('board').prepare!(a);
    expect(a.reveal).toHaveBeenCalledWith('boards');
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
  it('names the track on offer in its title, never the mode', () => {
    expect(planTourSteps('boards')[0]!.title).toBe('Getting started with boards?');
    expect(planTourSteps('sheets')[0]!.title).toBe('Getting started with sheets?');
    expect(planTourSteps('boards', { offer: 'choice' })[0]!.title).toMatch(/boards and sheets/);
    for (const offer of ['boards', 'sheets', 'choice'] as const)
      expect(planTourSteps('boards', { offer })[0]!.title).not.toMatch(/Plan/);
  });

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
    const on = '[data-plan-sheet="sheet1"]';
    // The opening step is a card with no ring, and the cells step rings A1 alone, never the whole grid.
    expect(sheetStep('sheet').selector).toBeUndefined();
    expect(sheetStep('cells').selector!(a)).toBe(`${on} [data-sheet-a1]`);
    expect(sheetStep('formulas').selector!(a)).toBe(`${on} [data-sheet-formula-bar]`);
    expect(sheetStep('sheet-toolbar').selector!(a)).toBe(`${on} [role="toolbar"]`);
    expect(sheetStep('sheet-settings').selector!(a)).toBe(
      `${on} button[aria-label="Sheet Settings"]`,
    );
    const none = api({ sheetElementId: () => null });
    for (const id of ['cells', 'formulas', 'sheet-toolbar', 'sheet-settings'])
      expect(sheetStep(id).selector!(none), id).toBeNull();
  });

  it('prepares nothing but bringing the sheet into view: no step selects a cell or places anything', async () => {
    expect(SHEET_STEPS.filter((s) => s.prepare || s.cleanup).map((s) => s.id)).toEqual(['sheet']);
    const a = api();
    await sheetStep('sheet').prepare!(a);
    expect(a.reveal).toHaveBeenCalledWith('sheets');
  });
});

describe('firstCardOn', () => {
  it("reads the board's first drawn card", () => {
    document.body.innerHTML =
      '<div data-plan-board="b1"><div data-plan-card="c1"></div><div data-plan-card="c2"></div></div>' +
      '<div data-plan-board="b2"></div>';
    expect(firstCardOn('b1')).toBe('c1');
    expect(firstCardOn('b2')).toBeNull();
    expect(firstCardOn(null)).toBeNull();
  });
});

// Spec "The tour subject": the board or Sheet the person sees.
describe('visiblePlanWork', () => {
  const box = (el: Element, r: Partial<DOMRect>) =>
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      ...r,
    } as DOMRect);

  it('is null with nothing on the tab', () => {
    expect(visiblePlanWork([], boardRoot)).toBeNull();
  });

  it('takes the one maximised or filling the tab first', () => {
    document.body.innerHTML =
      '<div data-plan-board="b1"></div><div data-canvas-cover><div><div data-plan-board="b2"></div></div></div>';
    expect(visiblePlanWork(['b1', 'b2'], boardRoot)).toBe('b2');
  });

  it('then one on screen, then the first', () => {
    document.body.innerHTML = '<div data-plan-sheet="s1"></div><div data-plan-sheet="s2"></div>';
    box(document.querySelector(sheetRoot('s1'))!, { left: -500, right: -400 });
    box(document.querySelector(sheetRoot('s2'))!, {});
    expect(visiblePlanWork(['s1', 's2'], sheetRoot)).toBe('s2');
    box(document.querySelector(sheetRoot('s2'))!, { top: 5000, bottom: 5100 });
    expect(visiblePlanWork(['s1', 's2'], sheetRoot)).toBe('s1');
  });
});

describe('needsReveal', () => {
  it('leaves a maximised or tab-filling body alone, and asks for one off the window', () => {
    document.body.innerHTML =
      '<div data-canvas-cover><div data-plan-board="b1"></div></div><div data-plan-board="b2"></div>';
    expect(needsReveal(boardRoot('b1'))).toBe(false);
    const b2 = document.querySelector(boardRoot('b2'))!;
    vi.spyOn(b2, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 10,
      right: 110,
      bottom: 110,
    } as DOMRect);
    expect(needsReveal(boardRoot('b2'))).toBe(false);
    vi.spyOn(b2, 'getBoundingClientRect').mockReturnValue({
      left: -300,
      top: 10,
      right: -200,
      bottom: 110,
    } as DOMRect);
    expect(needsReveal(boardRoot('b2'))).toBe(true);
    expect(needsReveal(null)).toBe(false);
  });
});

describe('planTourStepTelemetryType', () => {
  it('names a step PlanTourStep<Id>', () => {
    expect(planTourStepTelemetryType('add-cards')).toBe('PlanTourStepAddCards');
    expect(planTourStepTelemetryType('outro')).toBe('PlanTourStepOutro');
    expect(planTourStepTelemetryType('sheet-settings')).toBe('PlanTourStepSheetSettings');
  });
});
