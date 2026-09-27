// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useStableHandlers } from './useStableHandlers';

type Bag = { onA: ((n: number) => number) | undefined; onB: (() => string) | undefined };

describe('useStableHandlers', () => {
  it('keeps one wrapper per key that calls the newest handler', () => {
    const first = vi.fn((n: number) => n + 1);
    const second = vi.fn((n: number) => n * 10);
    const { result, rerender } = renderHook((bag: Bag) => useStableHandlers(bag), {
      initialProps: { onA: first, onB: () => 'b' },
    });
    const wrappers = result.current;
    rerender({ onA: second, onB: () => 'b2' });
    expect(result.current).toBe(wrappers);
    expect(result.current.onA?.(3)).toBe(30);
    expect(result.current.onB?.()).toBe('b2');
    expect(first).not.toHaveBeenCalled();
  });

  it('passes an undefined handler through as undefined', () => {
    const { result } = renderHook((bag: Bag) => useStableHandlers(bag), {
      initialProps: { onA: undefined, onB: () => 'b' },
    });
    expect(result.current.onA).toBeUndefined();
    expect(result.current.onB?.()).toBe('b');
  });

  it('changes the bag only when a handler flips presence, keeping each key its wrapper', () => {
    const { result, rerender } = renderHook((bag: Bag) => useStableHandlers(bag), {
      initialProps: { onA: (n: number) => n, onB: () => 'b' } as Bag,
    });
    const before = result.current;
    const wrapperB = before.onB;
    rerender({ onA: undefined, onB: () => 'b' });
    expect(result.current).not.toBe(before);
    expect(result.current.onA).toBeUndefined();
    expect(result.current.onB).toBe(wrapperB);
    rerender({ onA: (n: number) => n + 100, onB: () => 'b' });
    expect(result.current.onA?.(1)).toBe(101);
    expect(result.current.onB).toBe(wrapperB);
  });
});
