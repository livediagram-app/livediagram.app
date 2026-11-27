// The sidebar tree (liveplanner/docs/specs/013-workspace/explorer-structure.md): folder rows' and My Work's menus (⋯,
// right-click, Shift+F10), rename in place, a new folder opening its parent, expansion read before the first paint,
// and the keyboard tree (one tab stop, arrows, Home/End, Left/Right, type-ahead, a real chevron).
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { Folder } from '@liveworkspace/index-client';
import { createFakeIndex } from '../test/fakeClient';
import type { ExplorerView } from '../views';
import { Explorer } from './Explorer';
import { EXPANDED_KEY, createExpansion, rowsAbove } from './sidebar/expansion';
import { spaceOfView } from './Sidebar';

const folder = (
  id: string,
  name: string,
  parentId: string | null = null,
  teamId: string | null = null,
): Folder => ({
  id,
  name,
  parentId,
  teamId,
  ownerId: 'user_me',
  createdAt: 1,
  updatedAt: 1,
});

function page(
  index: ReturnType<typeof createFakeIndex>,
  view: ExplorerView = { kind: 'all' },
  teams?: { id: string; name: string }[],
) {
  const onNavigate = vi.fn();
  render(
    <Explorer
      app="liveplanner"
      teams={teams}
      client={index.client}
      view={view}
      onNavigate={onNavigate}
      itemHref={(item) => `/plan/${item.id}`}
      onCreate={() => {}}
      viewerId="user_me"
      heroHidden
    />,
  );
  return onNavigate;
}

const nav = () => screen.getByRole('navigation', { name: 'Sections' });
const row = (name: string) => within(nav()).getByRole('treeitem', { name });
const findRow = (name: string) => within(nav()).findByRole('treeitem', { name });
const key = (el: Element, k: string, extra: object = {}) =>
  fireEvent.keyDown(el, { key: k, ...extra });

// The person opened My Work before (a space opens only when the person does it, Work Tracker 1420).
const myWorkOpened = () => {
  localStorage.clear();
  localStorage.setItem(EXPANDED_KEY, JSON.stringify(['my-work']));
};

describe('the sidebar’s menus and rename', () => {
  beforeEach(myWorkOpened);

  it('opens a folder row’s menu from its ⋯, a right-click and Shift+F10', async () => {
    const index = createFakeIndex({ folders: [folder('f1', 'Projects')] });
    page(index);
    const projects = await findRow('Projects');
    fireEvent.click(within(projects).getByRole('button', { name: 'Menu for Projects' }));
    expect(await screen.findByRole('menuitem', { name: 'New Subfolder' })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBeNull());

    fireEvent.contextMenu(projects);
    expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBeNull());

    act(() => projects.focus());
    key(projects, 'F10', { shiftKey: true });
    expect(await screen.findByRole('menuitem', { name: 'Move Folder' })).toBeTruthy();
  });

  it('says a folder moves within its space when teams exist, heading the list with the space', async () => {
    const index = createFakeIndex({ folders: [folder('f1', 'Projects')] });
    page(index, { kind: 'all' }, [{ id: 't1', name: 'Design' }]);
    fireEvent.contextMenu(await findRow('Projects'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Move Folder' }));
    const dialog = await screen.findByRole('dialog', { name: 'Move to folder' });
    expect(dialog.textContent).toContain(
      'Folders move within their space. Pick where in My Work it should live.',
    );
    expect(within(dialog).queryByText('Choose a Space')).toBeNull();
  });

  it('keeps the plain line when there are no teams', async () => {
    const index = createFakeIndex({ folders: [folder('f1', 'Projects')] });
    page(index);
    fireEvent.contextMenu(await findRow('Projects'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Move Folder' }));
    const dialog = await screen.findByRole('dialog', { name: 'Move to folder' });
    expect(dialog.textContent).toContain('Pick the folder it should live inside.');
  });

  it('renames a folder in its own row', async () => {
    const index = createFakeIndex({ folders: [folder('f1', 'Projects')] });
    page(index);
    fireEvent.contextMenu(await findRow('Projects'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    const field = within(nav()).getByRole('textbox', { name: 'Rename Projects' });
    fireEvent.change(field, { target: { value: 'Work' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(await findRow('Work')).toBeTruthy();
    expect(index.calls.some((c) => c.method === 'updateFolder' && c.args[0] === 'f1')).toBe(true);
  });

  it('opens the parent of a new subfolder and names it in place', async () => {
    const index = createFakeIndex({ folders: [folder('f1', 'Projects')] });
    page(index);
    fireEvent.contextMenu(await findRow('Projects'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'New Subfolder' }));
    const field = await within(nav()).findByRole('textbox', { name: 'Rename New Folder' });
    expect(row('Projects').getAttribute('aria-expanded')).toBe('true');
    fireEvent.change(field, { target: { value: 'Q3' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(await findRow('Q3')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? '[]')).toContain('f1');
  });

  it('offers New Subfolder from an empty folder’s New, as its copy promises', async () => {
    const index = createFakeIndex({ folders: [folder('f1', 'Projects')] });
    page(index, { kind: 'folder', id: 'f1' });
    expect(await screen.findByText('This folder is empty')).toBeTruthy();
    const pane = document.querySelector('[data-explorer-view="folder"]')!;
    const newButton = within(pane as HTMLElement).getByRole('button', { name: 'New' });
    expect(newButton.getAttribute('aria-haspopup')).toBe('menu');
    fireEvent.click(newButton);
    const menu = await screen.findByRole('menu', { name: 'New' });
    expect(within(menu).getByRole('menuitem', { name: 'New Plan' })).toBeTruthy();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'New Subfolder' }));
    await waitFor(() =>
      expect(index.calls.find((c) => c.method === 'createFolder')?.args[0]).toMatchObject({
        parentId: 'f1',
        teamId: null,
      }),
    );
  });

  it('gives My Work a menu: Open, and New Folder at its root', async () => {
    const index = createFakeIndex();
    const onNavigate = page(index, { kind: 'home' });
    fireEvent.contextMenu(await findRow('My Work'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'New Folder' }));
    const field = await within(nav()).findByRole('textbox', { name: 'Rename New Folder' });
    fireEvent.change(field, { target: { value: 'Ideas' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(await findRow('Ideas')).toBeTruthy();
    expect(index.calls.find((c) => c.method === 'createFolder')!.args[0]).toMatchObject({
      parentId: null,
      teamId: null,
    });
    fireEvent.click(within(row('My Work')).getByRole('button', { name: 'Menu for My Work' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Open' }));
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'all' }, '/explorer/all');
  });
});

describe('expansion', () => {
  beforeEach(() => localStorage.clear());

  it('is read before the first paint: a remembered open folder shows its subfolders at once', async () => {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(['my-work', 'f1']));
    const index = createFakeIndex({
      folders: [folder('f1', 'Projects'), folder('f2', 'Inner', 'f1')],
    });
    page(index);
    expect(await findRow('Inner')).toBeTruthy();
  });

  it('remembers a folded My Work', async () => {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([]));
    const index = createFakeIndex({ folders: [folder('f1', 'Projects')] });
    // On a view My Work doesn't hold: its own view opens it (below).
    page(index, { kind: 'home' });
    await waitFor(() => expect(row('My Work').getAttribute('aria-expanded')).toBe('false'));
    expect(within(nav()).queryByRole('treeitem', { name: 'Projects' })).toBeNull();
  });

  it('opens the rows above a folder, from its space down', () => {
    const byId = new Map([
      ['a', { id: 'a', parentId: null, teamId: 'T1' }],
      ['b', { id: 'b', parentId: 'a', teamId: 'T1' }],
    ]);
    expect(rowsAbove('b', byId)).toEqual(['team:T1', 'a', 'b']);
    const store = createExpansion('test-key');
    const seen = vi.fn();
    store.subscribe(seen);
    store.expand('x', 'y');
    expect(seen).toHaveBeenCalledTimes(1);
    store.expand('x');
    expect(seen).toHaveBeenCalledTimes(1);
    expect([...store.get()]).toEqual(['x', 'y']);
  });

  it('starts every space folded with nothing kept, and keeps each space as the person left it (Work Tracker 1420)', () => {
    expect([...createExpansion('test-key-fresh').get()]).toEqual([]);
    const store = createExpansion('test-key-spaces');
    store.toggle('team:A');
    store.toggle('my-work');
    // Opening one space never folds another.
    expect(new Set(store.get())).toEqual(new Set(['team:A', 'my-work']));
    store.toggle('team:A');
    // A later visit reads what this browser kept.
    expect([...createExpansion('test-key-spaces').get()]).toEqual(['my-work']);
  });

  // Work Tracker 1495: two Explorers on one origin (two tabs, an editor's workbench frame) each held a copy, and a
  // change in one wrote back the spaces its stale copy still held open, so a space folded in the other came back open.
  it('never reopens a space another Explorer folded when it opens a row of its own', () => {
    localStorage.setItem('test-key-two', JSON.stringify(['my-work']));
    const page = createExpansion('test-key-two');
    const frame = createExpansion('test-key-two');
    expect([...frame.get()]).toEqual(['my-work']);
    page.toggle('my-work');
    // The frame opens the Library for a page of it: My Work stays folded.
    frame.expand('library');
    expect([...frame.get()]).toEqual(['library']);
    expect(JSON.parse(localStorage.getItem('test-key-two')!)).toEqual(['library']);
    // And a toggle there starts from what is kept too.
    frame.toggle('team:A');
    expect(new Set(JSON.parse(localStorage.getItem('test-key-two')!))).toEqual(
      new Set(['library', 'team:A']),
    );
  });

  it('draws another tab’s fold at once, and stops listening once nobody reads it', () => {
    localStorage.setItem('test-key-tab', JSON.stringify(['my-work', 'library']));
    const store = createExpansion('test-key-tab');
    const seen = vi.fn();
    const stop = store.subscribe(seen);
    expect([...store.get()]).toEqual(['my-work', 'library']);
    localStorage.setItem('test-key-tab', JSON.stringify(['library']));
    window.dispatchEvent(new StorageEvent('storage', { key: 'test-key-tab' }));
    expect([...store.get()]).toEqual(['library']);
    expect(seen).toHaveBeenCalledTimes(1);
    // Another key, or the same value again, changes nothing.
    window.dispatchEvent(new StorageEvent('storage', { key: 'other' }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'test-key-tab' }));
    expect(seen).toHaveBeenCalledTimes(1);
    // Opening a row that another page already opened draws what is kept, with no write.
    localStorage.setItem('test-key-tab', JSON.stringify(['library', 'f1']));
    store.expand('f1');
    expect([...store.get()]).toEqual(['library', 'f1']);
    expect(seen).toHaveBeenCalledTimes(2);
    stop();
    localStorage.setItem('test-key-tab', JSON.stringify([]));
    window.dispatchEvent(new StorageEvent('storage', { key: 'test-key-tab' }));
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('keeps its own copy once a write fails, rather than reading back an older kept one', () => {
    localStorage.setItem('test-key-full', JSON.stringify(['my-work']));
    const store = createExpansion('test-key-full');
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    try {
      store.toggle('my-work');
      expect([...store.get()]).toEqual([]);
      store.expand('library');
      expect([...store.get()]).toEqual(['library']);
    } finally {
      set.mockRestore();
    }
  });

  it('starts folded, without an error, when storage is blocked or holds nonsense', () => {
    localStorage.setItem('test-key-bad', '{not json');
    expect([...createExpansion('test-key-bad').get()]).toEqual([]);
    localStorage.setItem('test-key-obj', JSON.stringify({ a: 1 }));
    expect([...createExpansion('test-key-obj').get()]).toEqual([]);
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      const store = createExpansion('test-key-blocked');
      expect([...store.get()]).toEqual([]);
      expect(() => store.toggle('my-work')).not.toThrow();
      expect([...store.get()]).toEqual(['my-work']);
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });

  it('names the space holding each view', () => {
    const byId = new Map([
      ['a', { id: 'a', parentId: null, teamId: 'T1' }],
      ['p', { id: 'p', parentId: null, teamId: null }],
    ]);
    expect(spaceOfView({ kind: 'all' }, byId)).toBe('my-work');
    expect(spaceOfView({ kind: 'folder', id: 'p' }, byId)).toBe('my-work');
    expect(spaceOfView({ kind: 'team', id: 'T1', folderId: 'a' }, byId)).toBe('team:T1');
    expect(spaceOfView({ kind: 'offline' }, byId)).toBe('this-browser');
    expect(spaceOfView({ kind: 'home' }, byId)).toBeNull();
  });

  it('opens and folds a space only from its own chevron, never from a view inside it', async () => {
    const index = createFakeIndex({
      folders: [
        folder('f1', 'Projects'),
        folder('f2', 'Inner', 'f1'),
        folder('t1', 'Team Root', null, 'T1'),
        folder('t2', 'Other Root', null, 'T2'),
      ],
    });
    page(index, { kind: 'folder', id: 'f2' }, [
      { id: 'T1', name: 'Alpha' },
      { id: 'T2', name: 'Beta' },
    ]);
    // The view sits inside My Work, which stays folded: its row is drawn as the current one.
    await waitFor(() => expect(row('My Work').getAttribute('aria-current')).toBe('page'));
    expect(row('My Work').getAttribute('aria-expanded')).toBe('false');
    expect(within(nav()).queryByRole('treeitem', { name: 'Projects' })).toBeNull();
    fireEvent.click(within(row('Alpha')).getByRole('button', { name: 'Expand Alpha' }));
    await waitFor(() => expect(row('Alpha').getAttribute('aria-expanded')).toBe('true'));
    fireEvent.click(within(row('Beta')).getByRole('button', { name: 'Expand Beta' }));
    await waitFor(() => expect(row('Beta').getAttribute('aria-expanded')).toBe('true'));
    // Opening Beta folds nothing else.
    expect(row('Alpha').getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(row('My Work')).getByRole('button', { name: 'Expand My Work' }));
    // Opened, My Work shows the way down to the current folder, which is the current row now.
    expect(await findRow('Inner')).toBeTruthy();
    expect(row('Inner').getAttribute('aria-current')).toBe('page');
    expect(row('My Work').getAttribute('aria-current')).toBeNull();
    expect(JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? '[]')).toEqual(
      expect.arrayContaining(['team:T1', 'team:T2', 'my-work', 'f1']),
    );
  });

  it('ignores a kept state for a team the person is no longer in', async () => {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(['team:GONE', 'team:T1']));
    const index = createFakeIndex({ folders: [folder('t1', 'Team Root', null, 'T1')] });
    page(index, { kind: 'home' }, [{ id: 'T1', name: 'Alpha' }]);
    expect(await findRow('Team Root')).toBeTruthy();
    expect(row('Alpha').getAttribute('aria-expanded')).toBe('true');
  });
});

describe('the keyboard tree', () => {
  beforeEach(myWorkOpened);

  it('keeps one tab stop, on the current row', async () => {
    page(createFakeIndex(), { kind: 'recent' });
    await findRow('Recent');
    const stops = within(nav())
      .getAllByRole('treeitem')
      .filter((i) => i.tabIndex === 0);
    expect(stops.map((i) => i.getAttribute('aria-label'))).toEqual(['Recent']);
  });

  it('moves with the arrows, Home and End, folds and opens with Left and Right, and goes with Enter', async () => {
    const index = createFakeIndex({ folders: [folder('f1', 'Projects')] });
    const onNavigate = page(index, { kind: 'home' });
    const home = await findRow('Home');
    await findRow('Projects');
    act(() => home.focus());
    const rows = within(nav()).getAllByRole('treeitem');
    key(home, 'ArrowDown');
    expect(document.activeElement).toBe(rows[1]);
    key(document.activeElement!, 'End');
    // The Library, folded: its rows (the Trash last) are inside.
    expect(document.activeElement).toBe(row('Library'));
    key(document.activeElement!, 'Home');
    expect(document.activeElement).toBe(home);

    const myWork = row('My Work');
    act(() => myWork.focus());
    expect(myWork.tabIndex).toBe(0);
    key(myWork, 'ArrowLeft');
    expect(myWork.getAttribute('aria-expanded')).toBe('false');
    key(myWork, 'ArrowRight');
    expect(myWork.getAttribute('aria-expanded')).toBe('true');
    key(myWork, 'ArrowRight');
    expect(document.activeElement).toBe(row('Projects'));
    key(document.activeElement!, 'ArrowLeft');
    expect(document.activeElement).toBe(myWork);

    key(myWork, 'Enter');
    expect(onNavigate).toHaveBeenLastCalledWith({ kind: 'all' }, '/explorer/all');
  });

  it('jumps to the next row starting with a typed letter, wrapping', async () => {
    // On a Library page, so the Library is open.
    page(createFakeIndex(), { kind: 'recent' });
    const home = await findRow('Home');
    act(() => home.focus());
    key(home, 't');
    expect(document.activeElement).toBe(row('Trash'));
    key(document.activeElement!, 'h');
    expect(document.activeElement).toBe(home);
  });

  it('has a real chevron: a labelled button that folds and opens', async () => {
    const index = createFakeIndex({ folders: [folder('f1', 'Projects')] });
    page(index, { kind: 'home' });
    await findRow('Projects');
    const chevron = within(row('My Work')).getByRole('button', { name: 'Collapse My Work' });
    fireEvent.click(chevron);
    expect(row('My Work').getAttribute('aria-expanded')).toBe('false');
    expect(within(row('My Work')).getByRole('button', { name: 'Expand My Work' })).toBeTruthy();
  });
});

describe('a big tree', () => {
  // Rendering 2,000 rows in jsdom took over 8 s on a CI runner, past Vitest's 5 s default; the budget that
  // matters is the per-key one below.
  it('keeps a key press cheap with 2,000 folder rows open', { timeout: 30_000 }, async () => {
    myWorkOpened();
    const folders = Array.from({ length: 2000 }, (_, i) =>
      folder(`f${i}`, `Folder ${String(i).padStart(4, '0')}`),
    );
    page(createFakeIndex({ folders }), { kind: 'home' });
    await findRow('Folder 1999');
    const first = row('Folder 0000');
    act(() => first.focus());
    const perKey =
      cpuMsOf(() => {
        for (let i = 0; i < 20; i++) key(document.activeElement!, 'ArrowDown');
      }) / 20;
    expect(document.activeElement).toBe(row('Folder 0020'));
    // Measured about 9 ms a key in jsdom (118 ms when the rows were gathered by an attribute selector); the
    // budget leaves room for a slower runner.
    expect(perKey).toBeLessThan(cpuBudgetMs(40));
  });
});
