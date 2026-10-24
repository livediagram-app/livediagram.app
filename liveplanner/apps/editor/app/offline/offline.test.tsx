// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  plans: [] as { id: string; name: string; savedAt: number }[],
  accountUserId: null as string | null,
  sync: vi.fn(),
  handoff: vi.fn(),
}));
vi.mock('@/lib/offline/offline-store', () => ({
  offlineListProjects: async () => store.plans,
  offlineIdCount: async () => store.plans.length,
  subscribeOfflineIds: () => () => {},
}));
vi.mock('@/hooks/persistence/useAccountBootstrap', () => ({
  useAccountBootstrap: () => ({ accountUserId: store.accountUserId }),
}));
vi.mock('@/hooks/persistence/useSignedGuestId', () => ({ useSignedGuestId: () => null }));
vi.mock('@/hooks/persistence/useConversionHandoff', () => ({
  useConversionHandoff: (ownerId: string | null, signedIn: boolean) => {
    store.handoff(ownerId, signedIn);
  },
}));
vi.mock('@/components/dialogs/LocalMovePrompt', () => ({ LocalMovePrompt: () => null }));
vi.mock('@/hooks/persistence/useOfflineConversion', () => ({
  useOfflineConversion: (plan: { id: string }) => ({
    syncToCloud: async () => {
      store.sync(plan.id);
    },
    takeOffline: async () => {},
  }),
}));

import { ThisBrowserRow } from '@/components/panels/ThisBrowserRow';
import { OfflinePlans } from './OfflinePlans';

beforeEach(() => {
  store.plans = [];
  store.accountUserId = null;
  store.sync.mockClear();
});

describe('This Browser', () => {
  it('lists the plans kept only in this browser, newest first, each opening in the editor', async () => {
    store.plans = [
      { id: 'a', name: 'Older', savedAt: 1 },
      { id: 'b', name: 'Newer', savedAt: 2 },
    ];
    render(<OfflinePlans />);
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    const links = screen.getAllByRole('listitem').map((li) => li.querySelector('a')!);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/project/b', '/project/a']);
    expect(screen.getByRole('link', { name: 'Open the Explorer' }).getAttribute('href')).toMatch(
      /^\/explorer$/,
    );
    // A guest has no account to sync to.
    expect(screen.queryByRole('button', { name: 'Sync Plan' })).toBeNull();
  });

  it('runs a Take Offline or Sync the Explorer hands over, as the person', async () => {
    store.accountUserId = 'user_ada';
    render(<OfflinePlans />);
    await waitFor(() => expect(store.handoff).toHaveBeenCalledWith('user_ada', true));
  });

  it('offers Sync Plan to a signed-in person', async () => {
    store.plans = [{ id: 'a', name: 'A', savedAt: 1 }];
    store.accountUserId = 'user_ada';
    render(<OfflinePlans />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sync Plan' }));
    expect(store.sync).toHaveBeenCalledWith('a');
  });

  it('shows the panel row with the count only while there are some', async () => {
    const { container, rerender } = render(<ThisBrowserRow />);
    await waitFor(() => expect(container.textContent).toBe(''));
    store.plans = [{ id: 'a', name: 'A', savedAt: 1 }];
    rerender(<ThisBrowserRow key="again" />);
    const row = await screen.findByRole('link', { name: /This Browser/ });
    expect(row.getAttribute('href')).toBe('/offline');
    expect(row.textContent).toContain('1');
  });
});
