// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { createRef, useLayoutEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COLUMN_ATTR,
  COLUMN_MOVE_EASING,
  COLUMN_MOVE_MS,
  captureColumns,
  playColumnMove,
  useColumnMoveFlip,
} from './column-move-flip';

// docs/specs/026-plan/plan-board.md "A column's own settings": a column moved left or right glides to its new
// place, and its neighbour the other way.
const reduced = { on: false };
vi.mock('@/lib/motion-preference', () => ({ prefersReducedMotion: () => reduced.on }));

// jsdom lays nothing out: each part's left is set by hand.
const lefts = new Map<string, number>();
const animate = vi.fn();
beforeEach(() => {
  reduced.on = false;
  animate.mockReset();
  (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
});
afterEach(cleanup);

function part(id: string, key: string) {
  return (node: HTMLElement | null) => {
    if (!node) return;
    Object.defineProperty(node, 'offsetLeft', { configurable: true, get: () => lefts.get(key)! });
    node.setAttribute(COLUMN_ATTR, id);
  };
}

const handle = createRef<ReturnType<typeof useColumnMoveFlip>>() as {
  current: ReturnType<typeof useColumnMoveFlip>;
};
function Board({ order }: { order: string[] }) {
  const grid = useRef<HTMLDivElement>(null);
  const flip = useColumnMoveFlip(grid, order.join('|'));
  useLayoutEffect(() => {
    handle.current = flip;
  });
  return (
    <div ref={grid}>
      {order.map((id) => (
        <div key={id} ref={part(id, id)} data-testid={id} />
      ))}
    </div>
  );
}

describe('captureColumns and playColumnMove', () => {
  it('plays each part from its old left to its new one, skipping parts that stayed', () => {
    const root = document.createElement('div');
    const a = document.createElement('div');
    const b = document.createElement('div');
    const c = document.createElement('div');
    root.append(a, b, c);
    document.body.append(root);
    part('a', 'a')(a);
    part('b', 'b')(b);
    part('c', 'c')(c);
    lefts.set('a', 0).set('b', 260).set('c', 520);
    const before = captureColumns(root);
    lefts.set('a', 260).set('b', 0);
    expect(playColumnMove(before)).toBe(2);
    expect(animate).toHaveBeenCalledWith(
      [{ transform: 'translateX(-260px)' }, { transform: 'translateX(0)' }],
      { duration: COLUMN_MOVE_MS, easing: COLUMN_MOVE_EASING },
    );
    expect(animate).toHaveBeenCalledWith(
      [{ transform: 'translateX(260px)' }, { transform: 'translateX(0)' }],
      expect.anything(),
    );
    root.remove();
  });
});

describe('useColumnMoveFlip', () => {
  it('glides on a move this person made, and holds the cards while it plays', () => {
    vi.useFakeTimers();
    try {
      lefts.set('a', 0).set('b', 260);
      const { rerender } = render(<Board order={['a', 'b']} />);
      act(() => handle.current.beforeMove('a'));
      expect(handle.current.isMoving()).toBe(true);
      lefts.set('a', 260).set('b', 0);
      rerender(<Board order={['b', 'a']} />);
      expect(animate).toHaveBeenCalledTimes(2);
      // The moved column rides above its neighbour on a shadow; the neighbour just slides.
      const frames = animate.mock.calls.map((c) => c[0] as Record<string, unknown>[]);
      expect(frames.filter((f) => f[0]!['zIndex'] === 2)).toHaveLength(1);
      expect(frames.find((f) => f[0]!['zIndex'] === 2)![0]!['transform']).toBe(
        'translateX(-260px)',
      );
      expect(handle.current.isMoving()).toBe(true);
      act(() => vi.advanceTimersByTime(COLUMN_MOVE_MS));
      expect(handle.current.isMoving()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('jumps on a change of order nobody here asked for', () => {
    lefts.set('a', 0).set('b', 260);
    const { rerender } = render(<Board order={['a', 'b']} />);
    lefts.set('a', 260).set('b', 0);
    rerender(<Board order={['b', 'a']} />);
    expect(animate).not.toHaveBeenCalled();
    expect(handle.current.isMoving()).toBe(false);
  });

  it('jumps under reduced motion', () => {
    reduced.on = true;
    lefts.set('a', 0).set('b', 260);
    const { rerender } = render(<Board order={['a', 'b']} />);
    act(() => handle.current.beforeMove('a'));
    lefts.set('a', 260).set('b', 0);
    rerender(<Board order={['b', 'a']} />);
    expect(animate).not.toHaveBeenCalled();
  });
});
