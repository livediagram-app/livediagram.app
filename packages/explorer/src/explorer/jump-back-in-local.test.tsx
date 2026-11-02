// An item kept only in this browser among Home's Jump Back In (liveworkspace/docs/specs/004-index/one-explorer.md "This Browser in
// Jump Back In"): the same card as the index's, with This Browser's menu, and a drag each target reads as This
// Browser's (the Trash deletes it for good after asking where the host can; a place asks to sync it first).
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Folder } from '@liveworkspace/index-client';
import { THIS_BROWSER_DRAG_MIME } from '../drag/drag';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import type { ThisBrowserItem } from '../this-browser';
import { Explorer } from './Explorer';
import type { ThisBrowserHost } from './ThisBrowser';

const local = (extra: Partial<ThisBrowserItem> = {}): ThisBrowserItem => ({
  id: 'local-1',
  title: 'Local 1',
  createdAt: 1_000,
  updatedAt: 2_000,
  lastOpenedAt: Date.now() - 60_000,
  trashedAt: null,
  favourite: false,
  ...extra,
});

const specs: Folder = {
  id: 'f1',
  name: 'Specs',
  parentId: null,
  teamId: null,
  ownerId: 'user_me',
  createdAt: 1,
  updatedAt: 1,
};

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
  return dt;
}

function home(thisBrowser: Partial<ThisBrowserHost>, index = createFakeIndex()) {
  render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'home' }}
      onNavigate={() => {}}
      itemHref={(item) => `/project/${item.id}`}
      onCreate={() => {}}
      viewerId="user_me"
      heroHidden
      thisBrowser={{
        items: [local()],
        itemHref: (item) => `/project/${item.id}`,
        helpHref: '/help/offline/',
        ...thisBrowser,
      }}
    />,
  );
  return index;
}

const card = async (id = 'local-1') => {
  await waitFor(() => expect(document.querySelector(`[data-item-card="${id}"]`)).toBeTruthy());
  return document.querySelector(`[data-item-card="${id}"]`) as HTMLElement;
};
const sidebar = () => within(screen.getByRole('navigation', { name: 'Sections' }));
const rowOf = (name: string) =>
  sidebar().getByRole('treeitem', { name }).firstElementChild as HTMLElement;
const findRow = async (name: string) =>
  (await sidebar().findByRole('treeitem', { name })).firstElementChild as HTMLElement;

afterEach(() => localStorage.clear());

describe('a This Browser card in Jump Back In', () => {
  it('is the same card as the index’s: its frame, a thumbnail area, its name and a line with the badge', async () => {
    home({}, createFakeIndex({ items: [makeItem(1, { lastOpenedAt: Date.now() - 120_000 })] }));
    const mine = await card();
    const theirs = await card('item-1');
    const link = (el: HTMLElement) => el.querySelector('a[aria-label]') as HTMLElement;
    expect(link(mine).className).toBe(link(theirs).className);
    expect(mine.parentElement!.closest('[data-jump-back-in-group]')).toBe(
      theirs.parentElement!.closest('[data-jump-back-in-group]'),
    );
    expect(link(mine).getAttribute('href')).toBe('/project/local-1');
    expect(mine.querySelector('[data-this-browser]')).toBeTruthy();
    expect(mine.textContent).toContain('Opened');
    expect(mine.getAttribute('draggable')).toBe('true');
    // Its picture is the browser it lives in, in its own app's accent, not the badge's tone.
    const preview = mine.querySelector<HTMLElement>('[data-local-preview]')!;
    expect(preview.getAttribute('data-local-preview')).toBe('liveplanner');
    expect(preview.style.getPropertyValue('--local-accent')).toBe('#8b5cf6');
  });

  it('opens This Browser’s menu from ⋯ and a right-click: Open and Sync, no Delete where the page can’t', async () => {
    const assign = vi.fn();
    const real = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...real, assign },
    });
    try {
      home({ syncHref: (item) => `/project/${item.id}?convert=sync&item=${item.id}` });
      const mine = await card();
      fireEvent.click(within(mine).getByRole('button', { name: 'Menu for Local 1' }));
      const menu = await screen.findByRole('menu', { name: 'Actions for Local 1' });
      expect(within(menu).queryByRole('menuitem', { name: /Delete/ })).toBeNull();
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sync Plan' }));
      expect(assign).toHaveBeenCalledWith('/project/local-1?convert=sync&item=local-1');
      fireEvent.contextMenu(mine);
      expect(
        within(await screen.findByRole('menu', { name: 'Actions for Local 1' })).getByRole(
          'menuitem',
          { name: 'Open' },
        ),
      ).toBeTruthy();
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: real });
    }
  });

  it('deletes for good from its menu where the host can, after asking', async () => {
    const remove = vi.fn();
    home({ remove });
    fireEvent.contextMenu(await card());
    const menu = await screen.findByRole('menu', { name: 'Actions for Local 1' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Delete Plan' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Delete this plan from this browser?',
    });
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'local-1' }));
  });
});

describe('dragging a This Browser card', () => {
  it('asks before deleting it for good when dropped on the Trash', async () => {
    const remove = vi.fn();
    const index = home({ remove });
    const dt = dragOnto(await card(), rowOf('Trash'));
    expect(dt.types).toEqual([THIS_BROWSER_DRAG_MIME]);
    const dialog = await screen.findByRole('dialog', {
      name: 'Delete this plan from this browser?',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(remove).toHaveBeenCalledTimes(1);
    // The index never held it: nothing goes to its Trash.
    expect(index.count('deleteItem')).toBe(0);
  });

  it('says to open it when the Trash can’t delete it here', async () => {
    home({});
    dragOnto(await card(), rowOf('Trash'));
    expect(
      await screen.findByText(
        '“\u2068Local 1\u2069” is kept only in this browser. Open it to delete it.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks to sync it first when dropped on a folder, and hands over to the editor on the page', async () => {
    const assign = vi.fn();
    const real = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...real, assign } });
    try {
      const index = home(
        { syncHref: (item) => `/project/${item.id}?convert=sync&item=${item.id}` },
        createFakeIndex({ folders: [specs] }),
      );
      dragOnto(await card(), await findRow('Specs'));
      const dialog = await screen.findByRole('dialog', {
        name: 'Sync “\u2068Local 1\u2069” to your account?',
      });
      expect(dialog.textContent).toContain('Specs');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Sync Plan' }));
      expect(assign).toHaveBeenCalledWith('/project/local-1?convert=sync&item=local-1');
      expect(index.count('updateItem')).toBe(0);
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: real });
    }
  });

  it('syncs it in place and then moves it into the folder where the host syncs', async () => {
    // Once synced it is the index's, under the same id.
    const index = createFakeIndex({
      folders: [specs],
      items: [makeItem(9, { id: 'local-1', lastOpenedAt: null })],
    });
    const sync = vi.fn(() => Promise.resolve());
    home({ sync }, index);
    dragOnto(await card(), await findRow('Specs'));
    const dialog = await screen.findByRole('dialog', {
      name: 'Sync “\u2068Local 1\u2069” to your account?',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sync and Move' }));
    expect(sync).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(index.calls.find((c) => c.method === 'updateItem')?.args).toEqual([
        'local-1',
        { folderId: 'f1' },
      ]),
    );
  });

  it('says to sign in and sync it first where it can’t be synced', async () => {
    const index = home({}, createFakeIndex({ folders: [specs] }));
    dragOnto(await card(), await findRow('Specs'));
    expect(
      await screen.findByText(
        '“\u2068Local 1\u2069” is kept only in this browser. Sign in and sync it to your account to put it in a folder.',
      ),
    ).toBeTruthy();
    expect(index.count('updateItem')).toBe(0);
  });
});
