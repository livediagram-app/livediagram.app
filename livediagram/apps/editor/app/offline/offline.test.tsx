// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  documents: [] as { id: string; name: string; savedAt: number }[],
  accountUserId: null as string | null,
  sync: vi.fn(),
  deleted: vi.fn(),
}));
vi.mock('@/lib/offline/offline-store', () => ({
  offlineListDocuments: async () => store.documents,
  offlineDeleteDocument: async (id: string) => {
    store.deleted(id);
  },
  offlineIdCount: async () => store.documents.length,
  subscribeOfflineIds: () => () => {},
}));
vi.mock('@/hooks/persistence/useAccountBootstrap', () => ({
  useAccountBootstrap: () => ({ accountUserId: store.accountUserId }),
}));
vi.mock('@/hooks/persistence/useOfflineConversion', () => ({
  useOfflineConversion: (doc: { id: string }) => ({
    syncToCloud: async () => {
      store.sync(doc.id);
    },
    takeOffline: async () => {},
  }),
}));

import { ThisBrowserRow } from '@/components/panels/ThisBrowserRow';
import { OfflineDocuments } from './OfflineDocuments';

beforeEach(() => {
  store.documents = [];
  store.accountUserId = null;
  store.sync.mockClear();
  store.deleted.mockClear();
});

describe('This Browser', () => {
  it('lists the canvases kept only in this browser, newest first, each opening in the editor', async () => {
    store.documents = [
      { id: 'a', name: 'Older', savedAt: 1 },
      { id: 'b', name: 'Newer', savedAt: 2 },
    ];
    render(<OfflineDocuments />);
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    const links = screen.getAllByRole('listitem').map((li) => li.querySelector('a')!);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/document/b', '/document/a']);
    // A guest has no account to sync to.
    expect(screen.queryByRole('button', { name: 'Sync Canvas' })).toBeNull();
  });

  it('offers Sync Canvas to a signed-in person', async () => {
    store.documents = [{ id: 'a', name: 'A', savedAt: 1 }];
    store.accountUserId = 'user_ada';
    render(<OfflineDocuments />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sync Canvas' }));
    expect(store.sync).toHaveBeenCalledWith('a');
  });

  it('deletes a canvas for good only after asking', async () => {
    store.documents = [{ id: 'a', name: 'Sketch', savedAt: 1 }];
    render(<OfflineDocuments />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(store.deleted).not.toHaveBeenCalled();
    expect(screen.getByText(/removes it for good/)).toBeTruthy();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(store.deleted).toHaveBeenCalledWith('a'));
  });

  it('keeps the canvas when the person cancels', async () => {
    store.documents = [{ id: 'a', name: 'Sketch', savedAt: 1 }];
    render(<OfflineDocuments />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(store.deleted).not.toHaveBeenCalled();
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
