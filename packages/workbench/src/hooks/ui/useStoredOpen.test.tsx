// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStoredOpen } from './useStoredOpen';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('useStoredOpen', () => {
  it('starts at its default until flipped', () => {
    expect(renderHook(() => useStoredOpen('so-a')).result.current.open).toBe(false);
    expect(renderHook(() => useStoredOpen('so-b', true)).result.current.open).toBe(true);
  });

  it('remembers an open and a close across a remount', () => {
    const first = renderHook(() => useStoredOpen('so-c'));
    act(() => first.result.current.toggle());
    expect(first.result.current.open).toBe(true);
    expect(window.localStorage.getItem('so-c')).toBe('open');
    first.unmount();
    const second = renderHook(() => useStoredOpen('so-c'));
    expect(second.result.current.open).toBe(true);
    act(() => second.result.current.setOpen(false));
    second.unmount();
    expect(window.localStorage.getItem('so-c')).toBe('closed');
    expect(renderHook(() => useStoredOpen('so-c', true)).result.current.open).toBe(false);
  });

  it('reads anything else as its default', () => {
    window.localStorage.setItem('so-d', 'yes');
    expect(renderHook(() => useStoredOpen('so-d')).result.current.open).toBe(false);
  });

  it('still opens and closes when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const { result } = renderHook(() => useStoredOpen('so-e'));
    expect(result.current.open).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.open).toBe(false);
  });
});
