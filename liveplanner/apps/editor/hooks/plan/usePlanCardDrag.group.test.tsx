// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPlanBoardTarget, type PlanBoardTarget } from './plan-board-targets';
import { usePlanCardDrag } from './usePlanCardDrag';

// docs/specs/026-plan/plan-board.md "Several cards at once": a press on a selected card carries the whole group, which
// lands in a cell, on another board, on the Trash, or nowhere when let go off every board.
let board: HTMLElement;
let cell: HTMLElement;
let hits: () => Element[];

const rect = (left: number, top: number, right: number, bottom: number) =>
  ({
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    x: left,
    y: top,
  }) as DOMRect;

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  board = document.createElement('div');
  board.dataset.planBoard = 'b1';
  board.getBoundingClientRect = () => rect(0, 0, 500, 500);
  cell = document.createElement('div');
  cell.dataset.planStatus = 'todo';
  cell.dataset.planLane = '';
  for (const id of ['a', 'b']) {
    const c = document.createElement('div');
    c.dataset.planCard = id;
    cell.append(c);
  }
  board.append(cell);
  document.body.append(board);
  hits = () => [cell, board];
  document.elementsFromPoint = () => hits();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function pointer(type: string, x: number, y: number) {
  const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  window.dispatchEvent(e);
}

function drag() {
  const opts = {
    boardRef: { current: board },
    boardId: 'b1',
    enabled: true,
    onClick: vi.fn(),
    onDrop: vi.fn(),
    onDropOutside: vi.fn(),
    onRefused: vi.fn(),
    onDragging: vi.fn(),
    onTrash: vi.fn(),
    onDropGroup: vi.fn(),
    onTrashGroup: vi.fn(),
  };
  const hook = renderHook(() => usePlanCardDrag(opts));
  const press = (group?: string[]) =>
    act(() =>
      hook.result.current.onCardPointerDown(
        'a',
        {
          pointerId: 1,
          clientX: 10,
          clientY: 10,
          button: 0,
          pointerType: 'mouse',
          stopPropagation: () => {},
          currentTarget: cell.firstElementChild,
        } as unknown as React.PointerEvent<HTMLElement>,
        false,
        group,
      ),
    );
  const carry = (x: number, y: number) =>
    act(() => {
      pointer('pointermove', x, y);
      pointer('pointerup', x, y);
    });
  return { opts, hook, press, carry };
}

describe('a group carried', () => {
  it('lands in one of its own board’s cells, its cards no slot’s neighbour', () => {
    const { opts, press, carry } = drag();
    press(['a', 'b']);
    carry(100, 100);
    expect(opts.onDropGroup).toHaveBeenCalledWith(['a', 'b'], {
      status: 'todo',
      laneKey: '',
      beforeId: null,
    });
    expect(opts.onDrop).not.toHaveBeenCalled();
  });

  it('is a lone card when the press names fewer than two', () => {
    const { opts, press, carry } = drag();
    press(['a']);
    carry(100, 100);
    expect(opts.onDropGroup).not.toHaveBeenCalled();
  });

  it('moves nothing let go off every board, and goes to the Trash over it', () => {
    const { opts, press, carry } = drag();
    press(['a', 'b']);
    hits = () => [];
    carry(900, 900);
    expect(opts.onRefused).toHaveBeenCalledWith('Drop the cards on a board');
    const trash = document.createElement('button');
    trash.dataset.planTrash = '';
    trash.getBoundingClientRect = () => rect(800, 800, 1000, 1000);
    document.body.append(trash);
    press(['a', 'b']);
    carry(900, 900);
    expect(opts.onTrashGroup).toHaveBeenCalledWith(['a', 'b']);
  });

  it('lands on another board through its registration, or is refused there', () => {
    const other = document.createElement('div');
    other.dataset.planBoard = 'b2';
    const otherCell = document.createElement('div');
    otherCell.dataset.planStatus = 'done';
    other.append(otherCell);
    document.body.append(other);
    let accepts = true;
    const target = {
      accepts: () => accepts,
      refusal: () => 'This board shows Task cards',
      drop: vi.fn(),
      dropMany: vi.fn(),
      hover: vi.fn(),
      acceptsType: () => true,
      addCard: vi.fn(),
      refuseAt: vi.fn(() => null),
      place: (_: string, s: unknown) => s,
    } as unknown as PlanBoardTarget & { dropMany: ReturnType<typeof vi.fn> };
    const unregister = registerPlanBoardTarget('b2', target);
    const { opts, press, carry } = drag();
    hits = () => [otherCell, other];
    press(['a', 'b']);
    carry(700, 100);
    expect(target.dropMany).toHaveBeenCalledWith(['a', 'b'], {
      status: 'done',
      laneKey: '',
      beforeId: null,
    });
    accepts = false;
    press(['a', 'b']);
    carry(700, 120);
    expect(opts.onRefused).toHaveBeenCalledWith('This board shows Task cards');
    unregister();
  });
});
