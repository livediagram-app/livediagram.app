// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useByValue } from './useByValue';

// A derived value rebuilt each time its inputs change identity keeps its identity while it is equal,
// so the memoised views it reaches do not render for it (docs/specs/008-canvas/canvas-performance.md).

const sameLength = (a: number[], b: number[]) => a.length === b.length;

describe('useByValue', () => {
  it('hands back the previous value while the new one is equal', () => {
    const { result, rerender } = renderHook(({ v }) => useByValue(v, sameLength), {
      initialProps: { v: [1] },
    });
    const first = result.current;
    rerender({ v: [2] });
    expect(result.current).toBe(first);
  });

  it('takes the new value once it differs', () => {
    const { result, rerender } = renderHook(({ v }) => useByValue(v, sameLength), {
      initialProps: { v: [1] },
    });
    const next = [1, 2];
    rerender({ v: next });
    expect(result.current).toBe(next);
  });
});
