// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlacingFacing } from './placing-facing';

// The facing of the piece being placed (each product's docs/specs/009-elements/furniture-facing.md "Turning while
// placing"), over a product's own turning pieces: here a 'sofa' turns and a 'plant' does not.
type Facing = 'n' | 'e' | 's' | 'w';
type El = { type: string; shape?: string; width: number; height: number; facing?: Facing };
const ORDER: Facing[] = ['n', 'e', 's', 'w'];

const placing = createPlacingFacing<Facing, El>({
  turns: (kind) => kind === 'sofa' || kind === 'desk',
  defaultFacing: (kind) => (kind === 'desk' ? 's' : 'n'),
  restingFacing: 'n',
  turnFacing: (f, q) => ORDER[(((ORDER.indexOf(f) + q) % 4) + 4) % 4]!,
  turnedSize: (_kind, size) => ({ width: size.height, height: size.width }),
  kindOf: (el) => (el.type === 'shape' ? (el.shape ?? null) : null),
  turnElement: (el, facing) => ({ ...el, width: el.height, height: el.width, facing }),
});

afterEach(() => placing.resetPlacingFacing());

describe('createPlacingFacing', () => {
  it('turns one kind at a time, from its default', () => {
    expect(placing.placingFacing('desk')).toBe('s');
    expect(placing.turnPlacing('sofa', 1)).toBe('e');
    expect(placing.turnPlacing('sofa', -2)).toBe('w');
    expect(placing.placingFacing('desk')).toBe('s');
    expect(placing.turnPlacing('plant', 1)).toBeNull();
  });

  it('tells its listeners of a turn and of the end, once', () => {
    const heard = vi.fn();
    const off = placing.subscribePlacingFacing(heard);
    placing.turnPlacing('sofa', 1);
    placing.resetPlacingFacing();
    placing.resetPlacingFacing();
    off();
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('re-renders a reader when Space turns the piece', () => {
    const initialProps: { kind: string | null } = { kind: 'sofa' };
    const { result, rerender } = renderHook(
      ({ kind }: { kind: string | null }) => placing.usePlacingFacing(kind),
      { initialProps },
    );
    expect(result.current).toBe('n');
    act(() => void placing.turnPlacing('sofa', 1));
    expect(result.current).toBe('e');
    rerender({ kind: 'desk' });
    expect(result.current).toBe('s');
    rerender({ kind: null });
    expect(result.current).toBe('n');
  });

  it('measures and lands the piece turned, and anything else as it is', () => {
    const size = { width: 10, height: 4 };
    expect(placing.placingSize('sofa', size)).toBe(size);
    expect(placing.placingSize('plant', size)).toBe(size);
    placing.turnPlacing('sofa', 1);
    expect(placing.placingSize('sofa', size)).toEqual({ width: 4, height: 10 });
    const sofa: El = { type: 'shape', shape: 'sofa', width: 10, height: 4 };
    expect(placing.withPlacingFacing(sofa)).toEqual({ ...sofa, width: 4, height: 10, facing: 'e' });
    const note: El = { type: 'sticky', width: 1, height: 1 };
    expect(placing.withPlacingFacing(note)).toBe(note);
    const desk: El = { type: 'shape', shape: 'desk', width: 1, height: 2 };
    expect(placing.withPlacingFacing(desk)).toBe(desk);
  });
});
