// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, type UserPreferences } from '@/lib/user-preferences';
import { useEditorPreferences } from './useEditorPreferences';

const fetchUserPreferences = vi.fn<(ownerId: string) => Promise<UserPreferences | null>>();
vi.mock('@/lib/user-preferences', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/user-preferences')>()),
  fetchUserPreferences: (ownerId: string) => fetchUserPreferences(ownerId),
}));

beforeEach(() => fetchUserPreferences.mockResolvedValue(null));
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

// Per-user editor preferences (docs/specs/007-editor/user-preferences.md).
describe('useEditorPreferences', () => {
  it('starts from the preferences cached on this device', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ alignmentGuides: false }));
    const { result } = renderHook(() =>
      useEditorPreferences({ ownerId: 'self', passwordGated: false }),
    );
    expect(result.current.userPreferences).toEqual({ alignmentGuides: false });
    expect(result.current.alignmentGuidesRef.current).toBe(false);
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
});
