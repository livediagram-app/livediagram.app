// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIsOfflineDesign } from './useIsOfflineDesign';

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

// Offline Mode (docs/specs/006-design/offline-mode.md).
describe('useIsOfflineDesign', () => {
  it('seeds from the sync cache, then settles on the async check', async () => {
    synced.add('a');
    const { result } = renderHook(() => useIsOfflineDesign('a'));
    expect(result.current).toBe(true);
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('confirms an offline design the sync cache had not seen', async () => {
    offline.add('b');
    const { result } = renderHook(() => useIsOfflineDesign('b'));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('is false the moment there is no design', async () => {
    offline.add('c');
    const initialProps: { id: string | null } = { id: 'c' };
    const { result, rerender } = renderHook(({ id }) => useIsOfflineDesign(id), {
      initialProps,
    });
    await waitFor(() => expect(result.current).toBe(true));
    rerender({ id: null });
    expect(result.current).toBe(false);
  });

  // docs/specs/006-design/offline-mode.md "Syncing in place": Sync Design flips it with no reload.
  it('follows the design leaving the store', async () => {
    offline.add('c');
    const { result } = renderHook(() => useIsOfflineDesign('c'));
    await waitFor(() => expect(result.current).toBe(true));
    offline.delete('c');
    listeners.forEach((l) => l('c'));
    await waitFor(() => expect(result.current).toBe(false));
  });
});
