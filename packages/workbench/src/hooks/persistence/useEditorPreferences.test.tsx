// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditorPreferences } from './useEditorPreferences';

type UserPreferences = {
  reduceMotion?: boolean;
  panelOpacity?: number;
  alignmentGuides?: boolean;
  autoRebindArrows?: boolean;
  showMinimap?: boolean;
};

// An editor's lib/user-preferences, cut down to what the hooks read.
const STORAGE_KEY = 'app:user-preferences';
const PREFERENCES_CHANGED_EVENT = 'app:preferences-changed';
const fetchUserPreferences = vi.fn<(ownerId: string) => Promise<UserPreferences | null>>();
const { useEditorPreferences, useCachedPreferences } = createEditorPreferences<UserPreferences>({
  STORAGE_KEY,
  PREFERENCES_CHANGED_EVENT,
  readUserPreferences: () => JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}'),
  fetchUserPreferences: (ownerId) => fetchUserPreferences(ownerId),
  autoRebindArrowsEnabled: (prefs) => prefs.autoRebindArrows !== false,
});

beforeEach(() => fetchUserPreferences.mockResolvedValue(null));
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

// Per-user editor preferences (docs/specs/007-editor/user-preferences.md).
describe('useEditorPreferences', () => {
  it('starts from the preferences cached on this device', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ alignmentGuides: false, autoRebindArrows: false }),
    );
    const { result } = renderHook(() =>
      useEditorPreferences({ ownerId: 'self', passwordGated: false }),
    );
    expect(result.current.userPreferences).toEqual({
      alignmentGuides: false,
      autoRebindArrows: false,
    });
    expect(result.current.alignmentGuidesRef.current).toBe(false);
    expect(result.current.autoRebindArrowsRef.current).toBe(false);
    // The placeholder owner never asks the server.
    expect(fetchUserPreferences).not.toHaveBeenCalled();
  });

  it('takes a set over the cache', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ alignmentGuides: false }));
    const { result } = renderHook(() =>
      useEditorPreferences({ ownerId: 'self', passwordGated: false }),
    );
    act(() => result.current.setUserPreferences({ reduceMotion: true }));
    expect(result.current.userPreferences).toEqual({ reduceMotion: true });
  });

  it("follows another tab's write after a set, so the next write builds on it", () => {
    const { result } = renderHook(() =>
      useEditorPreferences({ ownerId: 'self', passwordGated: false }),
    );
    act(() => result.current.setUserPreferences({ reduceMotion: true }));
    // Another tab writes the shared cache: the browser fires `storage` here.
    act(() => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ reduceMotion: true, showMinimap: false }),
      );
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    });
    expect(result.current.userPreferences).toEqual({ reduceMotion: true, showMinimap: false });
  });

  it('merges the server copy once the owner resolves, and settles', async () => {
    fetchUserPreferences.mockResolvedValue({ reduceMotion: true });
    const { result } = renderHook(() =>
      useEditorPreferences({ ownerId: 'user_1', passwordGated: false }),
    );
    await waitFor(() => expect(result.current.prefsSettled).toBe(true));
    expect(fetchUserPreferences).toHaveBeenCalledWith('user_1');
    expect(result.current.userPreferences).toEqual({ reduceMotion: true });
  });

  it('settles on a failed fetch without changing anything', async () => {
    const { result } = renderHook(() =>
      useEditorPreferences({ ownerId: 'user_2', passwordGated: false }),
    );
    await waitFor(() => expect(result.current.prefsSettled).toBe(true));
    expect(result.current.userPreferences).toEqual({});
  });

  it('waits behind the share-password gate', () => {
    renderHook(() => useEditorPreferences({ ownerId: 'user_3', passwordGated: true }));
    expect(fetchUserPreferences).not.toHaveBeenCalled();
  });

  it('drops a fetch that lands after unmount', async () => {
    let resolve: (prefs: UserPreferences) => void = () => {};
    fetchUserPreferences.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result, unmount } = renderHook(() =>
      useEditorPreferences({ ownerId: 'user_4', passwordGated: false }),
    );
    unmount();
    await act(async () => resolve({ reduceMotion: true }));
    expect(result.current.prefsSettled).toBe(false);
  });
});

describe('useCachedPreferences', () => {
  it("follows this tab's writes", () => {
    const { result } = renderHook(() => useCachedPreferences());
    expect(result.current).toEqual({});
    act(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ showMinimap: true }));
      window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
    });
    expect(result.current).toEqual({ showMinimap: true });
  });
});
