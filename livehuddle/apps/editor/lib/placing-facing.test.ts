// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape } from '@livehuddle/document';
import {
  facingAnnouncement,
  placingFacing,
  placingSize,
  resetPlacingFacing,
  subscribePlacingFacing,
  turnPlacing,
  usePlacingFacing,
  withPlacingFacing,
} from './placing-facing';

const SOFA: { kind: string | null } = { kind: 'sofa' };

// The way the piece being placed faces (docs/specs/009-elements/furniture-facing.md "Turning while placing").

afterEach(() => resetPlacingFacing());

describe('the facing of the piece being placed', () => {
  it('starts at the kind default', () => {
    expect(placingFacing('sofa')).toBe('n');
    // A desk is placed with its sitter facing up at the screen.
    expect(placingFacing('desk')).toBe('s');
  });

  it('turns a quarter clockwise, and back', () => {
    expect(turnPlacing('sofa', 1)).toBe('e');
    expect(turnPlacing('sofa', 1)).toBe('s');
    expect(turnPlacing('sofa', -1)).toBe('e');
    expect(placingFacing('sofa')).toBe('e');
  });

  it('belongs to one kind: another kind starts at its own default', () => {
    turnPlacing('sofa', 1);
    expect(placingFacing('lockers')).toBe('n');
    expect(turnPlacing('lockers', -1)).toBe('w');
    expect(placingFacing('sofa')).toBe('n');
  });

  it('leaves a kind that does not turn alone', () => {
    const told = vi.fn();
    const off = subscribePlacingFacing(told);
    expect(turnPlacing('plant', 1)).toBeNull();
    expect(placingFacing('plant')).toBe('n');
    expect(told).not.toHaveBeenCalled();
    off();
  });

  it('is forgotten when the placing ends, telling its listeners once', () => {
    const told = vi.fn();
    const off = subscribePlacingFacing(told);
    turnPlacing('sofa', 1);
    resetPlacingFacing();
    resetPlacingFacing();
    expect(told).toHaveBeenCalledTimes(2);
    expect(placingFacing('sofa')).toBe('n');
    off();
  });

  it('re-renders a reader when Space turns it', () => {
    const { result, rerender } = renderHook(
      ({ kind }: { kind: string | null }) => usePlacingFacing(kind),
      {
        initialProps: SOFA,
      },
    );
    expect(result.current).toBe('n');
    act(() => void turnPlacing('sofa', 1));
    expect(result.current).toBe('e');
    rerender({ kind: 'desk' });
    expect(result.current).toBe('s');
    rerender({ kind: null });
    expect(result.current).toBe('n');
  });
});

describe('landing the piece', () => {
  it('turns a new piece the way it was placed, about its centre', () => {
    const sofa = createShape('sofa', 100, 100);
    turnPlacing('sofa', 1);
    const placed = withPlacingFacing(sofa);
    expect(placed.type === 'shape' && placed.chairFacing).toBe('e');
    // A sofa on its side is tall.
    expect(placed.height).toBeGreaterThan(placed.width);
    expect(placed.x + placed.width / 2).toBeCloseTo(sofa.x + sofa.width / 2);
    expect(placed.y + placed.height / 2).toBeCloseTo(sofa.y + sofa.height / 2);
  });

  it('leaves an unturned piece, a piece that does not turn and a non-shape as they are', () => {
    const sofa = createShape('sofa', 0, 0);
    expect(withPlacingFacing(sofa)).toBe(sofa);
    turnPlacing('sofa', 1);
    const plant = createShape('plant', 0, 0);
    expect(withPlacingFacing(plant)).toBe(plant);
    const sticky = { ...sofa, type: 'sticky' } as unknown as typeof sofa;
    expect(withPlacingFacing(sticky)).toBe(sticky);
  });

  it('sizes the snap at the turned box', () => {
    const size = { width: 200, height: 80 };
    expect(placingSize('sofa', size)).toBe(size);
    expect(placingSize('plant', size)).toBe(size);
    turnPlacing('sofa', 1);
    const turned = placingSize('sofa', size);
    expect(turned.height).toBeGreaterThan(turned.width);
  });

  it('announces the facing', () => {
    expect(facingAnnouncement('e')).toMatch(/left/i);
  });
});
