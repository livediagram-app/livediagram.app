// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIsOfflineProject } from './useIsOfflineProject';

const offline = new Set<string>();
const synced = new Set<string>();
const listeners = new Set<(id: string) => void>();
vi.mock('@/lib/offline/offline-store', () => ({
  isOfflineId: async (id: string) => offline.has(id),
  isOfflineIdSync: (id: string) => synced.has(id),
  subscribeOfflineIds: (l: (id: string) => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
}));

afterEach(() => {
  offline.clear();
  synced.clear();
});

// Offline Mode (docs/specs/006-project/offline-mode.md).
describe('useIsOfflineProject', () => {
  it('seeds from the sync cache, then settles on the async check', async () => {
    synced.add('a');
    const { result } = renderHook(() => useIsOfflineProject('a'));
    expect(result.current).toBe(true);
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('confirms an offline project the sync cache had not seen', async () => {
    offline.add('b');
    const { result } = renderHook(() => useIsOfflineProject('b'));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('is false the moment there is no project', async () => {
    offline.add('c');
    const initialProps: { id: string | null } = { id: 'c' };
    const { result, rerender } = renderHook(({ id }) => useIsOfflineProject(id), {
      initialProps,
    });
    await waitFor(() => expect(result.current).toBe(true));
    rerender({ id: null });
    expect(result.current).toBe(false);
  });

  // docs/specs/006-project/offline-mode.md "Syncing in place": Sync Project flips it with no reload.
  it('follows the project leaving the store', async () => {
    offline.add('c');
    const { result } = renderHook(() => useIsOfflineProject('c'));
    await waitFor(() => expect(result.current).toBe(true));
    offline.delete('c');
    listeners.forEach((l) => l('c'));
    await waitFor(() => expect(result.current).toBe(false));
  });
});
