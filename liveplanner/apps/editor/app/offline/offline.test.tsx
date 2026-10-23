// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  plans: [] as { id: string; name: string; savedAt: number }[],
}));
vi.mock('@/lib/offline/offline-store', () => ({
  offlineListProjects: async () => store.plans,
  offlineIdCount: async () => store.plans.length,
  subscribeOfflineIds: () => () => {},
}));

import { ThisBrowserRow } from '@/components/panels/ThisBrowserRow';
import { OfflinePlans } from './OfflinePlans';

beforeEach(() => {
  store.plans = [];
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
      /\/explorer\?from=liveplanner$/,
    );
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
