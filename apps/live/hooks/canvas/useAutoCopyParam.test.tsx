// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasAutoCopyParam, useAutoCopyParam, withoutAutoCopyParam } from './useAutoCopyParam';

// `?copy=1` from the Community's Make a Copy (docs/specs/025-community/community.md "Post").

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('hasAutoCopyParam / withoutAutoCopyParam', () => {
  it('reads only copy=1', () => {
    expect(hasAutoCopyParam('?s=abc&copy=1')).toBe(true);
    expect(hasAutoCopyParam('?s=abc&copy=0')).toBe(false);
    expect(hasAutoCopyParam('?s=abc')).toBe(false);
  });

  it('drops the parameter and keeps the rest of the address', () => {
    expect(withoutAutoCopyParam('https://x.test/document/shared?s=abc&copy=1#t')).toBe(
      '/document/shared?s=abc#t',
    );
  });
});

describe('useAutoCopyParam', () => {
  it('waits for hydration, then copies once and strips the parameter', () => {
    window.history.replaceState(null, '', '/document/shared?s=abc&copy=1');
    const makeCopy = vi.fn();
    const { rerender } = renderHook((props) => useAutoCopyParam(props), {
      initialProps: { hydrated: false, sessionShareCode: null as string | null, makeCopy },
    });
    expect(makeCopy).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?s=abc&copy=1');

    rerender({ hydrated: true, sessionShareCode: 'abc', makeCopy });
    expect(makeCopy).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe('?s=abc');

    // A later render (a new makeCopy identity, say) never copies again.
    rerender({ hydrated: true, sessionShareCode: 'abc', makeCopy: vi.fn() });
    expect(makeCopy).toHaveBeenCalledTimes(1);
  });

  it('only strips the parameter for an owner, who has nothing to copy', () => {
    window.history.replaceState(null, '', '/document/shared?s=abc&copy=1');
    const makeCopy = vi.fn();
    renderHook(() => useAutoCopyParam({ hydrated: true, sessionShareCode: null, makeCopy }));
    expect(makeCopy).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?s=abc');
  });

  it('does nothing without the parameter', () => {
    window.history.replaceState(null, '', '/document/shared?s=abc');
    const makeCopy = vi.fn();
    renderHook(() => useAutoCopyParam({ hydrated: true, sessionShareCode: 'abc', makeCopy }));
    expect(makeCopy).not.toHaveBeenCalled();
  });
});
