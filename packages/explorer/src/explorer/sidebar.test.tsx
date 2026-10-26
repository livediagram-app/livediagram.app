// The sidebar tree (liveplanner/docs/specs/013-workspace/explorer-structure.md): folder rows' and My Work's menus (⋯,
// right-click, Shift+F10), rename in place, a new folder opening its parent, expansion read before the first paint,
// and the keyboard tree (one tab stop, arrows, Home/End, Left/Right, type-ahead, a real chevron).
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Folder } from '@liveworkspace/index-client';
import { createFakeIndex } from '../test/fakeClient';
import type { ExplorerView } from '../views';
import { Explorer } from './Explorer';
import { EXPANDED_KEY, createExpansion, rowsAbove } from './sidebar/expansion';

const folder = (id: string, name: string, parentId: string | null = null): Folder => ({
  id,
  name,
  parentId,
  teamId: null,
  ownerId: 'user_me',
  createdAt: 1,
  updatedAt: 1,
});

function page(index: ReturnType<typeof createFakeIndex>, view: ExplorerView = { kind: 'all' }) {
  const onNavigate = vi.fn();
  render(
    <Explorer
      app="liveplanner"
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

describe('the sidebar’s menus and rename', () => {
  beforeEach(() => localStorage.clear());

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
    page(index);
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
    store.expand('my-work');
    expect(seen).not.toHaveBeenCalled();
    store.expand('x', 'y');
    expect([...store.get()]).toEqual(['my-work', 'x', 'y']);
  });
});

describe('the keyboard tree', () => {
  beforeEach(() => localStorage.clear());

  it('keeps one tab stop, on the current row', async () => {
    page(createFakeIndex(), { kind: 'favourites' });
    await findRow('Favourites');
    const stops = within(nav())
      .getAllByRole('treeitem')
      .filter((i) => i.tabIndex === 0);
    expect(stops.map((i) => i.getAttribute('aria-label'))).toEqual(['Favourites']);
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
    expect(document.activeElement).toBe(row('Trash'));
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
    page(createFakeIndex(), { kind: 'home' });
    const home = await findRow('Home');
    act(() => home.focus());
    key(home, 't');
    expect(document.activeElement).toBe(row('Timeline'));
    key(document.activeElement!, 't');
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
    localStorage.clear();
    const folders = Array.from({ length: 2000 }, (_, i) =>
      folder(`f${i}`, `Folder ${String(i).padStart(4, '0')}`),
    );
    page(createFakeIndex({ folders }), { kind: 'home' });
    await findRow('Folder 1999');
    const first = row('Folder 0000');
    act(() => first.focus());
    const started = performance.now();
    for (let i = 0; i < 20; i++) key(document.activeElement!, 'ArrowDown');
    const perKey = (performance.now() - started) / 20;
    expect(document.activeElement).toBe(row('Folder 0020'));
    // Measured about 9 ms a key in jsdom (118 ms when the rows were gathered by an attribute selector); the
    // budget leaves room for a loaded machine.
    expect(perKey).toBeLessThan(40);
  });
});
