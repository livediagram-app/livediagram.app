// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useStableCallbacks } from './useStableCallbacks';

type Bag = { onGo: (n: number) => number; onMaybe?: () => void };

describe('useStableCallbacks', () => {
  it('returns one bundle for the lifetime that calls the newest callbacks', () => {
    const first = vi.fn((n: number) => n);
    const { result, rerender } = renderHook((bag: Bag) => useStableCallbacks(bag), {
      initialProps: { onGo: first } as Bag,
    });
    const bundle = result.current;
    rerender({ onGo: (n: number) => n * 2 });
    expect(result.current).toBe(bundle);
    expect(result.current.onGo(4)).toBe(8);
    expect(first).not.toHaveBeenCalled();
  });

  it('no-ops a wrapper whose callback is currently undefined', () => {
    const maybe = vi.fn();
    const { result, rerender } = renderHook((bag: Bag) => useStableCallbacks(bag), {
      initialProps: { onGo: (n: number) => n, onMaybe: maybe } as Bag,
    });
    rerender({ onGo: (n: number) => n, onMaybe: undefined });
    expect(() => result.current.onMaybe?.()).not.toThrow();
    expect(maybe).not.toHaveBeenCalled();
  });
});
