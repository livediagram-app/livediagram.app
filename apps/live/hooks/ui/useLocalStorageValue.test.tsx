// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLocalStorageValue, writeLocalStorageValue } from './useLocalStorageValue';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('useLocalStorageValue', () => {
  it('reads the stored string, or null', () => {
    window.localStorage.setItem('lsv-a', 'x');
    expect(renderHook(() => useLocalStorageValue('lsv-a')).result.current).toBe('x');
    expect(renderHook(() => useLocalStorageValue('lsv-none')).result.current).toBeNull();
  });

  it('re-renders every reader of a key on a write here', () => {
    const one = renderHook(() => useLocalStorageValue('lsv-b'));
    const two = renderHook(() => useLocalStorageValue('lsv-b'));
    act(() => writeLocalStorageValue('lsv-b', 'y'));
    expect(one.result.current).toBe('y');
    expect(two.result.current).toBe('y');
  });

  it('follows a clear in another tab', () => {
    const { result } = renderHook(() => useLocalStorageValue('lsv-c'));
    act(() => writeLocalStorageValue('lsv-c', 'z'));
    act(() => {
      window.localStorage.clear();
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });
    expect(result.current).toBeNull();
  });

  it('keeps a refused write in memory for the session', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result } = renderHook(() => useLocalStorageValue('lsv-d'));
    act(() => writeLocalStorageValue('lsv-d', 'kept'));
    expect(result.current).toBe('kept');
    expect(window.localStorage.getItem('lsv-d')).toBeNull();
  });
});
