// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { writeLocalStorageValue } from '@/hooks/ui/useLocalStorageValue';
import { DETAILS_SORT_STORAGE_KEY, useDetailsSort } from './useDetailsSort';

describe('useDetailsSort', () => {
  it('starts on Updated, newest first, and keeps each press', () => {
    act(() => writeLocalStorageValue(DETAILS_SORT_STORAGE_KEY, 'junk'));
    const { result } = renderHook(() => useDetailsSort());
    expect(result.current[0]).toEqual({ column: 'updated', direction: 'desc' });
    act(() => result.current[1]('name'));
    expect(result.current[0]).toEqual({ column: 'name', direction: 'asc' });
    act(() => result.current[1]('name'));
    expect(result.current[0]).toEqual({ column: 'name', direction: 'desc' });
    expect(window.localStorage.getItem(DETAILS_SORT_STORAGE_KEY)).toBe('name:desc');
  });
});
