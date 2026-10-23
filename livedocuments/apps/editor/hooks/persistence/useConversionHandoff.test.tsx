// @vitest-environment jsdom
// Take Offline and Sync handed over by the Explorer on this app's address: read once from This Browser's address,
// taken out of it, checked, confirmed, then run by the panel's own conversions.
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveworkspace/index-client';

const h = vi.hoisted(() => ({
  item: null as Partial<Item> | null,
  kept: [] as { id: string; name: string }[],
  confirmed: true,
  takeOffline: vi.fn(async () => {}),
  syncToCloud: vi.fn(async () => {}),
  confirm: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/lib/index-client', () => ({
  indexClient: {
    getItem: async () => {
      if (!h.item) throw new Error('not_found');
      return { item: h.item };
    },
  },
}));
vi.mock('@/lib/offline/offline-store', () => ({ offlineListDocuments: async () => h.kept }));
vi.mock('./useOfflineConversion', () => ({
  useOfflineConversions: () => ({ takeOffline: h.takeOffline, syncToCloud: h.syncToCloud }),
}));
vi.mock('@/hooks/ui/useConfirm', () => ({
  useConfirm: () => async (opts: unknown) => {
    h.confirm(opts);
    return h.confirmed;
  },
}));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => ({ error: h.error }) }));

import { useConversionHandoff } from './useConversionHandoff';

const at = (search: string) => window.history.replaceState(null, '', `/offline${search}`);
const doc = (extra: Partial<Item> = {}): Partial<Item> => ({
  id: 'd1',
  app: 'livedocuments',
  title: 'Report',
  access: 'edit',
  sharedVia: null,
  ...extra,
});

beforeEach(() => {
  h.item = null;
  h.kept = [];
  h.confirmed = true;
  for (const fn of [h.takeOffline, h.syncToCloud, h.confirm, h.error]) fn.mockClear();
});
afterEach(() => at(''));

describe('Take Offline and Sync handed over by the Explorer', () => {
  it("takes the person's own document offline (its own confirm asks), and leaves the address", async () => {
    at('?convert=take-offline&item=d1');
    h.item = doc();
    renderHook(() => useConversionHandoff('user_ada', true));
    await waitFor(() =>
      expect(h.takeOffline).toHaveBeenCalledWith({ id: 'd1', name: 'Report' }),
    );
    expect(window.location.search).toBe('');
  });

  it('waits for the person, then reads the request once', async () => {
    at('?convert=take-offline&item=d1');
    h.item = doc();
    const { rerender } = renderHook(({ owner }) => useConversionHandoff(owner, false), {
      initialProps: { owner: null as string | null },
    });
    expect(window.location.search).not.toBe('');
    rerender({ owner: 'guest_1' });
    await waitFor(() => expect(h.takeOffline).toHaveBeenCalledTimes(1));
    rerender({ owner: 'guest_1' });
    expect(h.takeOffline).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['another app', { app: 'livedesign' }],
    ['one reached through a link', { sharedVia: 'code1' }],
    ['one the person can only view', { access: 'view' }],
  ] as const)('refuses %s', async (_, extra) => {
    at('?convert=take-offline&item=d1');
    h.item = doc(extra as Partial<Item>);
    renderHook(() => useConversionHandoff('user_ada', true));
    await waitFor(() => expect(h.error).toHaveBeenCalled());
    expect(h.takeOffline).not.toHaveBeenCalled();
  });

  it('syncs a document this browser keeps once the person confirms', async () => {
    at('?convert=sync&item=d1');
    h.kept = [{ id: 'd1', name: 'Notes' }];
    renderHook(() => useConversionHandoff('user_ada', true));
    await waitFor(() => expect(h.syncToCloud).toHaveBeenCalledWith({ id: 'd1', name: 'Notes' }));
    expect(h.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: 'Sync Document' }),
    );
  });

  it('syncs nothing when the person says no, for a guest, or for one this browser lacks', async () => {
    at('?convert=sync&item=d1');
    h.kept = [{ id: 'd1', name: 'Notes' }];
    h.confirmed = false;
    renderHook(() => useConversionHandoff('user_ada', true));
    await waitFor(() => expect(h.confirm).toHaveBeenCalled());
    at('?convert=sync&item=d1');
    renderHook(() => useConversionHandoff('guest_1', false));
    at('?convert=sync&item=missing');
    renderHook(() => useConversionHandoff('user_ada', true));
    await waitFor(() => expect(h.error).toHaveBeenCalledTimes(2));
    expect(h.syncToCloud).not.toHaveBeenCalled();
  });
});
