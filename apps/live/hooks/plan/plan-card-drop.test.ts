// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape } from '@livediagram/document';
import { registerPlanBoardTarget, type PlanBoardTarget } from './plan-board-targets';
import {
  boardClientPoint,
  dropPlanCardAt,
  planCardHoverAt,
  PLAN_CARD_MISSED,
} from './plan-card-drop';

// docs/specs/026-plan/plan-mode.md "The palette": a palette card lands only in a board's column.
function boardDom(id: string) {
  const root = document.createElement('div');
  root.dataset.planBoard = id;
  const cell = document.createElement('div');
  cell.dataset.planStatus = 'todo';
  cell.dataset.planLane = '';
  root.appendChild(cell);
  document.body.appendChild(root);
  root.getBoundingClientRect = () => ({ left: 100, top: 50, width: 400, height: 200 }) as DOMRect;
  return { root, cell };
}

function target(patch: Partial<PlanBoardTarget> = {}): PlanBoardTarget {
  return {
    accepts: () => true,
    refusal: () => 'This board shows Bug items only',
    drop: vi.fn(),
    hover: vi.fn(),
    acceptsType: () => true,
    addCard: vi.fn(),
    refuseAt: () => null,
    canEditWidgets: () => true,
    widgetHover: vi.fn(),
    placeWidget: vi.fn(),
    ...patch,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('a palette card', () => {
  it('maps a canvas point through the board drawn there, and misses off every board', () => {
    boardDom('b1');
    const board = {
      ...createShape('plan-board', 0, 0),
      id: 'b1',
      x: 0,
      y: 0,
      width: 800,
      height: 400,
    };
    expect(boardClientPoint([board], 400, 200)).toEqual({ x: 300, y: 150 });
    expect(boardClientPoint([board], 900, 200)).toBeNull();
  });

  it('goes into the column under the point', () => {
    const { root, cell } = boardDom('b1');
    const t = target();
    const off = registerPlanBoardTarget('b1', t);
    document.elementsFromPoint = () => [cell, root];
    expect(dropPlanCardAt('bug', 10, 10)).toEqual({ outcome: 'added' });
    expect(t.addCard).toHaveBeenCalledWith('bug', { status: 'todo', laneKey: '', beforeId: null });
    off();
  });

  it('is refused by a board that does not show the type, and made nowhere off a board', () => {
    const { root, cell } = boardDom('b1');
    const t = target({ acceptsType: () => false });
    const off = registerPlanBoardTarget('b1', t);
    document.elementsFromPoint = () => [cell, root];
    expect(dropPlanCardAt('note', 10, 10)).toEqual({
      outcome: 'refused',
      message: 'This board shows Bug items only',
    });
    document.elementsFromPoint = () => [];
    expect(dropPlanCardAt('note', 10, 10)).toEqual({
      outcome: 'missed',
      message: PLAN_CARD_MISSED,
    });
    expect(t.addCard).not.toHaveBeenCalled();
    off();
  });

  it('opens a red zone saying why over a board that does not show the type', () => {
    const { root, cell } = boardDom('b1');
    const t = target({ acceptsType: (type) => type === 'bug' });
    const off = registerPlanBoardTarget('b1', t);
    document.elementsFromPoint = () => [cell, root];
    expect(planCardHoverAt('note', 10, 10)).toBe(false);
    expect(t.hover).toHaveBeenLastCalledWith(
      expect.objectContaining({
        refused: 'This board shows Bug items only',
        slot: expect.objectContaining({ beforeId: null }),
      }),
    );
    expect(planCardHoverAt('bug', 10, 10)).toBe(true);
    expect(vi.mocked(t.hover).mock.lastCall?.[0]).not.toHaveProperty('refused');
    off();
  });

  // docs/specs/026-plan/item-types.md "An item type": left-out statuses stop moves, never a new card.
  it('still makes a new card in a column whose status the type leaves out', () => {
    const { root, cell } = boardDom('b1');
    const t = target({ refuseAt: () => "Task cards can't be Done" });
    const off = registerPlanBoardTarget('b1', t);
    document.elementsFromPoint = () => [cell, root];
    expect(planCardHoverAt('task', 10, 10)).toBe(true);
    expect(vi.mocked(t.hover).mock.lastCall?.[0]).not.toHaveProperty('refused');
    expect(dropPlanCardAt('task', 10, 10)).toEqual({ outcome: 'added' });
    expect(t.addCard).toHaveBeenCalled();
    off();
  });
});
