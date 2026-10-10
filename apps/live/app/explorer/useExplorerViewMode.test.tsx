// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { writeLocalStorageValue } from '@/hooks/ui/useLocalStorageValue';
import { useExplorerViewMode } from './useExplorerViewMode';

const KEY = 'livediagram:explorer-view';

afterEach(() => window.localStorage.clear());

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
});
