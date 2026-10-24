// This Browser on the app's own address: the host app's items kept only in this browser, read from the list the app
// keeps (this-browser.ts), shown as liveplanner's own Explorer showed them: the sidebar row and its count, the view,
// the Trash's group and Jump Back In. Without a host (liveworkspace.app) none of it shows.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import {
  dropThisBrowserConversion,
  dropThisBrowserItem,
  putThisBrowserItem,
  readThisBrowser,
  readThisBrowserConversion,
  subscribeThisBrowser,
  THIS_BROWSER_MAX,
  thisBrowserConvertHref,
  thisBrowserPublisher,
  thisBrowserKey,
  writeThisBrowser,
  type ThisBrowserItem,
} from '../this-browser';
import type { ExplorerView } from '../views';
import { Explorer } from './Explorer';
import type { ThisBrowserHost } from './ThisBrowser';

const local = (n: number, extra: Partial<ThisBrowserItem> = {}): ThisBrowserItem => ({
  id: `local-${n}`,
  title: `Local ${n}`,
  createdAt: 1_000 + n,
  updatedAt: 2_000 + n,
  lastOpenedAt: null,
  trashedAt: null,
  favourite: false,
  ...extra,
});

function host(items: ThisBrowserItem[]): ThisBrowserHost {
  return { items, itemHref: (item) => `/project/${item.id}`, helpHref: '/help/offline/' };
}

function page(
  view: ExplorerView,
  thisBrowser: ThisBrowserHost | undefined,
  index = createFakeIndex(),
) {
  const onNavigate = vi.fn();
  render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={view}
      onNavigate={onNavigate}
      itemHref={(item) => `/project/${item.id}`}
      onCreate={() => {}}
      viewerId="user_me"
      heroHidden
      thisBrowser={thisBrowser}
    />,
  );
  return onNavigate;
}

afterEach(() => localStorage.clear());

describe('the list an app keeps', () => {
  it('round-trips, newest change first, and drops what is malformed', () => {
    writeThisBrowser('liveplanner', [local(1), local(3), local(2)]);
    expect(readThisBrowser('liveplanner').map((i) => i.id)).toEqual([
      'local-3',
      'local-2',
      'local-1',
    ]);
    localStorage.setItem(
      thisBrowserKey('liveplanner'),
      JSON.stringify({ v: 1, items: [{ id: 'x', updatedAt: 'no' }, { title: 'no id' }, 7] }),
    );
    expect(readThisBrowser('liveplanner')).toEqual([
      expect.objectContaining({ id: 'x', updatedAt: 0, trashedAt: null }),
    ]);
    localStorage.setItem(thisBrowserKey('liveplanner'), '{not json');
    expect(readThisBrowser('liveplanner')).toEqual([]);
    expect(readThisBrowser('livedesign')).toEqual([]);
  });

  it('puts and drops one item, tells this tab, and stays bounded', () => {
    const heard = vi.fn();
    const stop = subscribeThisBrowser('liveplanner', heard);
    putThisBrowserItem('liveplanner', local(1));
    putThisBrowserItem('liveplanner', local(1, { title: 'Renamed' }));
    // The same again (an autosave that changed nothing listed) writes nothing.
    putThisBrowserItem('liveplanner', local(1, { title: 'Renamed' }));
    expect(readThisBrowser('liveplanner')).toEqual([local(1, { title: 'Renamed' })]);
    dropThisBrowserItem('liveplanner', 'local-1');
    expect(localStorage.getItem(thisBrowserKey('liveplanner'))).toBeNull();
    expect(heard).toHaveBeenCalledTimes(3);
    stop();
    writeThisBrowser(
      'liveplanner',
      Array.from({ length: THIS_BROWSER_MAX + 20 }, (_, i) => local(i)),
    );
    expect(readThisBrowser('liveplanner')).toHaveLength(THIS_BROWSER_MAX);
    expect(heard).toHaveBeenCalledTimes(3);
  });

  it("is kept by an app's offline store: every record at once, then each write", () => {
    const list = thisBrowserPublisher('liveplanner', (opens) =>
      typeof opens === 'number' ? opens : null,
    );
    const rec = (id: string, extra = {}) => ({ id, name: id, createdAt: 1, savedAt: 2, ...extra });
    list.publish([rec('a', { opens: 9 }), rec('b', { trashedAt: 3, favourite: true })]);
    expect(
      readThisBrowser('liveplanner').map((i) => [i.id, i.lastOpenedAt, i.trashedAt, i.favourite]),
    ).toEqual([
      ['a', 9, null, false],
      ['b', null, 3, true],
    ]);
    list.note('a', rec('a', { name: 'Renamed', savedAt: 5 }));
    list.note('b', 'delete');
    list.note('c', undefined);
    expect(readThisBrowser('liveplanner').map((i) => i.title)).toEqual(['Renamed']);
  });

  it('reads a long list well inside a frame', () => {
    writeThisBrowser(
      'liveplanner',
      Array.from({ length: THIS_BROWSER_MAX }, (_, i) => local(i)),
    );
    const started = performance.now();
    for (let k = 0; k < 20; k++) readThisBrowser('liveplanner');
    expect((performance.now() - started) / 20).toBeLessThan(8);
  });
});

describe('This Browser in the Explorer', () => {
  it('shows the sidebar row with its count, which opens the view', async () => {
    const onNavigate = page(
      { kind: 'home' },
      host([local(1), local(2), local(3, { trashedAt: 5 })]),
    );
    const row = await screen.findByRole('treeitem', { name: /This Browser/ });
    expect(row.textContent).toContain('2');
    fireEvent.click(row.querySelector('[data-tree-activate]')!);
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'offline' }, '/explorer/offline');
  });

  it('has no row without a host, or with nothing kept', async () => {
    page({ kind: 'home' }, undefined);
    await screen.findByRole('treeitem', { name: /Home/ });
    expect(screen.queryByRole('treeitem', { name: /This Browser/ })).toBeNull();
  });

  it('lists the live ones in its view, each opening in the app with the pill', async () => {
    page({ kind: 'offline' }, host([local(2), local(1), local(3, { trashedAt: 5 })]));
    const rows = await screen.findAllByRole('link', { name: /Local/ });
    expect(rows.map((a) => a.getAttribute('href'))).toEqual([
      '/project/local-2',
      '/project/local-1',
    ]);
    expect(within(rows[0]!).getByText('This Browser')).toBeTruthy();
  });

  it('offers Sync on each live row where the host can, handing over to the app', async () => {
    page(
      { kind: 'offline' },
      {
        ...host([local(2), local(1, { trashedAt: 5 })]),
        syncHref: (item) => thisBrowserConvertHref('/offline', 'sync', item.id),
      },
    );
    const sync = await screen.findByRole('link', { name: 'Sync Plan: Local 2' });
    expect(sync.getAttribute('href')).toBe('/offline?convert=sync&item=local-2');
    expect(screen.queryByRole('link', { name: /Sync Plan: Local 1/ })).toBeNull();
  });

  it('has no Sync where the host offers none', async () => {
    page({ kind: 'offline' }, host([local(1)]));
    await screen.findAllByRole('link', { name: /Local 1/ });
    expect(screen.queryByRole('link', { name: /^Sync/ })).toBeNull();
  });

  it('says so when nothing is kept', async () => {
    page({ kind: 'offline' }, host([]));
    expect(await screen.findByText('Nothing is kept only in this browser.')).toBeTruthy();
  });

  it('groups the trashed ones in the Trash', async () => {
    page({ kind: 'trash' }, host([local(1), local(2, { trashedAt: Date.now() })]));
    const group = await screen.findByRole('region', { name: 'This Browser' });
    const links = within(group).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/project/local-2']);
    expect(group.textContent).toContain('30 days left');
  });

  it('is no first run while something is kept in this browser', async () => {
    const onFirstRun = vi.fn();
    render(
      <Explorer
        app="liveplanner"
        client={createFakeIndex().client}
        view={{ kind: 'home' }}
        onNavigate={() => {}}
        itemHref={(item) => `/project/${item.id}`}
        onCreate={() => {}}
        viewerId="user_me"
        heroHidden
        welcome={{ manifest: null, onFirstRun, signedIn: false, signInHref: '/sign-in' }}
        thisBrowser={host([local(1, { lastOpenedAt: 900 })])}
      />,
    );
    await waitFor(() =>
      expect(document.querySelectorAll('[data-this-browser-card]').length).toBeGreaterThan(0),
    );
    expect(onFirstRun).not.toHaveBeenCalled();
  });

  it('merges the opened ones into Jump Back In by last open', async () => {
    const index = createFakeIndex({ items: [makeItem(1, { lastOpenedAt: 500 })] });
    page(
      { kind: 'home' },
      host([local(1, { lastOpenedAt: 900 }), local(2), local(3, { lastOpenedAt: 100 })]),
      index,
    );
    await waitFor(() =>
      expect(document.querySelectorAll('[data-this-browser-card]').length).toBeGreaterThan(0),
    );
    const cards = [
      ...document.querySelectorAll('[data-jump-back-in-group="compact"] [data-item-card]'),
    ];
    expect(cards.map((c) => c.getAttribute('data-item-card'))).toEqual([
      'local-1',
      'item-1',
      'local-3',
    ]);
  });
});

describe('moving an item in or out of this browser', () => {
  it("names the conversion and the item in the app page's address, and reads them back", () => {
    const href = thisBrowserConvertHref('/offline', 'take-offline', 'doc 1');
    expect(href).toBe('/offline?convert=take-offline&item=doc+1');
    expect(readThisBrowserConversion(href.slice(href.indexOf('?')))).toEqual({
      conversion: 'take-offline',
      id: 'doc 1',
    });
    expect(readThisBrowserConversion('?convert=sync&item=d2')).toEqual({
      conversion: 'sync',
      id: 'd2',
    });
  });

  it('reads nothing from an unknown conversion or a missing item', () => {
    expect(readThisBrowserConversion('?convert=delete&item=d1')).toBeNull();
    expect(readThisBrowserConversion('?convert=sync')).toBeNull();
    expect(readThisBrowserConversion('')).toBeNull();
  });

  it('takes the request out of the address, keeping the rest', () => {
    window.history.replaceState(null, '', '/offline?convert=sync&item=d1&x=1#h');
    dropThisBrowserConversion();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/offline?x=1#h',
    );
  });
});
