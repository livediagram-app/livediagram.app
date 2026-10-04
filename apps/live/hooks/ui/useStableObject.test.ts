// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useStableObject } from './useStableObject';

// docs/specs/008-canvas/blueprints/selection-store.md "The canvas boundary": an object prop the
// editor rebuilds per render (data plus actions) keeps its identity until its data changes.

type Bag = { count: number; label?: string; act?: (n: number) => number };

describe('useStableObject', () => {
  it('keeps its identity while only the functions were rebuilt, calling the newest', () => {
    const { result, rerender } = renderHook((b: Bag) => useStableObject(b), {
      initialProps: { count: 1, act: (n) => n + 1 },
    });
    const first = result.current;

    rerender({ count: 1, act: (n) => n + 10 });

    expect(result.current).toBe(first);
    expect(result.current.act!(1)).toBe(11);
  });

  it('changes identity when a data field changes, keeping the same forwarders', () => {
    const { result, rerender } = renderHook((b: Bag) => useStableObject(b), {
      initialProps: { count: 1, act: vi.fn() } as Bag,
    });
    const first = result.current;

    rerender({ count: 2, act: vi.fn() });

    expect(result.current).not.toBe(first);
    expect(result.current.count).toBe(2);
    expect(result.current.act).toBe(first.act);
  });

  it('changes identity when a function appears or goes, and keeps an absent one absent', () => {
    const { result, rerender } = renderHook((b: Bag) => useStableObject(b), {
      initialProps: { count: 1 } as Bag,
    });
    const first = result.current;
    expect(first.act).toBeUndefined();

    rerender({ count: 1, act: vi.fn() });

    expect(result.current).not.toBe(first);
    expect(typeof result.current.act).toBe('function');
  });

  it('changes identity when a field is added or removed', () => {
    const { result, rerender } = renderHook((b: Bag) => useStableObject(b), {
      initialProps: { count: 1 } as Bag,
    });
    const first = result.current;

    rerender({ count: 1, label: 'x' });

    expect(result.current).not.toBe(first);
  });
});
