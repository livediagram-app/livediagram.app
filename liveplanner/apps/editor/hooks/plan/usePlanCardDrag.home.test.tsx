// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPlanBoardTarget, type PlanBoardTarget } from './plan-board-targets';
import { isHomeSlot, planCardHome, usePlanCardDrag } from './usePlanCardDrag';

// docs/specs/026-plan/plan-board.md "No gap where the card already is": over the card's own place no slot opens, so no
// gap shows and letting go there does nothing (no write, so no undo step).
let board: HTMLElement;
const cells: Record<string, HTMLElement> = {};
let hits: () => Element[];
// Animation frames queued by a move, run as the test says.
let frames: FrameRequestCallback[] = [];
const flush = () => {
  const now = frames;
  frames = [];
  for (const cb of now) cb(0);
};

const rect = (top: number, bottom: number) =>
  ({ left: 0, top, right: 200, bottom, width: 200, height: bottom - top, x: 0, y: top }) as DOMRect;

function makeCell(status: string, ids: string[]) {
  const cell = document.createElement('div');
  cell.dataset.planStatus = status;
  cell.dataset.planLane = '';
  ids.forEach((id, i) => {
    const c = document.createElement('div');
    c.dataset.planCard = id;
    c.getBoundingClientRect = () => rect(i * 100, i * 100 + 80);
    cell.append(c);
  });
  board.append(cell);
  cells[status] = cell;
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  board = document.createElement('div');
  board.dataset.planBoard = 'home-board';
  board.getBoundingClientRect = () => ({ ...rect(0, 500), right: 500, width: 500 });
  makeCell('todo', ['alone']);
  makeCell('doing', ['a', 'b', 'c']);
  document.body.append(board);
  hits = () => [cells.todo!, board];
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

function drag(sortedPlace = false) {
  const unregister = registerPlanBoardTarget('home-board', {
    accepts: () => true,
    refusal: () => '',
    drop: vi.fn(),
    hover: vi.fn(),
    addCard: vi.fn(),
    refuseAt: () => null,
    // A sorted board's place hands back a new slot (sortedSlot); an unsorted one the slot itself.
    place: (_id: string, slot: object) => (sortedPlace ? { ...slot } : slot),
  } as unknown as PlanBoardTarget);
  const opts = {
    boardRef: { current: board },
    boardId: 'home-board',
    enabled: true,
    onClick: vi.fn(),
    onDrop: vi.fn(),
    onDropOutside: vi.fn(),
    onRefused: vi.fn(),
    onDragging: vi.fn(),
  };
  const hook = renderHook(() => usePlanCardDrag(opts));
  const press = (id: string) =>
    act(() =>
      hook.result.current.onCardPointerDown(id, {
        pointerId: 1,
        clientX: 10,
        clientY: 10,
        button: 0,
        pointerType: 'mouse',
        stopPropagation: () => {},
        currentTarget: board.querySelector(`[data-plan-card="${id}"]`),
      } as unknown as React.PointerEvent<HTMLElement>),
    );
  const move = (x: number, y: number) =>
    act(() => {
      pointer('pointermove', x, y);
      flush();
    });
  const up = (x: number, y: number) => act(() => pointer('pointerup', x, y));
  return { opts, hook, press, move, up, unregister };
}

describe('planCardHome and isHomeSlot', () => {
  it('reads a card’s cell and the card after it', () => {
    expect(planCardHome(board.querySelector('[data-plan-card="a"]')!)).toEqual({
      status: 'doing',
      laneKey: '',
      nextId: 'b',
    });
    expect(planCardHome(board.querySelector('[data-plan-card="c"]')!)?.nextId).toBeNull();
  });

  it('is its own place only just before the card after it, or anywhere in its cell when sorted', () => {
    const home = { status: 'doing', laneKey: '', nextId: 'b' };
    expect(isHomeSlot({ status: 'doing', laneKey: '', beforeId: 'b' }, home, false)).toBe(true);
    expect(isHomeSlot({ status: 'doing', laneKey: '', beforeId: 'c' }, home, false)).toBe(false);
    expect(isHomeSlot({ status: 'doing', laneKey: '', beforeId: 'c' }, home, true)).toBe(true);
    expect(isHomeSlot({ status: 'todo', laneKey: '', beforeId: null }, home, true)).toBe(false);
    expect(isHomeSlot({ status: 'doing', laneKey: 'x', beforeId: 'b' }, home, false)).toBe(false);
    expect(isHomeSlot({ status: 'doing', laneKey: '', beforeId: 'b' }, undefined, false)).toBe(
      false,
    );
  });
});

describe('a card carried over its own place', () => {
  it('opens no gap in its cell when alone there, and letting go moves nothing', () => {
    const { opts, hook, press, move, up, unregister } = drag();
    press('alone');
    move(50, 300);
    expect(hook.result.current.drag?.slot).toBeNull();
    expect(hook.result.current.drag?.outside).toBe(false);
    up(50, 300);
    expect(opts.onDrop).not.toHaveBeenCalled();
    expect(opts.onDropOutside).not.toHaveBeenCalled();
    unregister();
  });

  it('opens no gap just after itself among others, but does elsewhere in its cell', () => {
    hits = () => [cells.doing!, board];
    const { opts, hook, press, move, up, unregister } = drag();
    press('a');
    // Over b's top half: just before b, where a already is.
    move(50, 110);
    expect(hook.result.current.drag?.slot).toBeNull();
    // Over c's top half: a real move.
    move(50, 210);
    expect(hook.result.current.drag?.slot).toEqual({ status: 'doing', laneKey: '', beforeId: 'c' });
    up(50, 210);
    expect(opts.onDrop).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('opens no gap anywhere in its own cell on a sorted board, and does in another cell', () => {
    hits = () => [cells.doing!, board];
    const { hook, press, move, up, unregister } = drag(true);
    press('a');
    move(50, 210);
    expect(hook.result.current.drag?.slot).toBeNull();
    hits = () => [cells.todo!, board];
    move(60, 210);
    expect(hook.result.current.drag?.slot?.status).toBe('todo');
    up(60, 210);
    unregister();
  });
});

// docs/specs/026-plan/plan-board.md "A drag stays smooth": carrying a card selects none of the page's text.
describe('a card carried selects no text', () => {
  it('refuses a selection while pressed, clears one made before the drag, and allows them again after', () => {
    const { press, move, up, unregister } = drag();
    const select = () => {
      const e = new Event('selectstart', { cancelable: true, bubbles: true });
      document.body.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(select()).toBe(false);
    const text = document.createElement('p');
    text.textContent = 'some words';
    document.body.append(text);
    press('a');
    expect(select()).toBe(true);
    window.getSelection()!.selectAllChildren(text);
    move(50, 300);
    expect(window.getSelection()!.rangeCount).toBe(0);
    up(50, 300);
    expect(select()).toBe(false);
    unregister();
  });
});
