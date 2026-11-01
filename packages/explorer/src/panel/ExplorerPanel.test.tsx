import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import {
  EXPLORER_POPOVER_HEIGHT,
  EXPLORER_POPOVER_WIDTH,
  ExplorerPanel,
  NEW_BUTTON_CHIP,
  NEW_BUTTON_RAIL,
  PANEL_BODY,
  type ExplorerPanelProps,
} from './ExplorerPanel';
import { panelSectionStorageKey } from './sections';
import type { ThisBrowserHost } from '../explorer/ThisBrowser';
import type { ThisBrowserItem } from '../this-browser';

const itemHref: ExplorerPanelProps['itemHref'] = (item) => `/project/${item.id}`;

function renderPanel(
  index: ReturnType<typeof createFakeIndex>,
  over: Partial<ExplorerPanelProps> = {},
) {
  const onOpenExplorer = vi.fn();
  render(
    <ExplorerPanel
      app="liveplanner"
      client={index.client}
      itemHref={itemHref}
      onCreate={vi.fn()}
      onOpenExplorer={onOpenExplorer}
      {...over}
    />,
  );
  return { onOpenExplorer };
}

const rail = () => screen.getByRole('navigation', { name: 'Explorer sections' });

describe('<ExplorerPanel>', () => {
  beforeEach(() => localStorage.clear());

  it('draws the rail as it always was: New, then Overview, Spaces and More under their titles', () => {
    renderPanel(createFakeIndex({ items: [] }), { teams: [{ id: 't1', name: 'Design' }] });
    const nav = within(rail());
    expect(nav.getByRole('button', { name: /New Plan/ })).toBeTruthy();
    expect(nav.getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Overview',
      'Spaces',
      'More',
    ]);
    for (const name of ['Home', 'Inbox', 'Shared With Me', 'My Work', 'Design', 'Trash'])
      expect(nav.getByRole('button', { name })).toBeTruthy();
  });

  it('gives New the control height, never squeezed: 36 px, 44 px on touch; a chip on a phone', () => {
    renderPanel(createFakeIndex({ items: [] }));
    const desk = within(rail()).getByRole('button', { name: /New Plan/ });
    for (const c of ['shrink-0', 'h-9', 'min-h-9', 'pointer-coarse:h-11', 'w-full'])
      expect(desk.className.split(' ')).toContain(c);
    expect(NEW_BUTTON_RAIL).toContain('pointer-coarse:h-11');
    cleanup();
    renderPanel(createFakeIndex({ items: [] }), { layout: 'sheet', open: true });
    const chip = within(rail()).getByRole('button', { name: 'New' });
    for (const c of ['shrink-0', ...NEW_BUTTON_CHIP.split(' ')])
      expect(chip.className.split(' ')).toContain(c);
    expect(chip.className).not.toContain('w-full');
  });

  it('fills the popover beside a desktop rail, and a phone sheet, never under 18rem', () => {
    renderPanel(createFakeIndex({ items: [] }));
    const side = document.querySelector<HTMLElement>('[data-panel-body="side"]')!;
    expect(side.className).toContain(PANEL_BODY.side);
    expect(PANEL_BODY.side).toContain('flex-1');
    expect(PANEL_BODY.side).toContain('min-h-[18rem]');
    // No fixed cap of its own any more: the host's popover sizes it.
    expect(side.className).not.toMatch(/h-\[min\(/);
    expect(document.querySelector('[data-explorer-panel]')!.className).toContain('flex-1');
    cleanup();
    renderPanel(createFakeIndex({ items: [] }), { layout: 'sheet', open: true });
    expect(document.querySelector('[data-panel-body="sheet"]')!.className).toContain(
      PANEL_BODY.sheet,
    );
  });

  it('draws group lines instead of titles in Minimal chrome', () => {
    renderPanel(createFakeIndex({ items: [] }), { divider: 'lines' });
    expect(within(rail()).queryAllByRole('heading')).toHaveLength(0);
  });

  it("leaves the open item out of Home's Jump Back In, from one request", async () => {
    const items = [1, 2, 3].map((i) => makeItem(i, { lastOpenedAt: 5_000_000 - i }));
    const index = createFakeIndex({ items });
    renderPanel(index, { current: items[0], currentId: items[0]!.id });
    const grid = await screen.findByRole('list', { name: 'Jump Back In' });
    const names = within(grid)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names.some((n) => n?.includes(items[0]!.title))).toBe(false);
    expect(index.count('listItems')).toBe(1);
  });

  it("fills Jump Back In's two rows of four from recent ones alone, the open one left out, in one request", async () => {
    // Nothing most used yet: the recent ones must fill all eight, with one to spare for the open item.
    const items = Array.from({ length: 12 }, (_, i) =>
      makeItem(i + 1, { lastOpenedAt: 5_000_000 - i }),
    );
    const index = createFakeIndex({ items });
    renderPanel(index, { current: items[0], currentId: items[0]!.id });
    const grid = await screen.findByRole('list', { name: 'Jump Back In' });
    const cards = within(grid).getAllByRole('listitem');
    expect(cards).toHaveLength(8);
    expect(cards.some((c) => c.textContent?.includes(items[0]!.title))).toBe(false);
    expect(index.count('listItems')).toBe(1);
  });

  it('runs its preview cards compact: two across, three from 24rem, four from 42rem', async () => {
    const items = [1, 2].map((i) => makeItem(i, { lastOpenedAt: 5_000_000 - i }));
    renderPanel(createFakeIndex({ items }));
    const grid = await screen.findByRole('list', { name: 'Jump Back In' });
    const classes = grid.className.split(' ');
    for (const c of ['grid-cols-2', '@sm:grid-cols-3', '@2xl:grid-cols-4'])
      expect(classes).toContain(c);
    expect(classes).not.toContain('@2xl:grid-cols-3');
  });

  it('gives the rail room beside the pane: 13rem wide', () => {
    renderPanel(createFakeIndex({ items: [] }));
    const classes = rail().className.split(' ');
    expect(classes).toContain('w-52');
    expect(classes).not.toContain('w-44');
  });

  it("names one popover size for every editor's panel", () => {
    expect(EXPLORER_POPOVER_WIDTH).toBe('w-[64rem]');
    expect(EXPLORER_POPOVER_HEIGHT).toBe('56rem');
  });

  it('says Nothing else yet when the open item is the only one', async () => {
    const only = makeItem(1, { lastOpenedAt: 5_000_000 });
    renderPanel(createFakeIndex({ items: [only] }), { current: only, currentId: only.id });
    expect(await screen.findByText('Nothing else yet')).toBeTruthy();
  });

  it('shows the current item on top, with the notice under it', () => {
    const item = makeItem(1);
    renderPanel(createFakeIndex({ items: [item] }), {
      current: item,
      notice: <p>Sign in note</p>,
    });
    const card = screen.getByRole('region', { name: 'Current plan' });
    expect(card.compareDocumentPosition(screen.getByText('Sign in note'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('remembers the section picked, per app', async () => {
    const index = createFakeIndex({ items: [] });
    renderPanel(index);
    fireEvent.click(within(rail()).getByRole('button', { name: 'Trash' }));
    expect(localStorage.getItem(panelSectionStorageKey('liveplanner'))).toBe('trash');
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 3, name: 'Trash' })).toBeTruthy(),
    );
  });

  it("deletes from its Trash in the Explorer page's words: Delete Forever, the same confirmation", async () => {
    const index = createFakeIndex({
      items: [makeItem(1, { trashedAt: Date.now(), trashReason: 'deleted' })],
    });
    renderPanel(index);
    fireEvent.click(within(rail()).getByRole('button', { name: 'Trash' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Forever' }));
    const confirm = screen.getByRole('dialog');
    expect(within(confirm).getByRole('heading').textContent).toBe(
      'Delete “\u2068Item 1\u2069” for good?',
    );
    expect(within(confirm).getByText('This cannot be undone.')).toBeTruthy();
  });

  it("opens a phone's sheet on Home and remembers nothing", () => {
    localStorage.setItem(panelSectionStorageKey('liveplanner'), 'trash');
    renderPanel(createFakeIndex({ items: [] }), { layout: 'sheet', open: true });
    expect(screen.getByRole('heading', { level: 3, name: 'Home' })).toBeTruthy();
  });

  it("hands the open item's Delete to the host, and trashes any other itself", async () => {
    const items = [1, 2].map((i) => makeItem(i, { lastOpenedAt: 5_000_000 - i }));
    const index = createFakeIndex({ items });
    const onTrashCurrent = vi.fn(async () => true);
    renderPanel(index, { current: items[0], currentId: items[0]!.id, onTrashCurrent });
    fireEvent.click(screen.getByRole('button', { name: 'Plan menu' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    await waitFor(() => expect(onTrashCurrent).toHaveBeenCalledWith(items[0]));
    expect(index.count('deleteItem')).toBe(0);
  });

  // AA for its small text: the unpressed option sits on the group's slate-100, where slate-500 read 4.3:1.
  it("reads the app filter's unpressed option at AA on its slate-100 group", () => {
    renderPanel(createFakeIndex({ items: [] }));
    const group = screen.getByRole('group', { name: 'Show' });
    expect(group.className.split(' ')).toContain('bg-slate-100');
    for (const option of within(group).getAllByRole('button')) {
      if (option.getAttribute('aria-pressed') === 'true') continue;
      expect(option.className.split(' ')).not.toContain('text-slate-500');
      expect(option.className.split(' ')).toContain('text-slate-600');
    }
  });

  it('has no Open Page: every section stays in the panel', () => {
    renderPanel(createFakeIndex({ items: [] }), { teams: [{ id: 't1', name: 'Design' }] });
    for (const name of ['Home', 'Timeline', 'My Work', 'Design', 'Trash']) {
      fireEvent.click(within(rail()).getByRole('button', { name }));
      expect(screen.queryByRole('link', { name: /Open Page/ })).toBeNull();
      expect(screen.queryByText('Open Page')).toBeNull();
    }
  });

  it('offers New Folder as a named glyph, beside the name of the view in full', async () => {
    const index = createFakeIndex({ items: [] });
    renderPanel(index);
    fireEvent.click(within(rail()).getByRole('button', { name: 'My Work' }));
    const heading = screen.getByRole('heading', { level: 3, name: 'My Work' });
    // Wraps rather than truncates: the name is never cut to "M…".
    expect(heading.className).not.toMatch(/\btruncate\b/);
    const button = screen.getByRole('button', { name: 'New Folder' });
    // A glyph alone: the name is its label (and its tooltip), never words beside it.
    expect(button.textContent).toBe('');
    expect(button.querySelector('svg')).toBeTruthy();
    fireEvent.click(button);
    await waitFor(() => expect(index.count('createFolder')).toBe(1));
    // Named as every other way of making one names it (menus.tsx, the Explorer's own button).
    expect(index.calls.find((c) => c.method === 'createFolder')?.args[0]).toMatchObject({
      name: 'New Folder',
    });
  });

  it("names New Folder New Subfolder inside a folder, and the team's Members is a glyph too", () => {
    renderPanel(createFakeIndex({ items: [] }), {
      teams: [{ id: 't1', name: 'A team with a long name of its own' }],
      teamsHost: {} as never,
    });
    fireEvent.click(
      within(rail()).getByRole('button', { name: 'A team with a long name of its own' }),
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'A team with a long name of its own' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New Folder' }).textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Members' }).textContent).toBe('');
  });

  it("offers My Work's own menu, the sidebar's, with Use as Default for…", async () => {
    renderPanel(createFakeIndex({ items: [] }));
    fireEvent.click(within(rail()).getByRole('button', { name: 'My Work' }));
    fireEvent.click(screen.getByRole('button', { name: 'Menu for My Work' }));
    const menu = await screen.findByRole('menu', { name: 'Actions for My Work' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((m) => m.textContent),
    ).toEqual(['Open', 'New Folder', 'Use as Default for…']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Use as Default for/ }));
    expect(await screen.findByRole('dialog', { name: /Default/ })).toBeTruthy();
  });

  it("opens the same menu from a right-click on the rail's My Work", async () => {
    renderPanel(createFakeIndex({ items: [] }));
    fireEvent.contextMenu(within(rail()).getByRole('button', { name: 'My Work' }));
    expect(await screen.findByRole('menu', { name: 'Actions for My Work' })).toBeTruthy();
    fireEvent.contextMenu(within(rail()).getByRole('button', { name: 'Trash' }));
    expect(screen.getAllByRole('menu')).toHaveLength(1);
  });
});

describe("the panel's This Browser", () => {
  beforeEach(() => localStorage.clear());

  const local = (
    id: string,
    title: string,
    extra: Partial<ThisBrowserItem> = {},
  ): ThisBrowserItem => ({
    id,
    title,
    createdAt: 1,
    updatedAt: 2,
    lastOpenedAt: null,
    trashedAt: null,
    favourite: false,
    ...extra,
  });

  const host = (over: Partial<ThisBrowserHost> = {}): ThisBrowserHost => ({
    items: [
      local('l1', 'Kept here'),
      local('l2', 'Also here'),
      local('l3', 'Gone', { trashedAt: 5 }),
    ],
    itemHref: (item) => `/project/${item.id}`,
    ...over,
  });

  it('is on the rail with its count while this browser keeps any, and not otherwise', () => {
    renderPanel(createFakeIndex({ items: [] }), { thisBrowser: host() });
    const entry = within(rail()).getByRole('button', { name: 'This Browser (2)' });
    expect(entry.textContent).toContain('2');
    cleanup();
    renderPanel(createFakeIndex({ items: [] }), { thisBrowser: host({ items: [] }) });
    expect(within(rail()).queryByRole('button', { name: /This Browser/ })).toBeNull();
    cleanup();
    renderPanel(createFakeIndex({ items: [] }));
    expect(within(rail()).queryByRole('button', { name: /This Browser/ })).toBeNull();
  });

  it('opens its pane in place, listing the live ones, each opening in the editor', () => {
    const open = vi.fn();
    const { onOpenExplorer } = renderPanel(createFakeIndex({ items: [] }), {
      thisBrowser: host({ open }),
    });
    fireEvent.click(within(rail()).getByRole('button', { name: 'This Browser (2)' }));
    expect(screen.getByRole('heading', { level: 3, name: 'This Browser' })).toBeTruthy();
    const list = screen.getByRole('list', { name: 'This Browser' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).queryByText('Gone')).toBeNull();
    fireEvent.click(within(list).getByRole('button', { name: 'Kept here' }));
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1' }));
    // Never a link out of the editor: the Explorer page is not asked for.
    expect(onOpenExplorer).not.toHaveBeenCalled();
    // This Browser holds only this app's items: no app filter.
    expect(screen.queryByRole('group', { name: 'Show' })).toBeNull();
  });

  it('syncs one in place for a person signed in, and deletes one after asking', async () => {
    const sync = vi.fn();
    const remove = vi.fn();
    renderPanel(createFakeIndex({ items: [] }), { thisBrowser: host({ sync, remove }) });
    fireEvent.click(within(rail()).getByRole('button', { name: 'This Browser (2)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sync Plan: Kept here' }));
    expect(sync).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Also here' }));
    expect(remove).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog', { name: /Delete this plan/ });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'l2' }));
  });

  it('offers neither Sync nor Delete where the host gives none (a guest)', () => {
    renderPanel(createFakeIndex({ items: [] }), { thisBrowser: host() });
    fireEvent.click(within(rail()).getByRole('button', { name: 'This Browser (2)' }));
    expect(screen.queryByRole('button', { name: /^Sync/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
  });

  it('draws the Current card from This Browser when the index has none for the open item', () => {
    const index = createFakeIndex({ items: [] });
    renderPanel(index, { thisBrowser: host(), current: null, currentId: 'l1' });
    const card = screen.getByRole('region', { name: 'Current plan' });
    expect(card.getAttribute('data-current-item')).toBe('this-browser');
    expect(within(card).getByText('Kept here')).toBeTruthy();
    expect(within(card).getByText('This Browser')).toBeTruthy();
    expect(within(card).getByText(/^Updated /)).toBeTruthy();
  });

  it("prefers the index's copy, and draws no card for an item neither holds", () => {
    const item = makeItem(1);
    renderPanel(createFakeIndex({ items: [item] }), {
      thisBrowser: host(),
      current: item,
      currentId: item.id,
    });
    expect(
      screen.getByRole('region', { name: 'Current plan' }).getAttribute('data-current-item'),
    ).toBe('index');
    cleanup();
    renderPanel(createFakeIndex({ items: [] }), { thisBrowser: host(), currentId: 'nowhere' });
    expect(screen.queryByRole('region', { name: 'Current plan' })).toBeNull();
    cleanup();
    // A trashed one is not open-able: no card.
    renderPanel(createFakeIndex({ items: [] }), { thisBrowser: host(), currentId: 'l3' });
    expect(screen.queryByRole('region', { name: 'Current plan' })).toBeNull();
  });

  it("renames a This Browser item through the editor's own rename, never the index", () => {
    const index = createFakeIndex({ items: [] });
    const onRenameCurrent = vi.fn();
    renderPanel(index, { thisBrowser: host(), currentId: 'l1', onRenameCurrent });
    const card = screen.getByRole('region', { name: 'Current plan' });
    fireEvent.click(within(card).getByRole('button', { name: 'Rename Kept here' }));
    const input = within(card).getByRole('textbox', { name: 'Rename Kept here' });
    fireEvent.change(input, { target: { value: 'Kept and renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRenameCurrent).toHaveBeenCalledWith('Kept and renamed');
    expect(index.count('updateItem')).toBe(0);
  });

  it("gives a This Browser item This Browser's menu: Sync in place, Delete after asking", async () => {
    const sync = vi.fn();
    const remove = vi.fn();
    const index = createFakeIndex({ items: [] });
    renderPanel(index, { thisBrowser: host({ sync, remove }), currentId: 'l1' });
    const card = screen.getByRole('region', { name: 'Current plan' });
    fireEvent.click(within(card).getByRole('button', { name: 'Plan menu' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Sync Plan/ }));
    expect(sync).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1' }));
    fireEvent.click(within(card).getByRole('button', { name: 'Plan menu' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete Plan/ }));
    const dialog = await screen.findByRole('dialog', { name: /Delete this plan/ });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1' }));
    expect(index.count('deleteItem')).toBe(0);
  });

  it('says when each changed in words, its full date on hover, and the page’s sentence with none', () => {
    const now = Date.now();
    renderPanel(createFakeIndex({ items: [] }), {
      thisBrowser: host({ items: [local('l1', 'Kept here', { updatedAt: now - 3 * 3_600_000 })] }),
    });
    fireEvent.click(within(rail()).getByRole('button', { name: 'This Browser (1)' }));
    const when = screen.getByText('Changed 3 hours ago');
    expect(when.tagName).toBe('TIME');
    expect(when.getAttribute('title')).toBe(
      new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        now - 3 * 3_600_000,
      ),
    );
    cleanup();
    // A stored date no Date can hold still reads, with no full date.
    renderPanel(createFakeIndex({ items: [] }), {
      thisBrowser: host({ items: [local('l1', 'Kept here', { updatedAt: 9e15 })] }),
    });
    fireEvent.click(within(rail()).getByRole('button', { name: 'This Browser (1)' }));
    expect(screen.getByText('Changed').tagName).toBe('SPAN');
  });

  it('lists the opened ones in Home’s Jump Back In beside the index’s, with the pill and its menu', async () => {
    const indexed = makeItem(1, { lastOpenedAt: 1_000 });
    const open = vi.fn();
    const remove = vi.fn();
    renderPanel(createFakeIndex({ items: [indexed] }), {
      thisBrowser: host({
        open,
        remove,
        items: [
          local('l1', 'Kept here', { lastOpenedAt: 2_000 }),
          local('l2', 'Never opened'),
          local('l3', 'Gone', { trashedAt: 5, lastOpenedAt: 3_000 }),
        ],
      }),
    });
    const grid = await screen.findByRole('list', { name: 'Jump Back In' });
    const cards = within(grid).getAllByRole('listitem');
    // Last opened first: this browser's, then the index's; never the unopened or trashed one.
    expect(cards.map((c) => c.textContent)).toEqual([
      expect.stringContaining('Kept here'),
      expect.stringContaining(indexed.title),
    ]);
    expect(within(cards[0]!).getByText('This Browser')).toBeTruthy();
    expect(cards[0]!.hasAttribute('data-this-browser-card')).toBe(true);
    fireEvent.click(within(cards[0]!).getByRole('button', { name: 'Kept here' }));
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1' }));
    fireEvent.click(within(cards[0]!).getByRole('button', { name: 'Menu for Kept here' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete Plan/ }));
    const dialog = await screen.findByRole('dialog', {
      name: /Delete this plan from this browser/,
    });
    expect(dialog.textContent).toContain('Nothing in your account changes.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(remove).not.toHaveBeenCalled();
  });

  it('never says No plans yet while this browser keeps opened ones, and leaves the open one out', async () => {
    renderPanel(createFakeIndex({ items: [] }), {
      thisBrowser: host({ items: [local('l1', 'Kept here', { lastOpenedAt: 2_000 })] }),
    });
    const grid = await screen.findByRole('list', { name: 'Jump Back In' });
    expect(within(grid).getByText('Kept here')).toBeTruthy();
    expect(screen.queryByText('No plans yet')).toBeNull();
    cleanup();
    // The open one is the only one: nothing else, as for the index's.
    renderPanel(createFakeIndex({ items: [] }), {
      thisBrowser: host({ items: [local('l1', 'Kept here', { lastOpenedAt: 2_000 })] }),
      currentId: 'l1',
    });
    expect(await screen.findByText('Nothing else yet')).toBeTruthy();
  });
});
