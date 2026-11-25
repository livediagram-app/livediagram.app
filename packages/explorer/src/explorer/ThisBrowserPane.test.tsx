// Offline's own view (ThisBrowserPane.tsx, from its own chunk): what it draws without a host, its back bar's first
// step, Clear Filters on a lens that leaves nothing, and an address that asks no hand-over.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex } from '../test/fakeClient';
import { writeThisBrowserStore, type ThisBrowserItem } from '../this-browser';
import type { ExplorerView } from '../views';
import { Explorer } from './Explorer';
import { useThisBrowserList, type ThisBrowserHost } from './ThisBrowser';

const APP = 'liveplanner' as const;

const local = (n: number, extra: Partial<ThisBrowserItem> = {}): ThisBrowserItem => ({
  id: `item-${n}`,
  title: `Local ${n}`,
  createdAt: 1_000 + n,
  updatedAt: 2_000 + n,
  lastOpenedAt: null,
  trashedAt: null,
  ...extra,
});

type HostBits = Omit<ThisBrowserHost, 'items' | 'itemHref'>;

function Live({
  view,
  onNavigate,
  bits,
}: {
  view: ExplorerView;
  onNavigate: (v: ExplorerView) => void;
  bits: HostBits | null;
}) {
  const items = useThisBrowserList(bits ? APP : null);
  return (
    <Explorer
      app={APP}
      client={createFakeIndex().client}
      view={view}
      onNavigate={onNavigate}
      itemHref={(item) => `/project/${item.id}`}
      onCreate={() => {}}
      viewerId="user_me"
      heroHidden
      thisBrowser={bits ? { items, itemHref: (item) => `/project/${item.id}`, ...bits } : undefined}
    />
  );
}

function page(view: ExplorerView, bits: HostBits | null = {}) {
  const onNavigate = vi.fn();
  render(<Live view={view} onNavigate={onNavigate} bits={bits} />);
  return onNavigate;
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('Offline’s view', () => {
  it('without a host says nothing is kept, with no New Folder and no chips', async () => {
    page({ kind: 'offline' }, null);
    expect(await screen.findByText('Nothing is kept Offline.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New Folder' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Filters' })).toBeNull();
  });

  it('goes back to its root from the back bar’s first step', async () => {
    writeThisBrowserStore(APP, {
      items: [local(1, { folderId: 'a' })],
      folders: [{ id: 'a', name: 'Trips', parentId: null, createdAt: 1, updatedAt: 1 }],
    });
    const onNavigate = page({ kind: 'offline', folder: 'a' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Trips' })).toBeTruthy();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    fireEvent.click(within(crumbs).getByRole('button', { name: /Offline/ }));
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'offline' }, '/explorer/offline');
  });

  it('clears a lens that leaves nothing from the empty card', async () => {
    writeThisBrowserStore(APP, { items: [local(1)], folders: [] });
    const onNavigate = page({ kind: 'offline', q: 'made-by:ai' });
    fireEvent.click(await screen.findByRole('button', { name: 'Clear Filters' }));
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'offline' }, '/explorer/offline', {
      replace: true,
    });
  });

  it('hands nothing over when its address asks for nothing', async () => {
    const replace = vi.fn();
    vi.stubGlobal('location', { ...window.location, search: '', replace });
    const handOverHref = vi.fn(() => '/project/x');
    writeThisBrowserStore(APP, { items: [local(1)], folders: [] });
    page({ kind: 'offline' }, { handOverHref });
    expect(await screen.findByText('Local 1')).toBeTruthy();
    expect(handOverHref).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
