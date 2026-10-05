// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape } from '@livediagram/document';
import { registerPlanBoardTarget, type PlanBoardTarget } from './plan-board-targets';
import { boardClientPoint, dropPlanCardAt, PLAN_CARD_MISSED } from './plan-card-drop';

// docs/specs/025-plan/plan-mode.md "The palette": a palette card lands only in a board's column.
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
});
