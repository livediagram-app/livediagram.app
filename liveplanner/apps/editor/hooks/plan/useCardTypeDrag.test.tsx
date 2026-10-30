// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHIP_DRAG_ID, CHIP_GHOST_HEIGHT_PX } from '@/components/plan/card-type-chips';
import { registerPlanBoardTarget, type PlanBoardTarget } from './plan-board-targets';
import { useCardTypeDrag } from './useCardTypeDrag';

// docs/specs/026-plan/plan-board.md "Card type chips": a chip's press is a click, or a drag that opens the board's
// placeholder under the pointer and adds the card where it is let go.
let board: HTMLElement;
let cell: HTMLElement;
let unregister: () => void;
let target: { [K in keyof PlanBoardTarget]-?: ReturnType<typeof vi.fn> };

// Animation frames run when a test says so, never on a timer a loaded machine can starve.
let frames: FrameRequestCallback[] = [];
const flushFrames = () => act(() => frames.splice(0).forEach((cb) => cb(0)));

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  board = document.createElement('div');
  board.dataset.planBoard = 'b1';
  cell = document.createElement('div');
  cell.dataset.planStatus = 'todo';
  cell.dataset.planLane = '';
  board.append(cell);
  document.body.append(board);
  // jsdom lays nothing out: every point is over the cell, inside the board.
  document.elementsFromPoint = () => [cell, board];
  target = {
    accepts: vi.fn(() => true),
    refusal: vi.fn(() => 'This board shows Bug cards'),
    drop: vi.fn(),
    hover: vi.fn(),
    acceptsType: vi.fn(() => true),
    addCard: vi.fn(),
    refuseAt: vi.fn(() => null),
    place: vi.fn(),
  };
  unregister = registerPlanBoardTarget('b1', target as unknown as PlanBoardTarget);
});

afterEach(() => {
  vi.unstubAllGlobals();
  unregister();
  board.remove();
});

function pointer(type: string, x: number, y: number, extra: Record<string, unknown> = {}) {
  const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  for (const [k, v] of Object.entries(extra)) Object.defineProperty(e, k, { value: v });
  window.dispatchEvent(e);
}

function chip() {
  const onClick = vi.fn();
  const onRefused = vi.fn();
  const ghost = document.createElement('div');
  // A ref, as useRef gives the component: the same object every render.
  const ghostRef = { current: ghost };
  const hook = renderHook(() => useCardTypeDrag({ onClick, onRefused, ghostRef }));
  const stopPropagation = vi.fn();
  const press = (button = 0) =>
    act(() =>
      hook.result.current.onPointerDown('task', {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        button,
        stopPropagation,
      } as unknown as React.PointerEvent<HTMLElement>),
    );
  return { onClick, onRefused, ghost, hook, press, stopPropagation };
}

describe('a card type chip’s press', () => {
  it('is a click when it never travels, and never reaches the header', () => {
    const { onClick, press, stopPropagation } = chip();
    press();
    act(() => pointer('pointerup', 1, 1));
    expect(stopPropagation).toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledWith('task');
    expect(target.addCard).not.toHaveBeenCalled();
  });

  it('ignores a button other than the main one', () => {
    const { onClick, press } = chip();
    press(2);
    act(() => pointer('pointerup', 1, 1));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('carries a card that opens the placeholder and is added where it is let go', () => {
    const { onClick, press, hook, ghost } = chip();
    press();
    act(() => {
      pointer('pointermove', 80, 90);
      pointer('pointerup', 80, 90);
    });
    expect(target.hover).toHaveBeenCalledWith({
      itemId: CHIP_DRAG_ID,
      slot: { status: 'todo', laneKey: '', beforeId: null },
      height: CHIP_GHOST_HEIGHT_PX,
    });
    expect(ghost.style.transform).toContain('translate(92px, 102px)');
    expect(target.addCard).toHaveBeenCalledWith('task', {
      status: 'todo',
      laneKey: '',
      beforeId: null,
    });
    expect(onClick).not.toHaveBeenCalled();
    // The placeholder closes once it lands, and nothing is carried any more.
    expect(target.hover).toHaveBeenLastCalledWith(null);
    expect(hook.result.current.carrying).toBeNull();
  });

  it('says it is carrying the type while the pointer is held past the slop', () => {
    const { press, hook } = chip();
    press();
    act(() => pointer('pointermove', 80, 90));
    // Hit tests run once a frame.
    flushFrames();
    expect(hook.result.current.carrying).toBe('task');
    act(() => pointer('pointerup', 80, 90));
  });

  it('refuses a column whose status the type leaves out, and adds nothing', () => {
    target.refuseAt.mockReturnValue('Task cards can’t be Done');
    const { onRefused, press } = chip();
    press();
    act(() => {
      pointer('pointermove', 80, 90);
      pointer('pointerup', 80, 90);
    });
    expect(target.hover).toHaveBeenCalledWith(
      expect.objectContaining({ refused: 'Task cards can’t be Done' }),
    );
    expect(onRefused).toHaveBeenCalledWith('Task cards can’t be Done');
    expect(target.addCard).not.toHaveBeenCalled();
  });

  it('refuses a board that does not show the type, with the board’s reason', () => {
    target.acceptsType.mockReturnValue(false);
    const { onRefused, press } = chip();
    press();
    act(() => {
      pointer('pointermove', 80, 90);
      pointer('pointerup', 80, 90);
    });
    expect(onRefused).toHaveBeenCalledWith('This board shows Bug cards');
    expect(target.addCard).not.toHaveBeenCalled();
  });

  it('adds nothing when let go away from any board', () => {
    document.elementsFromPoint = () => [];
    const { onRefused, onClick, press } = chip();
    press();
    act(() => {
      pointer('pointermove', 80, 90);
      pointer('pointerup', 80, 90);
    });
    expect(target.addCard).not.toHaveBeenCalled();
    expect(onRefused).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is dropped by Escape, its placeholder closed', () => {
    const { onClick, press } = chip();
    press();
    act(() => pointer('pointermove', 80, 90));
    flushFrames();
    expect(target.hover).toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      pointer('pointerup', 80, 90);
    });
    expect(target.hover).toHaveBeenLastCalledWith(null);
    expect(target.addCard).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('closes the placeholder when unmounted mid-carry', () => {
    const { press, hook } = chip();
    press();
    act(() => pointer('pointermove', 80, 90));
    flushFrames();
    expect(target.hover).toHaveBeenCalled();
    hook.unmount();
    expect(target.hover).toHaveBeenLastCalledWith(null);
  });
});
