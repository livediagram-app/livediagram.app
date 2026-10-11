// @vitest-environment jsdom
// The address bar follows the lens field at most every LENS_URL_WRITE_MS while typing, and at once on blur
// (docs/specs/016-platform/web-performance.md): a write per keystroke made held Backspace exceed Safari's
// limit of 100 history writes in 10 s, which throws.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LENS_URL_WRITE_MS, useExplorerLens } from './useExplorerLens';

const router = { push: vi.fn(), replace: vi.fn() };
const hook = () =>
  renderHook(() =>
    useExplorerLens({ selected: { kind: 'all' } as never, teams: [], search: '', router }),
  );

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, '', '/explorer/all');
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useExplorerLens address bar', () => {
  it('writes once for a burst of keystrokes, with the latest text', () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    const { result } = hook();
    for (const text of ['d', 'di', 'dia', 'diag', 'diagr']) {
      act(() => result.current.setField(text, text.length));
    }
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(LENS_URL_WRITE_MS));
    expect(replace).toHaveBeenCalledOnce();
    expect(window.location.search).toContain('q=diagr');
  });

  it('writes at once when the field loses focus', () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    const { result } = hook();
    act(() => result.current.setField('team', 4));
    act(() => result.current.blur());
    expect(replace).toHaveBeenCalledOnce();
    expect(window.location.search).toContain('q=team');
    act(() => vi.advanceTimersByTime(LENS_URL_WRITE_MS));
    expect(replace).toHaveBeenCalledOnce();
  });

  it('drops a waiting write when the view goes away', () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    const { result, unmount } = hook();
    act(() => result.current.setField('late', 4));
    unmount();
    act(() => vi.advanceTimersByTime(LENS_URL_WRITE_MS));
    expect(replace).not.toHaveBeenCalled();
  });
});
