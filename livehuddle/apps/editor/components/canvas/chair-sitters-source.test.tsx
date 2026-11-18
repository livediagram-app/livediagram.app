// @vitest-environment jsdom
// Who sits in each chair, read by the chair itself (docs/specs/008-canvas/canvas-performance.md "Walking renders the
// characters, not the canvas"; Work Tracker 1185): a sit re-renders the chair it concerns, never the board.
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createSittersSource, useChairSitters } from './chair-sitters-source';

const ada = { name: 'Ada', color: '#f00' };
const bo = { name: 'Bo', color: '#0f0', seat: 1 };

describe('createSittersSource', () => {
  it('keeps each chair’s array while its sitters read the same, and tells only on a change', () => {
    const source = createSittersSource();
    let told = 0;
    const off = source.subscribe(() => told++);
    expect(source.get('chair')).toEqual([]);
    expect(source.get('chair')).toBe(source.get('other'));

    source.set(new Map([['chair', [ada]]]));
    const first = source.get('chair');
    expect(first).toEqual([ada]);
    expect(told).toBe(1);

    // The same people, worked out again: no change, the same array.
    source.set(new Map([['chair', [{ ...ada }]]]));
    expect(source.get('chair')).toBe(first);
    expect(told).toBe(1);

    // Somebody sits on another chair: that chair changes, the first keeps its array.
    source.set(
      new Map([
        ['chair', [{ ...ada }]],
        ['sofa', [bo]],
      ]),
    );
    expect(source.get('chair')).toBe(first);
    expect(source.get('sofa')).toEqual([bo]);
    expect(told).toBe(2);

    // The same number of chairs, a different one taken.
    source.set(
      new Map([
        ['chair', [{ ...ada }]],
        ['desk', [bo]],
      ]),
    );
    expect(source.get('sofa')).toEqual([]);
    expect(told).toBe(3);

    // Everyone stands up.
    source.set(new Map());
    expect(source.get('chair')).toEqual([]);
    expect(told).toBe(4);
    off();
  });
});

describe('useChairSitters', () => {
  it('re-renders a chair only when its own sitters change', () => {
    const source = createSittersSource();
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useChairSitters(source, 'chair');
    });
    expect(result.current).toEqual([]);
    const before = renders;
    act(() => source.set(new Map([['sofa', [bo]]])));
    expect(renders).toBe(before);
    act(() =>
      source.set(
        new Map([
          ['sofa', [bo]],
          ['chair', [ada]],
        ]),
      ),
    );
    expect(result.current).toEqual([ada]);
    expect(renders).toBe(before + 1);
  });

  it('reads nobody without a source, as a placement preview has none', () => {
    const { result } = renderHook(() => useChairSitters(undefined, 'chair'));
    expect(result.current).toEqual([]);
  });
});
