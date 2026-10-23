// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  documents: [] as { id: string; name: string; savedAt: number }[],
  accountUserId: null as string | null,
  sync: vi.fn(),
}));
vi.mock('@/lib/offline/offline-store', () => ({
  offlineListDocuments: async () => store.documents,
  offlineIdCount: async () => store.documents.length,
  subscribeOfflineIds: () => () => {},
}));
vi.mock('@/hooks/persistence/useAccountBootstrap', () => ({
  useAccountBootstrap: () => ({ accountUserId: store.accountUserId }),
}));
vi.mock('@/hooks/persistence/useOfflineConversion', () => ({
  useOfflineConversion: (doc: { id: string }) => ({
    syncToCloud: async () => store.sync(doc.id),
    takeOffline: async () => {},
  }),
}));

import { ThisBrowserRow } from '@/components/panels/ThisBrowserRow';
import { OfflineDocuments } from './OfflineDocuments';

beforeEach(() => {
  store.documents = [];
  store.accountUserId = null;
  store.sync.mockClear();
});

describe('This Browser', () => {
  it('lists the documents kept only in this browser, newest first, each opening in the editor', async () => {
    store.documents = [
      { id: 'a', name: 'Older', savedAt: 1 },
      { id: 'b', name: 'Newer', savedAt: 2 },
    ];
    render(<OfflineDocuments />);
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    const links = screen.getAllByRole('listitem').map((li) => li.querySelector('a')!);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/document/b', '/document/a']);
    // A guest has no account to sync to.
    expect(screen.queryByRole('button', { name: 'Sync Document' })).toBeNull();
  });

  it('offers Sync Document to a signed-in person', async () => {
    store.documents = [{ id: 'a', name: 'A', savedAt: 1 }];
    store.accountUserId = 'user_ada';
    render(<OfflineDocuments />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sync Document' }));
    expect(store.sync).toHaveBeenCalledWith('a');
  });

  it('shows the panel row with the count only while there are some', async () => {
    const { container, rerender } = render(<ThisBrowserRow />);
    await waitFor(() => expect(container.textContent).toBe(''));
    store.documents = [{ id: 'a', name: 'A', savedAt: 1 }];
    rerender(<ThisBrowserRow key="again" />);
    const row = await screen.findByRole('link', { name: /This Browser/ });
    expect(row.getAttribute('href')).toBe('/offline');
    expect(row.textContent).toContain('1');
  });
});
