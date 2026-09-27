// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDismissibleBanner } from './useDismissibleBanner';

afterEach(() => window.localStorage.clear());

// A permanently dismissible banner (docs/specs/014-identity/sign-in-encouragement.md).
describe('useDismissibleBanner', () => {
  it('starts shown, and reads a stored dismissal', () => {
    expect(renderHook(() => useDismissibleBanner('banner-a')).result.current.dismissed).toBe(false);
    window.localStorage.setItem('banner-b', '1');
    expect(renderHook(() => useDismissibleBanner('banner-b')).result.current.dismissed).toBe(true);
  });

  it('persists a dismissal', () => {
    const { result } = renderHook(() => useDismissibleBanner('banner-c'));
    act(() => result.current.dismiss());
    expect(result.current.dismissed).toBe(true);
    expect(window.localStorage.getItem('banner-c')).toBe('1');
  });

  it('follows a dismissal or reset made in another tab', () => {
    const { result } = renderHook(() => useDismissibleBanner('banner-d'));
    act(() => {
      window.localStorage.setItem('banner-d', '1');
      window.dispatchEvent(new StorageEvent('storage', { key: 'banner-d', newValue: '1' }));
    });
    expect(result.current.dismissed).toBe(true);
    act(() => {
      window.localStorage.removeItem('banner-d');
      window.dispatchEvent(new StorageEvent('storage', { key: 'banner-d', newValue: null }));
    });
    expect(result.current.dismissed).toBe(false);
  });
});
