// This Browser as a Space (liveworkspace/docs/specs/004-index/one-explorer.md "This Browser, a Space"): its row in the
// sidebar's Spaces group only while it holds something, its local folders (made, renamed, moved, deleted, nested),
// items moved in and out by the menu and by a drop, the view's back bar and folder cards, Sync keeping an item's
// place (in place, and the page's note), Home's tile and the phone's drawer. The host's items are read live from
// this browser's list, as every host's are (useThisBrowserList).
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Folder } from '@liveworkspace/index-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex, makeItem, type FakeIndex } from '../test/fakeClient';
import {
  createThisBrowserFolder,
  noteSyncPlace,
  readSyncPlaces,
  readThisBrowserStore,
  writeThisBrowserStore,
  type ThisBrowserFolder,
  type ThisBrowserItem,
} from '../this-browser';
import type { ExplorerView } from '../views';
import { Explorer } from './Explorer';
import { useThisBrowserList, type ThisBrowserHost } from './ThisBrowser';
import { panelSectionGroups } from '../panel/sections';
import { sameNameFolder } from './this-browser-space/space';

const APP = 'liveplanner' as const;

const local = (n: number, extra: Partial<ThisBrowserItem> = {}): ThisBrowserItem => ({
  id: `item-${n}`,
  title: `Local ${n}`,
  createdAt: 1_000 + n,
  updatedAt: 2_000 + n,
  lastOpenedAt: null,
  trashedAt: null,
  favourite: false,
  ...extra,
});

const lf = (id: string, name: string, parentId: string | null = null): ThisBrowserFolder => ({
  id,
  name,
  parentId,
  createdAt: 1,
  updatedAt: 1,
});

const acct = (id: string, name: string, parentId: string | null = null): Folder => ({
  id,
  name,
  parentId,
  teamId: null,
  ownerId: 'user_me',
  createdAt: 1,
  updatedAt: 1,
});

type HostBits = Omit<ThisBrowserHost, 'items' | 'itemHref'>;

/** The Explorer with a host that reads this browser's list as it changes, as every app's does. */
function Live({
  index,
  view,
  onNavigate,
  bits,
}: {
  index: FakeIndex;
  view: ExplorerView;
  onNavigate: (v: ExplorerView) => void;
  bits: HostBits | null;
}) {
  const items = useThisBrowserList(bits ? APP : null);
  return (
    <Explorer
      app={APP}
      client={index.client}
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

function page(
  view: ExplorerView,
  { index = createFakeIndex(), bits = {} }: { index?: FakeIndex; bits?: HostBits | null } = {},
) {
  const onNavigate = vi.fn();
  const out = render(<Live index={index} view={view} onNavigate={onNavigate} bits={bits} />);
  return {
    onNavigate,
    index,
    rerender: (next: ExplorerView) =>
      out.rerender(<Live index={index} view={next} onNavigate={onNavigate} bits={bits} />),
  };
}

const sections = () => within(screen.getByRole('navigation', { name: 'Sections' }));
const spaces = () => within(sections().getByRole('tree', { name: 'Spaces' }));
const browserRow = () => spaces().queryByRole('treeitem', { name: /^Browser Storage/ });

/** The element once it is there (waitFor retries only on a throw). */
async function found(selector: string): Promise<HTMLElement> {
  return waitFor(() => {
    const el = document.querySelector<HTMLElement>(selector);
    expect(el).toBeTruthy();
    return el!;
  });
}

function transfer() {
  const data = new Map<string, string>();
  return {
    get types() {
      return [...data.keys()];
    },
    setData: (type: string, value: string) => void data.set(type, value),
    getData: (type: string) => data.get(type) ?? '',
    effectAllowed: 'all',
    dropEffect: 'none',
  };
}

function dragOnto(source: Element, target: Element) {
  const dt = transfer();
  fireEvent.dragStart(source, { dataTransfer: dt });
  fireEvent.dragEnter(target, { dataTransfer: dt });
  fireEvent.dragOver(target, { dataTransfer: dt });
  fireEvent.drop(target, { dataTransfer: dt });
  fireEvent.dragEnd(source, { dataTransfer: dt });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('liveworkspace:explorer-view-mode', 'card');
});
afterEach(cleanup);

describe('the Space in the sidebar', () => {
  it('shows in Spaces only while this browser holds something, and goes when it empties', async () => {
    page({ kind: 'all' });
    await screen.findByRole('navigation', { name: 'Sections' });
    expect(browserRow()).toBeNull();
    act(() => writeThisBrowserStore(APP, { items: [local(1)], folders: [] }));
    const row = await waitFor(() => {
      const found = browserRow();
      expect(found).toBeTruthy();
      return found!;
    });
    expect(row.getAttribute('aria-label')).toBe('Browser Storage (1 in Browser Storage)');
    // After My Work, in the Spaces group, not under More.
    const labels = [...spaces().getAllByRole('treeitem')].map((r) =>
      r.getAttribute('data-tree-label'),
    );
    expect(labels.indexOf('Browser Storage')).toBeGreaterThan(labels.indexOf('My Work'));
    expect(
      within(screen.getByRole('tree', { name: 'More' })).queryByRole('treeitem', {
        name: /Browser Storage/,
      }),
    ).toBeNull();
    act(() => writeThisBrowserStore(APP, { items: [], folders: [] }));
    await waitFor(() => expect(browserRow()).toBeNull());
  });

  it('shows for a folder alone, with no count, and never without a host (liveworkspace.app)', async () => {
    writeThisBrowserStore(APP, { items: [], folders: [lf('a', 'Trips')] });
    page({ kind: 'all' });
    await waitFor(() => expect(browserRow()?.getAttribute('aria-label')).toBe('Browser Storage'));
    cleanup();
    page({ kind: 'all' }, { bits: null });
    await screen.findByRole('navigation', { name: 'Sections' });
    expect(browserRow()).toBeNull();
  });

  it('stays while its view is open and empty, saying so with the way back', async () => {
    const { onNavigate } = page({ kind: 'offline' });
    expect(await screen.findByText('Nothing is kept in Browser Storage.')).toBeTruthy();
    expect(browserRow()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Go to My Work' }));
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'all' }, expect.anything());
  });

  it('lists its folders nested, opens the current one, and goes to each', async () => {
    writeThisBrowserStore(APP, {
      items: [local(1, { folderId: 'b' })],
      folders: [lf('a', 'Trips'), lf('b', 'Rome', 'a')],
    });
    const { onNavigate } = page({ kind: 'offline', folder: 'b' });
    const rome = await waitFor(() => spaces().getByRole('treeitem', { name: 'Rome' }));
    expect(rome.getAttribute('aria-selected')).toBe('true');
    expect(rome.getAttribute('aria-level')).toBe('3');
    fireEvent.click(within(spaces().getByRole('treeitem', { name: 'Trips' })).getByText('Trips'));
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'offline', folder: 'a' }, expect.anything());
  });

  it('makes a folder from its menu, named in the row', async () => {
    writeThisBrowserStore(APP, { items: [local(1)], folders: [] });
    page({ kind: 'all' });
    const row = await waitFor(() => browserRow()!);
    fireEvent.click(within(row).getByRole('button', { name: 'Menu for Browser Storage' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'New Folder' }));
    const field = await screen.findByRole('textbox', { name: 'Rename New Folder' });
    fireEvent.change(field, { target: { value: 'Ideas' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() =>
      expect(readThisBrowserStore(APP).folders.map((f) => f.name)).toEqual(['Ideas']),
    );
    expect(await waitFor(() => spaces().getByRole('treeitem', { name: 'Ideas' }))).toBeTruthy();
  });

  it('takes an item dropped on a folder row, with an Undo', async () => {
    writeThisBrowserStore(APP, { items: [local(1)], folders: [lf('a', 'Trips')] });
    page({ kind: 'offline' });
    const source = (await screen.findByText('Local 1')).closest('li')!;
    const target = await waitFor(() =>
      spaces().getByRole('treeitem', { name: 'Trips' }).querySelector('[data-tree-row]')!,
    );
    dragOnto(source, target);
    await waitFor(() => expect(readThisBrowserStore(APP).items[0]?.folderId).toBe('a'));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(readThisBrowserStore(APP).items[0]?.folderId).toBeUndefined());
  });
});

describe('the view', () => {
  it('shows the folders here as cards, then the items here, and opens a folder under its back bar', async () => {
    writeThisBrowserStore(APP, {
      items: [local(1), local(2, { folderId: 'a' }), local(3, { folderId: 'b' })],
      folders: [lf('a', 'Trips'), lf('b', 'Rome', 'a')],
    });
    const { onNavigate, rerender } = page({ kind: 'offline' });
    const card = await found('[data-local-folder-card="a"]');
    expect(within(card).getByText('Trips')).toBeTruthy();
    expect(screen.getByText('Local 1')).toBeTruthy();
    expect(screen.queryByText('Local 2')).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'Open Trips' }));
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'offline', folder: 'a' }, expect.anything());
    rerender({ kind: 'offline', folder: 'b' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Rome' })).toBeTruthy();
    expect(screen.getByText('Local 3')).toBeTruthy();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    fireEvent.click(within(crumbs).getByRole('button', { name: /Trips/ }));
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'offline', folder: 'a' }, expect.anything());
  });

  it('shows the root for a folder that is not there', async () => {
    writeThisBrowserStore(APP, { items: [local(1)], folders: [] });
    page({ kind: 'offline', folder: 'gone' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Browser Storage' })).toBeTruthy();
    expect(screen.getByText('Local 1')).toBeTruthy();
  });

  it('narrows the folders by name and the items by the lens', async () => {
    writeThisBrowserStore(APP, {
      items: [local(1), local(2)],
      folders: [lf('a', 'Trips'), lf('b', 'Work')],
    });
    page({ kind: 'offline', q: 'trip' });
    await waitFor(() =>
      expect(document.querySelector('[data-local-folder-card="a"]')).toBeTruthy(),
    );
    expect(document.querySelector('[data-local-folder-card="b"]')).toBeNull();
    expect(screen.queryByText('Local 1')).toBeNull();
  });

  it('makes a folder from New Folder, named on its card', async () => {
    writeThisBrowserStore(APP, { items: [local(1)], folders: [lf('a', 'Trips')] });
    page({ kind: 'offline', folder: 'a' });
    fireEvent.click(await screen.findByRole('button', { name: 'New Folder' }));
    const field = await screen.findByRole('textbox', { name: 'Rename New Folder' });
    fireEvent.change(field, { target: { value: 'Day One' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() =>
      expect(readThisBrowserStore(APP).folders.find((f) => f.name === 'Day One')?.parentId).toBe(
        'a',
      ),
    );
  });

  it('says an empty folder is empty, and Delete Folder asks, moves up and leaves for the parent', async () => {
    writeThisBrowserStore(APP, {
      items: [local(1)],
      folders: [lf('a', 'Trips'), lf('b', 'Rome', 'a')],
    });
    const { onNavigate } = page({ kind: 'offline', folder: 'b' });
    expect(await screen.findByText('This folder is empty.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Folder' }));
    const ask = await screen.findByRole('dialog', { name: 'Delete “Rome”?' });
    expect(
      within(ask).getByText('Its folders and items move up to Trips. Nothing in it is deleted.'),
    ).toBeTruthy();
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete Folder' }));
    await waitFor(() => expect(readThisBrowserStore(APP).folders.map((f) => f.id)).toEqual(['a']));
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'offline', folder: 'a' }, expect.anything());
  });

  it('renames and moves a folder from its card menu, never below itself', async () => {
    writeThisBrowserStore(APP, {
      items: [local(1)],
      folders: [lf('a', 'Trips'), lf('b', 'Work'), lf('c', 'Rome', 'a')],
    });
    page({ kind: 'offline' });
    const card = await found('[data-local-folder-card="a"]');
    fireEvent.click(within(card).getByRole('button', { name: 'Menu for Trips' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    const field = await screen.findByRole('textbox', { name: 'Rename Trips' });
    fireEvent.change(field, { target: { value: 'Travel' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() =>
      expect(readThisBrowserStore(APP).folders.find((f) => f.id === 'a')?.name).toBe('Travel'),
    );
    const again = document.querySelector('[data-local-folder-card="a"]') as HTMLElement;
    fireEvent.click(within(again).getByRole('button', { name: 'Menu for Travel' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Move Folder' }));
    const move = await screen.findByRole('dialog', { name: 'Move to folder' });
    // Its own subfolder is no destination.
    expect(within(move).queryByText('Rome')).toBeNull();
    fireEvent.click(within(move).getByRole('button', { name: /Work/ }));
    fireEvent.click(within(move).getByRole('button', { name: 'Move Here' }));
    await waitFor(() =>
      expect(readThisBrowserStore(APP).folders.find((f) => f.id === 'a')?.parentId).toBe('b'),
    );
  });

  it('moves an item into a folder from Move to Folder', async () => {
    writeThisBrowserStore(APP, { items: [local(1)], folders: [lf('a', 'Trips')] });
    page({ kind: 'offline' });
    fireEvent.click(await screen.findByRole('button', { name: 'Move to Folder: Local 1' }));
    const move = await screen.findByRole('dialog', { name: 'Move to folder' });
    expect(within(move).getByText('Pick a folder in Browser Storage.')).toBeTruthy();
    fireEvent.click(within(move).getByRole('button', { name: /Trips/ }));
    fireEvent.click(within(move).getByRole('button', { name: 'Move Here' }));
    await waitFor(() => expect(readThisBrowserStore(APP).items[0]?.folderId).toBe('a'));
    expect(await screen.findByText('Moved “⁨Local 1⁩” to Trips.')).toBeTruthy();
  });

  it('drops an item on a folder card', async () => {
    writeThisBrowserStore(APP, { items: [local(1)], folders: [lf('a', 'Trips')] });
    page({ kind: 'offline' });
    const source = (await screen.findByText('Local 1')).closest('li')!;
    const card = await found('[data-local-folder-card="a"]');
    dragOnto(source, card);
    await waitFor(() => expect(readThisBrowserStore(APP).items[0]?.folderId).toBe('a'));
  });
});

describe('Sync keeps its place', () => {
  it('finds the account folder of the same name, the shallowest first', () => {
    const tree = [acct('deep', 'Trips', 'p'), acct('p', 'Parent'), acct('top', 'trips ')];
    expect(sameNameFolder(tree, 'TRIPS')?.id).toBe('top');
    expect(sameNameFolder(tree, 'None')).toBeNull();
    expect(sameNameFolder(tree, '  ')).toBeNull();
    expect(sameNameFolder([{ ...acct('t', 'Trips'), teamId: 'team-1' }], 'Trips')).toBeNull();
  });

  it('in place: syncs an item in a local folder and moves it into the same-named folder', async () => {
    writeThisBrowserStore(APP, {
      items: [local(1, { folderId: 'a' })],
      folders: [lf('a', 'Trips')],
    });
    const index = createFakeIndex({ folders: [acct('acct-trips', 'Trips')] });
    const sync = vi.fn(async () => {
      index.items.push(makeItem(9, { id: 'item-1', title: 'Local 1' }));
    });
    page({ kind: 'offline', folder: 'a' }, { index, bits: { sync } });
    fireEvent.click(await screen.findByRole('button', { name: 'Sync Plan: Local 1' }));
    const ask = await screen.findByRole('dialog', { name: /Sync/ });
    expect(within(ask).getByText(/To go into Trips/)).toBeTruthy();
    fireEvent.click(within(ask).getByRole('button', { name: 'Sync and Move' }));
    await waitFor(() => expect(sync).toHaveBeenCalled());
    await waitFor(() =>
      expect(index.items.find((i) => i.id === 'item-1')?.folderId).toBe('acct-trips'),
    );
  });

  it('in place: one at the root syncs at once, as before', async () => {
    writeThisBrowserStore(APP, { items: [local(1)], folders: [] });
    const sync = vi.fn(async () => {});
    page({ kind: 'offline' }, { bits: { sync } });
    fireEvent.click(await screen.findByRole('button', { name: 'Sync Plan: Local 1' }));
    await waitFor(() => expect(sync).toHaveBeenCalled());
    expect(screen.queryByRole('dialog', { name: /Sync/ })).toBeNull();
  });

  it('on the page: notes the place before handing over, and keeps a folder whose last item leaves', async () => {
    writeThisBrowserStore(APP, {
      items: [local(1, { folderId: 'a' })],
      folders: [lf('a', 'Trips')],
    });
    const index = createFakeIndex({ folders: [acct('acct-trips', 'Trips')] });
    const assign = vi.fn();
    const was = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...was, assign, search: '' },
      configurable: true,
    });
    try {
      page(
        { kind: 'offline', folder: 'a' },
        { index, bits: { syncHref: (item) => `/project/${item.id}?convert=sync` } },
      );
      fireEvent.click(await screen.findByRole('button', { name: 'Sync Plan: Local 1' }));
      const ask = await screen.findByRole('dialog', { name: /Sync/ });
      expect(within(ask).getByText(/the next time you’re here/)).toBeTruthy();
      fireEvent.click(within(ask).getByRole('button', { name: 'Sync Plan' }));
      expect(assign).toHaveBeenCalledWith('/project/item-1?convert=sync');
      expect(readSyncPlaces(APP)).toEqual([
        expect.objectContaining({ id: 'item-1', folderId: 'acct-trips', teamId: null }),
      ]);
    } finally {
      Object.defineProperty(window, 'location', { value: was, configurable: true });
    }
  });

  it('on the next load: moves a synced item to its noted place, once', async () => {
    noteSyncPlace(APP, 'item-1', { teamId: null, folderId: 'acct-trips' });
    // A note for a folder that is gone is dropped; one whose item is still here waits.
    noteSyncPlace(APP, 'item-2', { teamId: null, folderId: 'acct-gone' });
    noteSyncPlace(APP, 'item-3', { teamId: null, folderId: 'acct-trips' });
    writeThisBrowserStore(APP, { items: [local(3)], folders: [lf('a', 'Trips')] });
    const index = createFakeIndex({
      folders: [acct('acct-trips', 'Trips')],
      items: [makeItem(1, { id: 'item-1', title: 'Local 1' })],
    });
    page({ kind: 'all' }, { index });
    await waitFor(() =>
      expect(index.items.find((i) => i.id === 'item-1')?.folderId).toBe('acct-trips'),
    );
    expect(readSyncPlaces(APP).map((p) => p.id)).toEqual(['item-3']);
    // The emptied folder stays.
    expect(readThisBrowserStore(APP).folders.map((f) => f.id)).toEqual(['a']);
  });
});

describe('Home and the phone', () => {
  it('has a This Browser tile after the teams while it holds anything', async () => {
    writeThisBrowserStore(APP, {
      items: [local(1), local(2), local(3), local(4), local(5)],
      folders: [],
    });
    const { onNavigate } = page({ kind: 'home' });
    const tile = await found('[data-space-tile="this-browser"]');
    expect(tile.getAttribute('aria-label')).toBe('Browser Storage');
    expect(tile.textContent).toContain('5 plans');
    expect(tile.textContent).toContain('+2');
    fireEvent.click(tile);
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'offline' }, expect.anything());
  });

  it('has no tile while empty', async () => {
    page({ kind: 'home' });
    await waitFor(() => expect(document.querySelector('[data-space-tile="mine"]')).toBeTruthy());
    expect(document.querySelector('[data-space-tile="this-browser"]')).toBeNull();
  });

  it('names a local folder on the sections bar, and lists the Space in the drawer', async () => {
    writeThisBrowserStore(APP, { items: [local(1)], folders: [lf('a', 'Trips')] });
    page({ kind: 'offline', folder: 'a' });
    const bar = await screen.findByRole('button', { name: 'Open Menu, Current: Trips' });
    fireEvent.click(bar);
    const drawer = await screen.findByRole('dialog', { name: 'Menu' });
    expect(
      within(drawer).getAllByRole('treeitem', { name: /^Browser Storage/ }).length,
    ).toBeGreaterThan(0);
  });

  it("puts This Browser last among the panel rail's spaces", () => {
    const groups = panelSectionGroups([{ id: 't1', name: 'Team' }], { thisBrowser: true });
    expect(groups[1]!.sections.map((s) => s.kind)).toEqual(['mine', 'team', 'offline']);
    expect(groups[2]!.sections.some((s) => s.kind === 'offline')).toBe(false);
  });

  it('makes local folders through the store helper the menus use', () => {
    expect(createThisBrowserFolder(APP, 'A', null)?.name).toBe('A');
  });
});
