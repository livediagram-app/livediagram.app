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

type Deps = Parameters<typeof useEditorPreferences>[0];

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
      useEditorPreferences({ ownerId: 'self', passwordGated: false, setAiPanelVisible: vi.fn() }),
    );
    expect(result.current.userPreferences).toEqual({ alignmentGuides: false });
    expect(result.current.alignmentGuidesRef.current).toBe(false);
  });

  it('takes a set over the cache', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ alignmentGuides: false }));
    const { result } = renderHook(() =>
      useEditorPreferences({ ownerId: 'self', passwordGated: false, setAiPanelVisible: vi.fn() }),
    );
    act(() => result.current.setUserPreferences({ reduceMotion: true }));
    expect(result.current.userPreferences).toEqual({ reduceMotion: true });
  });

  it('merges the server copy once the owner resolves, and settles', async () => {
    fetchUserPreferences.mockResolvedValue({ reduceMotion: true });
    const { result } = renderHook(() =>
      useEditorPreferences({ ownerId: 'user_1', passwordGated: false, setAiPanelVisible: vi.fn() }),
    );
    await waitFor(() => expect(result.current.prefsSettled).toBe(true));
    expect(fetchUserPreferences).toHaveBeenCalledWith('user_1');
    expect(result.current.userPreferences).toEqual({ reduceMotion: true });
  });

  it('opens the AI panel when AI assistance turns on, not when its setter changes', () => {
    const first = vi.fn();
    const { result, rerender } = renderHook((deps: Deps) => useEditorPreferences(deps), {
      initialProps: { ownerId: 'self', passwordGated: false, setAiPanelVisible: first },
    });
    expect(first).not.toHaveBeenCalled();
    act(() => result.current.setUserPreferences({ aiAssistanceEnabled: true }));
    expect(first).toHaveBeenCalledWith(true);
    const second = vi.fn();
    rerender({ ownerId: 'self', passwordGated: false, setAiPanelVisible: second });
    expect(second).not.toHaveBeenCalled();
  });
});
