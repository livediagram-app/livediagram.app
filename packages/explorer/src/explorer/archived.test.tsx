// Archived (liveworkspace/docs/specs/004-index/one-explorer.md "Archived" and "The sidebar"): the Library's rows and
// what opens them, Move to Archived, the view, the closed card and its dialog, Change Folder's Archived space, Search's
// badge, and the same for an item kept only in this browser.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexError, type Folder } from '@liveworkspace/index-client';
import { APP_ITEMS } from '@liveworkspace/sites';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import {
  isThisBrowserArchived,
  readThisBrowser,
  setThisBrowserArchived,
  thisBrowserKey,
  writeThisBrowser,
  type ThisBrowserItem,
} from '../this-browser';
import type { ExplorerView } from '../views';
import { Explorer } from './Explorer';
import { EXPANDED_KEY } from './sidebar/expansion';
import { rowsForView } from './Sidebar';
import { archivedAskHref } from './useArchivedAsk';
import { archivedIdOf, ARCHIVED_HREF } from './context';
import type { ThisBrowserHost } from './ThisBrowser';

const folder = (id: string, name: string, parentId: string | null = null): Folder => ({
  id,
  name,
  parentId,
  teamId: null,
  ownerId: 'user_me',
  createdAt: 1,
  updatedAt: 1,
});

const local = (extra: Partial<ThisBrowserItem> = {}): ThisBrowserItem => ({
  id: 'local-1',
  title: 'Local 1',
  createdAt: 1_000,
  updatedAt: 2_000,
  lastOpenedAt: null,
  trashedAt: null,
  favourite: false,
  ...extra,
});

function page(
  index: ReturnType<typeof createFakeIndex>,
  view: ExplorerView,
  thisBrowser?: Partial<ThisBrowserHost>,
) {
  const onNavigate = vi.fn();
  const props = {
    app: 'liveplanner' as const,
    client: index.client,
    onNavigate,
    itemHref: (item: { id: string }) => `/project/${item.id}`,
    onCreate: () => {},
    viewerId: 'user_me',
    heroHidden: true,
    thisBrowser: thisBrowser
      ? {
          items: [],
          itemHref: (item: ThisBrowserItem) => `/project/${item.id}`,
          ...thisBrowser,
        }
      : undefined,
  };
  const out = render(<Explorer {...props} view={view} />);
  return {
    onNavigate,
    rerender: (next: ExplorerView) => out.rerender(<Explorer {...props} view={next} />),
  };
}

const sections = () => within(screen.getByRole('navigation', { name: 'Sections' }));
const row = (name: string) => sections().getByRole('treeitem', { name });
const rowNames = (parent: HTMLElement) =>
  [...parent.querySelectorAll(':scope > ul > li')].map((li) => li.getAttribute('data-tree-label'));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('liveworkspace:explorer-view-mode', 'card');
});
afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('the sidebar', () => {
  it('holds Recent, Timeline, Favourites, Archived and the Trash in the Library, in that order', async () => {
    page(createFakeIndex(), { kind: 'archived' });
    const library = await sections().findByRole('treeitem', { name: 'Library' });
    expect(rowNames(library)).toEqual(['Recent', 'Timeline', 'Favourites', 'Archived', 'Trash']);
    expect(row('Archived').getAttribute('aria-current')).toBe('page');
    // Overview keeps Home, Inbox and Shared With Me.
    const overview = row('Home').parentElement!;
    expect([...overview.children].map((li) => li.getAttribute('data-tree-label'))).toEqual([
      'Home',
      'Inbox',
      'Shared With Me',
    ]);
  });

  it('puts the Timeline’s count on the folded Library, and only on the Timeline row once open', async () => {
    const index = createFakeIndex();
    index.inbox.timelineNew = 4;
    page(index, { kind: 'home' });
    const library = await sections().findByRole('treeitem', { name: 'Library (4 new)' });
    fireEvent.click(within(library).getByRole('button', { name: 'Expand Library' }));
    expect(row('Library').getAttribute('aria-expanded')).toBe('true');
    expect(row('Timeline (4 new)')).toBeTruthy();
  });

  it('opens the Library for each of its pages, and a folded one stays folded until the view changes', async () => {
    const { rerender } = page(createFakeIndex(), { kind: 'trash' });
    const library = await sections().findByRole('treeitem', { name: 'Library' });
    expect(library.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(library).getByRole('button', { name: 'Collapse Library' }));
    expect(library.getAttribute('aria-expanded')).toBe('false');
    // The same view, drawn again: no spring back.
    rerender({ kind: 'trash' });
    expect(row('Library').getAttribute('aria-expanded')).toBe('false');
    rerender({ kind: 'archived' });
    expect(row('Library').getAttribute('aria-expanded')).toBe('true');
  });

  it('opens a folder’s space and every folder down to it, and only ever adds', async () => {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([]));
    const index = createFakeIndex({
      folders: [folder('a', 'Alpha'), folder('b', 'Beta', 'a'), folder('c', 'Gamma', 'b')],
    });
    const { rerender } = page(index, { kind: 'folder', id: 'b' });
    await waitFor(() => expect(row('My Work').getAttribute('aria-expanded')).toBe('true'));
    expect(row('Alpha').getAttribute('aria-expanded')).toBe('true');
    expect(row('Beta').getAttribute('aria-expanded')).toBe('true');
    // Its own row shows its children; a sibling elsewhere is left as it was.
    expect(row('Gamma')).toBeTruthy();
    fireEvent.click(within(row('Alpha')).getByRole('button', { name: 'Collapse Alpha' }));
    rerender({ kind: 'folder', id: 'b' });
    expect(row('Alpha').getAttribute('aria-expanded')).toBe('false');
    rerender({ kind: 'home' });
    // Home names no rows: nothing opens or folds.
    expect(row('Alpha').getAttribute('aria-expanded')).toBe('false');
    expect(row('My Work').getAttribute('aria-expanded')).toBe('true');
  });

  it('names the rows each view needs open', () => {
    const byId = new Map([
      ['a', { id: 'a', parentId: null, teamId: null }],
      ['b', { id: 'b', parentId: 'a', teamId: null }],
      ['t', { id: 't', parentId: null, teamId: 'T1' }],
    ]);
    expect(rowsForView({ kind: 'all' }, byId)).toEqual(['my-work']);
    expect(rowsForView({ kind: 'folder', id: 'b' }, byId)).toEqual(['my-work', 'a', 'b']);
    expect(rowsForView({ kind: 'team', id: 'T1' }, byId)).toEqual(['team:T1']);
    expect(rowsForView({ kind: 'team', id: 'T1', folderId: 't' }, byId)).toEqual(['team:T1', 't']);
    for (const kind of ['recent', 'timeline', 'favourites', 'archived', 'trash'] as const)
      expect(rowsForView({ kind }, byId)).toEqual(['library']);
    expect(rowsForView({ kind: 'home' }, byId)).toEqual([]);
    expect(rowsForView({ kind: 'shared' }, byId)).toEqual([]);
  });
});

describe('Move to Archived', () => {
  it('archives one of the person’s own from its menu, and it leaves the list', async () => {
    const index = createFakeIndex({ items: [makeItem(1), makeItem(2)] });
    page(index, { kind: 'all' });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Menu for Item 1' }))[0]!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Move to Archived' }));
    await waitFor(() => expect(index.count('archiveItem')).toBe(1));
    expect(await screen.findByText('Moved “⁨Item 1⁩” to Archived.')).toBeTruthy();
    await waitFor(() => expect(document.querySelector('[data-item-card="item-1"]')).toBeNull());
    expect(document.querySelector('[data-item-card="item-2"]')).toBeTruthy();
  });

  it('is not offered for another’s item, or one reached through a link', async () => {
    const index = createFakeIndex({
      items: [
        makeItem(1, { ownerId: 'user_other', teamId: 'T1' }),
        makeItem(2, { sharedVia: 'ABCD', access: 'edit' }),
      ],
    });
    page(index, { kind: 'search', q: 'Item' });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Menu for Item 1' }))[0]!);
    expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Move to Archived' })).toBeNull();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Menu for Item 2' }))[0]!);
    expect(await screen.findByRole('menuitem', { name: 'Open' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Move to Archived' })).toBeNull();
  });

  it('puts it back where it was asked to go if the index refuses', async () => {
    const index = createFakeIndex({ items: [makeItem(1, { ownerId: 'user_me' })] });
    index.client.archiveItem = () => Promise.reject(new Error('down'));
    page(index, { kind: 'all' });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Menu for Item 1' }))[0]!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Move to Archived' }));
    expect(
      await screen.findByText('Couldn’t move “⁨Item 1⁩” to Archived. Try again.'),
    ).toBeTruthy();
    expect(document.querySelector('[data-item-card="item-1"]')).toBeTruthy();
  });
});

describe('the Archived view', () => {
  it('lists the archived ones alone, closed: a click opens the dialog, not the item', async () => {
    const index = createFakeIndex({
      items: [makeItem(1), makeItem(2, { archivedAt: 5_000 })],
    });
    page(index, { kind: 'archived' });
    await waitFor(() => expect(document.querySelector('[data-item-card="item-2"]')).toBeTruthy());
    expect(document.querySelector('[data-item-card="item-1"]')).toBeNull();
    const link = document.querySelector('[data-item-card="item-2"] a[href]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(`${ARCHIVED_HREF}item-2`);
    const assign = vi.fn();
    fireEvent.click(link);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('“⁨Item 2⁩” is archived')).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change Folder' }));
    // Change Folder opens on the spaces, Archived chosen.
    const move = await screen.findByRole('dialog', { name: 'Move to folder' });
    const archived = within(move).getByRole('button', { name: /Archived/ });
    expect(archived.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(move).getByRole('button', { name: /My Work/ }));
    fireEvent.click(within(move).getByRole('button', { name: 'Move Here' }));
    await waitFor(() =>
      expect(index.calls.find((c) => c.method === 'updateItem')?.args).toEqual([
        'item-2',
        { folderId: null },
      ]),
    );
    expect(await screen.findByText('Moved “⁨Item 2⁩” to ⁨My Work⁩.')).toBeTruthy();
    await waitFor(() => expect(document.querySelector('[data-item-card="item-2"]')).toBeNull());
  });

  it('offers Open, Rename, Change Folder and Delete alone on an archived one', async () => {
    const index = createFakeIndex({ items: [makeItem(2, { archivedAt: 5_000 })] });
    page(index, { kind: 'archived' });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Menu for Item 2' }))[0]!);
    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((m) => m.textContent),
    ).toEqual(['Open', 'Rename', 'Change Folder', 'Delete Plan']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Open' }));
    expect(await screen.findByText('“⁨Item 2⁩” is archived')).toBeTruthy();
  });

  it('says Nothing Archived when it holds nothing', async () => {
    page(createFakeIndex({ items: [makeItem(1)] }), { kind: 'archived' });
    expect(await screen.findByText('Nothing Archived')).toBeTruthy();
  });

  it('opens Change Folder on the one its address names, once, and drops the ask', async () => {
    const index = createFakeIndex({ items: [makeItem(2, { archivedAt: 5_000 })] });
    window.history.replaceState(null, '', archivedAskHref('/explorer/archived', 'move', 'item-2'));
    page(index, { kind: 'archived' });
    expect(await screen.findByRole('dialog', { name: 'Move to folder' })).toBeTruthy();
    expect(window.location.search).toBe('');
  });

  it('asks the index for one its address names past the first page, and only an archived one', async () => {
    const index = createFakeIndex({ items: [makeItem(3)] });
    window.history.replaceState(null, '', archivedAskHref('/explorer/archived', 'open', 'item-3'));
    page(index, { kind: 'archived' });
    await waitFor(() => expect(index.count('getItem')).toBe(1));
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Search', () => {
  it('finds an archived one with its badge, and it stays closed', async () => {
    const index = createFakeIndex({
      items: [makeItem(1), makeItem(2, { archivedAt: 5_000 })],
    });
    page(index, { kind: 'search', q: 'Item' });
    await waitFor(() => expect(document.querySelector('[data-item-card="item-2"]')).toBeTruthy());
    const card = document.querySelector('[data-item-card="item-2"]') as HTMLElement;
    expect(card.querySelector('[data-archived]')?.textContent).toBe('Archived');
    expect(document.querySelector('[data-item-card="item-1"] [data-archived]')).toBeNull();
  });

  it('places an archived one in Archived, and its place chip goes there', async () => {
    const index = createFakeIndex({
      items: [makeItem(2, { archivedAt: 5_000, folderId: 'f1' })],
      folders: [folder('f1', 'Plans')],
    });
    const { onNavigate } = page(index, { kind: 'search', q: 'Item' });
    await waitFor(() => expect(document.querySelector('[data-item-card="item-2"]')).toBeTruthy());
    const card = document.querySelector('[data-item-card="item-2"]') as HTMLElement;
    expect(within(card).queryByTitle('Plans')).toBeNull();
    fireEvent.click(within(card).getByTitle('Archived'));
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'archived' }, '/explorer/archived');
  });

  it('marks an archived link and reads it back', () => {
    expect(archivedIdOf(`${ARCHIVED_HREF}a%2Fb`)).toBe('a/b');
    expect(archivedIdOf('/project/1')).toBeNull();
  });
});

describe('Change Folder', () => {
  it('offers Archived as a space of its own, and choosing it archives', async () => {
    const index = createFakeIndex({ items: [makeItem(1)] });
    page(index, { kind: 'all' });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Menu for Item 1' }))[0]!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Change Folder' }));
    const move = await screen.findByRole('dialog', { name: 'Move to folder' });
    // My Work is open: back to the spaces.
    fireEvent.click(within(move).getByRole('button', { name: /Choose a Space/ }));
    const archived = within(move).getByRole('button', { name: /Archived/ });
    expect(within(archived).getByText('Out of every list, and closed')).toBeTruthy();
    fireEvent.click(archived);
    fireEvent.click(within(move).getByRole('button', { name: 'Move Here' }));
    await waitFor(() => expect(index.count('archiveItem')).toBe(1));
  });
});

describe('Browser Storage', () => {
  it('keeps an archive mark through the app’s own writes, and drops it on the way out', () => {
    writeThisBrowser('liveplanner', [local()]);
    setThisBrowserArchived('liveplanner', 'local-1', 9_000);
    expect(isThisBrowserArchived('liveplanner', 'local-1')).toBe(true);
    // Unchanged, or an id it doesn't hold: nothing written.
    const raw = localStorage.getItem(thisBrowserKey('liveplanner'));
    setThisBrowserArchived('liveplanner', 'local-1', 9_000);
    setThisBrowserArchived('liveplanner', 'nope', 9_000);
    expect(localStorage.getItem(thisBrowserKey('liveplanner'))).toBe(raw);
    // The app republishes its records, which carry no mark.
    writeThisBrowser('liveplanner', [local({ title: 'Renamed' })]);
    expect(readThisBrowser('liveplanner')[0]).toMatchObject({
      title: 'Renamed',
      archivedAt: 9_000,
    });
    setThisBrowserArchived('liveplanner', 'local-1', null);
    expect(isThisBrowserArchived('liveplanner', 'local-1')).toBe(false);
    expect(readThisBrowser('liveplanner')[0]!.archivedAt).toBeUndefined();
  });

  it('lists an archived one in Archived with its pill, closed, and moves it back to This Browser', async () => {
    writeThisBrowser('liveplanner', [local({ archivedAt: 9_000 })]);
    page(createFakeIndex(), { kind: 'archived' }, { items: [local({ archivedAt: 9_000 })] });
    const group = await screen.findByRole('region', { name: 'Browser Storage' });
    expect(group.querySelector('[data-this-browser]')).toBeTruthy();
    expect(screen.queryByText('Nothing Archived')).toBeNull();
    fireEvent.click(within(group).getByRole('button', { name: /^Local 1/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('“⁨Local 1⁩” is archived')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change Folder' }));
    const move = await screen.findByRole('dialog', { name: 'Move to folder' });
    // Not signed in to sync here: This Browser and Archived alone.
    expect(within(move).queryByRole('button', { name: /My Work/ })).toBeNull();
    fireEvent.click(within(move).getByRole('button', { name: /Browser Storage/ }));
    fireEvent.click(within(move).getByRole('button', { name: 'Move Here' }));
    expect(isThisBrowserArchived('liveplanner', 'local-1')).toBe(false);
    expect(await screen.findByText('Moved “⁨Local 1⁩” to Browser Storage.')).toBeTruthy();
  });

  it('renames one archived here in the app’s store and the list, without opening it', async () => {
    const idb = new IDBFactory();
    const { db, store } = APP_ITEMS.liveplanner.offlineStore;
    await new Promise<void>((resolve) => {
      const req = idb.open(db, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(store, { keyPath: 'id' });
      req.onsuccess = () => {
        const tx = req.result.transaction(store, 'readwrite');
        tx.objectStore(store).put({ id: 'local-1', name: 'Local 1', savedAt: 1 });
        tx.oncomplete = () => {
          req.result.close();
          resolve();
        };
      };
    });
    vi.stubGlobal('indexedDB', idb);
    writeThisBrowser('liveplanner', [local({ archivedAt: 9_000 })]);
    page(createFakeIndex(), { kind: 'archived' }, { items: [local({ archivedAt: 9_000 })] });
    const group = await screen.findByRole('region', { name: 'Browser Storage' });
    fireEvent.click(within(group).getByRole('button', { name: 'Rename Local 1' }));
    const input = within(group).getByRole('textbox', { name: 'Rename Local 1' });
    fireEvent.change(input, { target: { value: 'Old Launch Plan' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(readThisBrowser('liveplanner')[0]).toMatchObject({
        title: 'Old Launch Plan',
        archivedAt: 9_000,
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('says so when a rename here can’t reach the app’s store', async () => {
    vi.stubGlobal('indexedDB', undefined);
    writeThisBrowser('liveplanner', [local({ archivedAt: 9_000 })]);
    page(createFakeIndex(), { kind: 'archived' }, { items: [local({ archivedAt: 9_000 })] });
    const group = await screen.findByRole('region', { name: 'Browser Storage' });
    fireEvent.click(within(group).getByRole('button', { name: 'Rename Local 1' }));
    const input = within(group).getByRole('textbox', { name: 'Rename Local 1' });
    fireEvent.change(input, { target: { value: 'Other' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText('Couldn’t rename “⁨Local 1⁩”. Try again.')).toBeTruthy();
    expect(readThisBrowser('liveplanner')[0]!.title).toBe('Local 1');
    vi.unstubAllGlobals();
  });

  it('keeps the name when a rename here is cancelled', async () => {
    writeThisBrowser('liveplanner', [local({ archivedAt: 9_000 })]);
    page(createFakeIndex(), { kind: 'archived' }, { items: [local({ archivedAt: 9_000 })] });
    const group = await screen.findByRole('region', { name: 'Browser Storage' });
    fireEvent.click(within(group).getByRole('button', { name: 'Rename Local 1' }));
    fireEvent.keyDown(within(group).getByRole('textbox', { name: 'Rename Local 1' }), {
      key: 'Escape',
    });
    expect(within(group).getByRole('button', { name: /^Local 1/ })).toBeTruthy();
    expect(readThisBrowser('liveplanner')[0]!.title).toBe('Local 1');
  });

  it('still lists those archived here when the account’s list can’t load', async () => {
    writeThisBrowser('liveplanner', [local({ archivedAt: 9_000 })]);
    const index = createFakeIndex();
    index.fail.set('listItems', new IndexError(500, 'unknown'));
    page(index, { kind: 'archived' }, { items: [local({ archivedAt: 9_000 })] });
    expect(await screen.findByText(/Couldn’t load this list/)).toBeTruthy();
    expect(await screen.findByRole('region', { name: 'Browser Storage' })).toBeTruthy();
  });

  it('syncs one into the account from Change Folder, its mark cleared first', async () => {
    writeThisBrowser('liveplanner', [local({ archivedAt: 9_000 })]);
    const index = createFakeIndex({ folders: [folder('f1', 'Specs')] });
    const sync = vi.fn(async () => {
      index.items.push(makeItem(9, { id: 'local-1', title: 'Local 1' }));
    });
    page(index, { kind: 'archived' }, { items: [local({ archivedAt: 9_000 })], sync });
    const group = await screen.findByRole('region', { name: 'Browser Storage' });
    fireEvent.click(within(group).getByRole('button', { name: 'Change Folder: Local 1' }));
    const move = await screen.findByRole('dialog', { name: 'Move to folder' });
    fireEvent.click(within(move).getByRole('button', { name: /My Work/ }));
    fireEvent.click(within(move).getByRole('button', { name: 'Move Here' }));
    const confirm = await screen.findByRole('dialog', { name: /Sync/ });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Sync and Move' }));
    expect(isThisBrowserArchived('liveplanner', 'local-1')).toBe(false);
    await waitFor(() => expect(sync).toHaveBeenCalled());
  });

  it('archives a live one from This Browser, and it leaves the list there', async () => {
    writeThisBrowser('liveplanner', [local()]);
    page(createFakeIndex(), { kind: 'offline' }, { items: [local()] });
    fireEvent.click(await screen.findByRole('button', { name: 'Move to Archived: Local 1' }));
    expect(isThisBrowserArchived('liveplanner', 'local-1')).toBe(true);
    expect(await screen.findByText('Moved “⁨Local 1⁩” to Archived.')).toBeTruthy();
  });

  it('leaves an archived one out of This Browser and its Trash group', async () => {
    page(
      createFakeIndex(),
      { kind: 'offline' },
      {
        items: [
          local({ archivedAt: 9_000 }),
          local({ id: 'local-2', title: 'Local 2' }),
          local({ id: 'local-3', title: 'Gone', trashedAt: 5, archivedAt: 9 }),
        ],
      },
    );
    expect(await screen.findByText('Local 2')).toBeTruthy();
    expect(screen.queryByText('Local 1')).toBeNull();
    expect(row('Browser Storage (1 in Browser Storage)')).toBeTruthy();
  });
});
