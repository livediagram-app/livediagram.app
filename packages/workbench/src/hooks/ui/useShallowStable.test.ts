// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useShallowStable } from './useShallowStable';

describe('useShallowStable', () => {
  it('keeps the object while every field is the same, and takes a new one when a field changes or comes or goes', () => {
    const f = () => 1;
    const { result, rerender } = renderHook((v: object) => useShallowStable(v), {
      initialProps: { a: 1, f } as object,
    });
    const first = result.current;
    rerender({ a: 1, f });
    expect(result.current).toBe(first);
    rerender({ a: 2, f });
    expect(result.current).not.toBe(first);
    const second = result.current;
    rerender({ a: 2, f: () => 2 });
    expect(result.current).not.toBe(second);
    const third = result.current;
    rerender({ a: 2 });
    expect(result.current).not.toBe(third);
    rerender({ b: 2 });
    expect(result.current).toEqual({ b: 2 });
  });
});
