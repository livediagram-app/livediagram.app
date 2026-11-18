// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SWATCH_REST_MS, useJudgedSwatch } from './useJudgedSwatch';

// Each product's docs/specs/004-interface-design/colour-picker.md "Reading on its ground": the swatch judged.
function setup(on = true) {
  let t = 0;
  const clock = { at: (ms: number) => (t = ms) };
  const hook = renderHook(() => useJudgedSwatch(on, () => t));
  return { hook, clock, j: () => hook.result.current };
}

describe('useJudgedSwatch', () => {
  it('judges the swatch hovered, and the colour in force once the pointer leaves', () => {
    const { j } = setup();
    expect(j().judged).toBeNull();
    act(() => j().hover('#fef08a'));
    expect(j().judged).toBe('#fef08a');
    act(() => j().end());
    expect(j().judged).toBeNull();
  });

  it('keeps the swatch rested on when the pointer only crosses others on its way to the row', () => {
    const { j, clock } = setup();
    act(() => j().hover('#fef08a'));
    clock.at(400);
    // Down across two swatches, a frame or two on each, then onto the row.
    act(() => j().hover('#0f172a'));
    clock.at(430);
    act(() => j().hover('#1e3a8a'));
    clock.at(460);
    let back: { id: string | null } | undefined;
    act(() => {
      back = j().arrive();
    });
    expect(back).toEqual({ id: '#fef08a' });
    expect(j().judged).toBe('#fef08a');
    // Arriving again changes nothing.
    act(() => {
      back = j().arrive();
    });
    expect(back).toBeUndefined();
  });

  it('keeps the swatch the pointer rested on last, and goes back to the colour in force when it rested on none', () => {
    const { j, clock } = setup();
    act(() => j().hover('#fef08a'));
    clock.at(100);
    act(() => j().hover('#0f172a'));
    clock.at(100 + SWATCH_REST_MS);
    let back: { id: string | null } | undefined;
    act(() => {
      back = j().arrive();
    });
    expect(back).toBeUndefined();
    expect(j().judged).toBe('#0f172a');
    act(() => j().end());
    // Straight across one swatch into the row.
    act(() => j().hover('#fef08a'));
    clock.at(200 + SWATCH_REST_MS);
    act(() => {
      back = j().arrive();
    });
    expect(back).toEqual({ id: null });
    expect(j().judged).toBeNull();
  });

  it('judges focus only once a key is pressed, and focus always rests', () => {
    const { j, clock } = setup();
    let counts = true;
    act(() => {
      counts = j().focus('#fef08a');
    });
    expect(counts).toBe(false);
    expect(j().judged).toBeNull();
    act(() => j().keyed());
    act(() => {
      counts = j().focus('#fef08a');
    });
    expect(counts).toBe(true);
    expect(j().judged).toBe('#fef08a');
    act(() => j().hover('#0f172a'));
    clock.at(10);
    act(() => {
      j().arrive();
    });
    expect(j().judged).toBe('#fef08a');
  });

  it('never judges without a row, though focus still waits for a key', () => {
    const { j } = setup(false);
    act(() => j().hover('#fef08a'));
    expect(j().judged).toBeNull();
    expect(j().focus('#fef08a')).toBe(false);
    act(() => j().keyed());
    expect(j().focus('#fef08a')).toBe(true);
    expect(j().judged).toBeNull();
  });

  it('reads the real clock by default', () => {
    const { result } = renderHook(() => useJudgedSwatch(true));
    act(() => result.current.hover('#fef08a'));
    expect(result.current.judged).toBe('#fef08a');
  });
});
