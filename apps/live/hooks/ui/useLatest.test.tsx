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

describe('useLatest timing', () => {
  it("is current in a child's layout effect, which runs before its parent's", async () => {
    const { render } = await import('@testing-library/react');
    const { useLayoutEffect } = await import('react');
    const seen: string[] = [];
    function Child({ latest }: { latest: { current: string } }) {
      useLayoutEffect(() => {
        seen.push(latest.current);
      });
      return null;
    }
    function Parent({ v }: { v: string }) {
      const latest = useLatest(v);
      return <Child latest={latest} />;
    }
    const { rerender } = render(<Parent v="a" />);
    rerender(<Parent v="b" />);
    expect(seen).toEqual(['a', 'b']);
  });
});

describe('useAssignRef', () => {
  it('keeps a ref declared earlier (to break a hook cycle) at the newest value', async () => {
    const { useAssignRef } = await import('./useLatest');
    const { useRef } = await import('react');
    const { result, rerender } = renderHook(
      ({ v }) => {
        const early = useRef(0);
        useAssignRef(early, v);
        return early;
      },
      { initialProps: { v: 1 } },
    );
    expect(result.current.current).toBe(1);
    rerender({ v: 2 });
    expect(result.current.current).toBe(2);
  });
});
