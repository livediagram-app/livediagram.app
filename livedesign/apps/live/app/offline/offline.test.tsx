// @vitest-environment jsdom
import { explorerHref } from '@/lib/explorer-redirect';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  designs: [] as { id: string; name: string; savedAt: number }[],
}));
vi.mock('@/lib/offline/offline-store', () => ({
  offlineListDesigns: async () => store.designs,
  offlineIdCount: async () => store.designs.length,
  subscribeOfflineIds: () => () => {},
}));

import { ThisBrowserRow } from '@/components/panels/ThisBrowserRow';
import { OfflineDesigns } from './OfflineDesigns';

beforeEach(() => {
  store.designs = [];
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
