// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIsOfflineDiagram } from './useIsOfflineDiagram';

const offline = new Set<string>();
const synced = new Set<string>();
vi.mock('@/lib/offline/offline-store', () => ({
  isOfflineId: async (id: string) => offline.has(id),
  isOfflineIdSync: (id: string) => synced.has(id),
}));

afterEach(() => {
  offline.clear();
  synced.clear();
});

// Offline Mode (docs/specs/006-diagram/offline-mode.md).
describe('useIsOfflineDiagram', () => {
  it('seeds from the sync cache, then settles on the async check', async () => {
    synced.add('a');
    const { result } = renderHook(() => useIsOfflineDiagram('a'));
    expect(result.current).toBe(true);
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('confirms an offline diagram the sync cache had not seen', async () => {
    offline.add('b');
    const { result } = renderHook(() => useIsOfflineDiagram('b'));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('is false the moment there is no diagram', async () => {
    offline.add('c');
    const { result, rerender } = renderHook(({ id }) => useIsOfflineDiagram(id), {
      initialProps: { id: 'c' as string | null },
    });
    await waitFor(() => expect(result.current).toBe(true));
    rerender({ id: null });
    expect(result.current).toBe(false);
  });
});
