// @vitest-environment jsdom
// The pointer note's tip handle (docs/specs/009-elements/blueprints/pointer-note.md "Tip handle").

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livediagram/document';

const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...a: unknown[]) => track(...a) }));

import { usePointerNoteSetters } from './usePointerNoteSetters';

const note = {
  ...(createShape('pointer-note', 0, 0) as ShapeElement),
  id: 'n',
  x: 0,
  y: 0,
} as Element;
const host = {
  ...(createShape('square', 0, 0) as ShapeElement),
  id: 'h',
  x: 300,
  y: 300,
  width: 100,
  height: 100,
} as Element;

describe('usePointerNoteSetters', () => {
  it('attaches a tip let go on a host point, reported as an attach even when the commit runs later', () => {
    const later: ((els: Element[]) => Element[])[] = [];
    const { result } = renderHook(() =>
      usePointerNoteSetters((map) => void later.push(map), [note, host]),
    );
    track.mockClear();
    result.current.setPointerTip('n', { x: 300, y: 300 });
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'PointerAttach');
    const out = later[0]!([note, host]).find((e) => e.id === 'n') as ShapeElement;
    expect(out).toMatchObject({ attachedTo: 'h', attachAt: 'top-left' });
  });

  it('leaves a tip let go in open space free, and ignores an id that is not a pointer note', () => {
    let els: Element[] = [{ ...note, attachedTo: 'h', attachAt: 'top-left' } as Element, host];
    const commit = vi.fn((map: (e: Element[]) => Element[]) => {
      els = map(els);
    });
    const { result } = renderHook(() => usePointerNoteSetters(commit, els));
    track.mockClear();
    result.current.setPointerTip('n', { x: -500, y: -500 });
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'PointerTip');
    expect('attachedTo' in els[0]!).toBe(false);
    result.current.setPointerTip('h', { x: 0, y: 0 });
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
