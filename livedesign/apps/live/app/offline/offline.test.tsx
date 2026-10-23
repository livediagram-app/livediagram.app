// @vitest-environment jsdom
import { explorerHref } from '@/lib/explorer-redirect';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  designs: [] as { id: string; name: string; savedAt: number }[],
  accountUserId: null as string | null,
  sync: vi.fn(),
  handoff: vi.fn(),
}));
vi.mock('@/lib/offline/offline-store', () => ({
  offlineListDesigns: async () => store.designs,
  offlineIdCount: async () => store.designs.length,
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
  useOfflineConversion: (design: { id: string }) => ({
    syncToCloud: async () => {
      store.sync(design.id);
    },
    takeOffline: async () => {},
  }),
}));

import { ThisBrowserRow } from '@/components/panels/ThisBrowserRow';
import { OfflineDesigns } from './OfflineDesigns';

beforeEach(() => {
  store.designs = [];
  store.accountUserId = null;
  store.sync.mockClear();
});

describe('This Browser', () => {
  it('lists the designs kept only in this browser, newest first, each opening in the editor', async () => {
    store.designs = [
      { id: 'a', name: 'Older', savedAt: 1 },
      { id: 'b', name: 'Newer', savedAt: 2 },
    ];
    render(<OfflineDesigns />);
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    const links = screen.getAllByRole('listitem').map((li) => li.querySelector('a')!);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/design/b', '/design/a']);
    expect(screen.getByRole('link', { name: 'Open the Explorer' }).getAttribute('href')).toBe(
      explorerHref(),
    );
    // A guest has no account to sync to.
    expect(screen.queryByRole('button', { name: 'Sync Design' })).toBeNull();
  });

  it('runs a Take Offline or Sync the Explorer hands over, as the person', async () => {
    store.accountUserId = 'user_ada';
    render(<OfflineDesigns />);
    await waitFor(() => expect(store.handoff).toHaveBeenCalledWith('user_ada', true));
  });

  it('offers Sync Design to a signed-in person', async () => {
    store.designs = [{ id: 'a', name: 'A', savedAt: 1 }];
    store.accountUserId = 'user_ada';
    render(<OfflineDesigns />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sync Design' }));
    expect(store.sync).toHaveBeenCalledWith('a');
  });

  it('shows the panel row with the count only while there are some', async () => {
    const { container, rerender } = render(<ThisBrowserRow />);
    await waitFor(() => expect(container.textContent).toBe(''));
    store.designs = [{ id: 'a', name: 'A', savedAt: 1 }];
    rerender(<ThisBrowserRow key="again" />);
    const row = await screen.findByRole('link', { name: /This Browser/ });
    expect(row.getAttribute('href')).toBe('/offline');
    expect(row.textContent).toContain('1');
  });
});
