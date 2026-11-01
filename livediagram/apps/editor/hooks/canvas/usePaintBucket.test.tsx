// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFreehand, createShape, type Element } from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import { FILL_LOCKED_HINT, FILL_MISSED_HINT, usePaintBucket } from './usePaintBucket';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/023-draw-mode/fill-tool.md "What a press fills" and "Share roles".
const BLUE = '#dbeafe';
const square = {
  ...createShape('square', 0, 0),
  id: 'sq',
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  fillColor: 'transparent',
} as Element;
const ring = Array.from({ length: 40 }, (_, i) => {
  const a = (i / 39) * ((350 * Math.PI) / 180);
  return { x: 500 + 50 * Math.cos(a), y: 100 + 50 * Math.sin(a) };
});
const loop = { ...createFreehand(ring, false), id: 'loop', penWidth: 1.5 } as Element;

function setup(
  over: Partial<{
    pendingDraw: PendingDraw | null;
    elements: Element[];
    editsBlocked: boolean;
    canRecolour: (el: Element) => boolean;
    inertIds: Set<string>;
  }> = {},
) {
  let els = over.elements ?? [square, loop];
  const commit = vi.fn((map: (e: Element[]) => Element[]) => {
    els = map(els);
  });
  const hint = vi.fn();
  const { result } = renderHook(() =>
    usePaintBucket({
      pendingDraw: 'pendingDraw' in over ? over.pendingDraw! : { type: 'fill', fill: BLUE },
      elements: () => els,
      layers: undefined,
      inertIds: over.inertIds ?? new Set(),
      editsBlocked: over.editsBlocked ?? false,
      canRecolour: over.canRecolour ?? (() => true),
      commit,
      hint,
    }),
  );
  return { paint: result.current.paintBucket, commit, hint, els: () => els };
}

afterEach(() => vi.mocked(track).mockClear());

describe('usePaintBucket', () => {
  it('fills a closed shape in one commit and reports it', () => {
    const s = setup();
    s.paint({ x: 100, y: 100 });
    expect(s.commit).toHaveBeenCalledTimes(1);
    expect(s.els()[0]).toMatchObject({ id: 'sq', fillColor: BLUE });
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'FillBucket');
  });

  it('closes and fills a marker loop and reports it', () => {
    const s = setup();
    s.paint({ x: 500, y: 100 });
    expect(s.els()[1]).toMatchObject({ id: 'loop', closed: true, fillColor: BLUE });
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'FillLoop');
  });

  it('hints on the bare board and on something locked, changing nothing', () => {
    const s = setup();
    s.paint({ x: 900, y: 900 });
    expect(s.hint).toHaveBeenCalledWith(FILL_MISSED_HINT);
    const locked = setup({ elements: [{ ...square, locked: true } as Element] });
    locked.paint({ x: 100, y: 100 });
    expect(locked.hint).toHaveBeenCalledWith(FILL_LOCKED_HINT);
    expect(track).toHaveBeenCalledWith('Draw', 'Changed', 'FillMissed');
    expect(s.commit).not.toHaveBeenCalled();
    expect(locked.commit).not.toHaveBeenCalled();
  });

  it('changes nothing for a session that may not edit or recolour, or without the bucket', () => {
    for (const s of [
      setup({ editsBlocked: true }),
      setup({ canRecolour: () => false }),
      setup({ pendingDraw: null }),
      setup({ pendingDraw: { type: 'path' } }),
    ]) {
      s.paint({ x: 100, y: 100 });
      expect(s.commit).not.toHaveBeenCalled();
      expect(s.hint).not.toHaveBeenCalled();
    }
  });

  it('commits nothing when the colour is already there', () => {
    const s = setup({ elements: [{ ...square, fillColor: BLUE } as Element] });
    s.paint({ x: 100, y: 100 });
    expect(s.commit).not.toHaveBeenCalled();
  });
});
