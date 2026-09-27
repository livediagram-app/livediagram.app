// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLatest } from './useLatest';

// A value read from handlers, timers and subscriptions at its newest, without writing a ref during render
// (docs/specs/003-system-architecture/react-state-and-effects.md).
describe('useLatest', () => {
  it('holds the first value from the first commit', () => {
    const { result } = renderHook(() => useLatest(1));
    expect(result.current.current).toBe(1);
  });

  it('follows every later value, keeping one stable ref', () => {
    const { result, rerender } = renderHook(({ v }) => useLatest(v), { initialProps: { v: 'a' } });
    const ref = result.current;
    rerender({ v: 'b' });
    expect(result.current).toBe(ref);
    expect(ref.current).toBe('b');
  });
});
