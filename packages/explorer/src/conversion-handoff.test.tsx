// Take Offline and Sync handed over by the Explorer on an app's address: read once from This Browser's address,
// taken out of it, checked, confirmed, then run by the app's own conversions.
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveworkspace/index-client';
import { useConversionHandoff, type ConversionHandoffOptions } from './conversion-handoff';

const h = {
  item: null as Partial<Item> | null,
  kept: [] as { id: string; name: string }[],
  confirmed: true,
  takeOffline: vi.fn(async () => {}),
  syncToCloud: vi.fn(async () => {}),
  confirm: vi.fn(),
  error: vi.fn(),
};

const options = (
  ownerId: string | null,
  signedIn: boolean,
  over: Partial<ConversionHandoffOptions> = {},
): ConversionHandoffOptions => ({
  ownerId,
  signedIn,
  app: 'livediagram',
  noun: 'canvas',
  conversions: { takeOffline: h.takeOffline, syncToCloud: h.syncToCloud },
  confirm: async (opts) => {
    h.confirm(opts);
    return h.confirmed;
  },
  toastError: h.error,
  getItem: async () => {
    if (!h.item) throw new Error('not_found');
    return { item: h.item as Item };
  },
  listKept: async () => h.kept,
  ...over,
});

const at = (search: string) => window.history.replaceState(null, '', `/offline${search}`);
const doc = (extra: Partial<Item> = {}): Partial<Item> => ({
  id: 'd1',
  app: 'livediagram',
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
  it("takes the person's own item offline (its own confirm asks), and leaves the address", async () => {
    at('?convert=take-offline&item=d1');
    h.item = doc();
    renderHook(() => useConversionHandoff(options('user_ada', true)));
    await waitFor(() => expect(h.takeOffline).toHaveBeenCalledWith({ id: 'd1', name: 'Report' }));
    expect(window.location.search).toBe('');
  });

  it('waits for the person, then reads the request once', async () => {
    at('?convert=take-offline&item=d1');
    h.item = doc();
    const { rerender } = renderHook(({ owner }) => useConversionHandoff(options(owner, false)), {
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
  ] as const)('refuses %s, in the app’s own words', async (_, extra) => {
    at('?convert=take-offline&item=d1');
    h.item = doc(extra);
    renderHook(() => useConversionHandoff(options('user_ada', true)));
    await waitFor(() =>
      expect(h.error).toHaveBeenCalledWith('You can’t take that canvas offline.'),
    );
    expect(h.takeOffline).not.toHaveBeenCalled();
  });

  it("takes only the app's own items", async () => {
    at('?convert=take-offline&item=d1');
    h.item = doc({ app: 'livedocuments' });
    renderHook(() =>
      useConversionHandoff(options('user_ada', true, { app: 'livedocuments', noun: 'document' })),
    );
    await waitFor(() => expect(h.takeOffline).toHaveBeenCalledWith({ id: 'd1', name: 'Report' }));
  });

  it('syncs an item this browser keeps once the person confirms, naming it as the app does', async () => {
    at('?convert=sync&item=d1');
    h.kept = [{ id: 'd1', name: 'Notes' }];
    renderHook(() => useConversionHandoff(options('user_ada', true, { noun: 'design' })));
    await waitFor(() => expect(h.syncToCloud).toHaveBeenCalledWith({ id: 'd1', name: 'Notes' }));
    expect(h.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: 'Sync Design' }),
    );
  });

  it('syncs nothing when the person says no, for a guest, or for one this browser lacks', async () => {
    at('?convert=sync&item=d1');
    h.kept = [{ id: 'd1', name: 'Notes' }];
    h.confirmed = false;
    renderHook(() => useConversionHandoff(options('user_ada', true)));
    await waitFor(() => expect(h.confirm).toHaveBeenCalled());
    at('?convert=sync&item=d1');
    renderHook(() => useConversionHandoff(options('guest_1', false)));
    at('?convert=sync&item=missing');
    renderHook(() => useConversionHandoff(options('user_ada', true)));
    await waitFor(() => expect(h.error).toHaveBeenCalledTimes(2));
    expect(h.error).toHaveBeenCalledWith('Couldn’t find that canvas in this browser.');
    expect(h.syncToCloud).not.toHaveBeenCalled();
  });
});
