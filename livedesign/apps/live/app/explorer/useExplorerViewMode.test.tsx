// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeLocalStorageValue } from '@/hooks/ui/useLocalStorageValue';
import { PHONE_MEDIA_QUERY } from '@/lib/responsive';
import { useExplorerViewMode } from './useExplorerViewMode';

const KEY = 'livedesign:explorer-view';

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

function stubPhone(isPhone: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === PHONE_MEDIA_QUERY ? isPhone : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

// List, card or details layout (docs/specs/006-document/document-snapshots.md).
describe('useExplorerViewMode', () => {
  it('shows cards to somebody who never chose, and ignores a junk value', () => {
    expect(renderHook(() => useExplorerViewMode()).result.current[0]).toBe('card');
    window.localStorage.setItem(KEY, 'grid');
    expect(renderHook(() => useExplorerViewMode()).result.current[0]).toBe('card');
  });

  it('reads and persists the choice', () => {
    window.localStorage.setItem(KEY, 'list');
    const { result } = renderHook(() => useExplorerViewMode());
    expect(result.current[0]).toBe('list');
    act(() => result.current[1]('card'));
    expect(result.current[0]).toBe('card');
    expect(window.localStorage.getItem(KEY)).toBe('card');
  });

  it('reads and persists the Details view (docs/specs/013-workspace/explorer-details-view.md)', () => {
    // Through the store: an earlier test's write is cached there.
    act(() => writeLocalStorageValue(KEY, 'details'));
    const { result } = renderHook(() => useExplorerViewMode());
    expect(result.current[0]).toBe('details');
    act(() => result.current[1]('list'));
    expect(window.localStorage.getItem(KEY)).toBe('list');
  });

  it('always shows cards on a phone, and keeps the saved choice for a wider screen', () => {
    act(() => writeLocalStorageValue(KEY, 'details'));
    stubPhone(true);
    expect(renderHook(() => useExplorerViewMode()).result.current[0]).toBe('card');
    expect(window.localStorage.getItem(KEY)).toBe('details');
    stubPhone(false);
    expect(renderHook(() => useExplorerViewMode()).result.current[0]).toBe('details');
  });
});
