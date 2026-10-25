import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexError, type Item } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import type { ExplorerView } from '../views';
import { Explorer, type ExplorerProps } from './Explorer';

const itemHref: ExplorerProps['itemHref'] = (item, at) =>
  `https://${item.app}.app/open/${item.id}${at?.tabId ? `?tab=${at.tabId}&el=${at.elementId}` : ''}`;

function renderExplorer(
  index: ReturnType<typeof createFakeIndex>,
  view: ExplorerView,
  over: Partial<ExplorerProps> = {},
) {
  const onNavigate = vi.fn();
  const onCreate = vi.fn();
  const utils = render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={view}
      onNavigate={onNavigate}
      itemHref={itemHref}
      onCreate={onCreate}
      {...over}
    />,
  );
  return { ...utils, onNavigate, onCreate };
}

const rows = () => document.querySelectorAll('[data-item-row]');

describe('<Explorer>', () => {
  // Most cases read rows; the card default has its own case.
  beforeEach(() => localStorage.setItem('liveworkspace:explorer-view-mode', 'list'));

  it('asks the index once per list, never once per row or folder', async () => {
    const items = Array.from({ length: 2000 }, (_, i) => makeItem(i));
    const index = createFakeIndex({
      items,
      folders: [
        {
          id: 'f1',
          name: 'Specs',
          parentId: null,
          teamId: null,
          ownerId: 'u',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    renderExplorer(index, { kind: 'all' });
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(index.count('listItems')).toBe(1);
    expect(index.count('listFolders')).toBe(1);
    expect(index.count('inbox')).toBe(1);
    // Windowed: a screenful of rows, not the page of 200.
    expect(rows().length).toBeLessThan(60);
    expect(screen.getByRole('heading', { name: 'My Work' })).toBeTruthy();
    expect(document.querySelector('[data-folder-row="f1"]')).toBeTruthy();
  });

  it('badges an item Public when its app says anyone can find it', async () => {
    const index = createFakeIndex({
      items: [makeItem(1, { summary: { public: true } }), makeItem(2)],
    });
    renderExplorer(index, { kind: 'all' });
    await waitFor(() => expect(rows().length).toBe(2));
    const badge = (n: number) =>
      document.querySelector(`[data-item-row="${makeItem(n).id}"]`)!.textContent ?? '';
    expect(badge(1)).toContain('Public');
    expect(badge(2)).not.toContain('Public');
    expect(badge(2)).toContain('Private');
  });

  it("draws the host's marks beside each item's name and Updated time, in rows and cards", async () => {
    const index = createFakeIndex({ items: [makeItem(1), makeItem(2)] });
    const renderItemMark = vi.fn((item: Item, at: 'title' | 'time') =>
      item.id === makeItem(1).id ? <i data-mark={`${at}:${item.id}`} /> : null,
    );
    const { unmount } = renderExplorer(index, { kind: 'all' }, { renderItemMark });
    await waitFor(() => expect(rows().length).toBe(2));
    const first = document.querySelector(`[data-item-row="${makeItem(1).id}"]`)!;
    expect(first.querySelector(`[data-mark="title:${makeItem(1).id}"]`)).toBeTruthy();
    expect(first.querySelector(`[data-mark="time:${makeItem(1).id}"]`)).toBeTruthy();
    const second = document.querySelector(`[data-item-row="${makeItem(2).id}"]`)!;
    expect(second.querySelector('[data-mark]')).toBeNull();
    unmount();
    localStorage.setItem('liveworkspace:explorer-view-mode', 'card');
    renderExplorer(index, { kind: 'all' }, { renderItemMark });
    await waitFor(() =>
      expect(
        document.querySelector(`[data-item-card="${makeItem(1).id}"] [data-mark^="time:"]`),
      ).toBeTruthy(),
    );
  });

  it("moves a team folder's address onto its team's page in place, keeping its lens", async () => {
    const index = createFakeIndex({
      folders: [
        {
          id: 'ft',
          name: 'Team Specs',
          parentId: null,
          teamId: 'team1',
          ownerId: 'u',
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'fp',
          name: 'Mine',
          parentId: null,
          teamId: null,
          ownerId: 'u',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const { onNavigate, unmount } = renderExplorer(
      index,
      { kind: 'folder', id: 'ft', q: 'road' } as ExplorerView,
      { teams: [{ id: 'team1', name: 'Team One' }] },
    );
    await waitFor(() => expect(onNavigate).toHaveBeenCalled());
    const [to, href, options] = onNavigate.mock.calls[0]!;
    expect(to).toMatchObject({ kind: 'team', id: 'team1', folderId: 'ft', q: 'road' });
    expect(href).toContain('team1');
    expect(options).toEqual({ replace: true });
    unmount();
    // A personal folder stays where it is.
    const own = renderExplorer(index, { kind: 'folder', id: 'fp' });
    await screen.findByRole('heading', { name: 'Mine' });
    expect(own.onNavigate).not.toHaveBeenCalled();
  });

  it('says the app’s kind: New Plan on liveplanner, New Canvas on livediagram', async () => {
    const index = createFakeIndex();
    const { onCreate, unmount } = renderExplorer(index, { kind: 'folder', id: 'f9' });
    fireEvent.click(await screen.findByRole('button', { name: 'Create' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'New Plan' }));
    expect(onCreate).toHaveBeenCalledWith({ folderId: 'f9', teamId: null });
    unmount();
    renderExplorer(createFakeIndex(), { kind: 'all' }, { app: 'livediagram' });
    expect(await screen.findAllByText('New Canvas')).not.toHaveLength(0);
  });

  it('offers each app’s New under All where the host passes newApps, and only the host’s under This app', async () => {
    const { onCreate } = renderExplorer(
      createFakeIndex(),
      { kind: 'folder', id: 'f9' },
      {
        newApps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'],
      },
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Create' }));
    expect(screen.queryByRole('menuitem', { name: /New Canvas/ })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'New Plan' }));
    expect(onCreate).toHaveBeenLastCalledWith({ folderId: 'f9', teamId: null });
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create' }));
    const tiles = screen.getAllByRole('menuitem').map((m) => m.textContent);
    expect(tiles).toEqual([
      'New Canvaslivediagram',
      'New Planliveplanner',
      'New Documentlivedocuments',
      'New Designlivedesign',
      'New Subfolder',
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: /New Design/ }));
    expect(onCreate).toHaveBeenLastCalledWith({ folderId: 'f9', teamId: null }, 'livedesign');
  });

  it('shows every app’s items with their marks under All, each linking to its own app', async () => {
    const index = createFakeIndex({
      items: [makeItem(1), makeItem(2, { app: 'livediagram', kind: 'canvas', title: 'Flow' })],
    });
    renderExplorer(index, { kind: 'all' });
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(index.calls.filter((c) => c.method === 'listItems').at(-1)!.args[0]).toMatchObject({
      app: 'liveplanner',
    });
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(index.calls.filter((c) => c.method === 'listItems').at(-1)!.args[0]).not.toHaveProperty(
      'app',
    );
    const flow = screen.getByRole('link', { name: 'Flow' });
    expect(flow.getAttribute('href')).toBe('https://livediagram.app/open/item-2');
    // The app's mark is its logo, the prism, in the app's accent: no letter.
    const mark = document.querySelector<HTMLElement>('[data-app-mark="livediagram"]')!;
    expect(mark.querySelector('svg')).toBeTruthy();
    expect(mark.style.color).toBe('rgb(14, 165, 233)');
    expect(mark.querySelector('[aria-hidden]')?.textContent).toBe('');
    expect(localStorage.getItem('liveworkspace:explorer-filter:liveplanner')).toBe('all');
  });

  it('links an Inbox row to its app, item, tab and element', async () => {
    const index = createFakeIndex();
    index.inbox.actions.push({
      app: 'livedocuments',
      itemId: 'doc-1',
      itemTitle: 'Brief',
      itemTeamId: null,
      tabId: 'tab-2',
      tabName: 'Draft',
      elementId: 'el-3',
      actionId: 'a1',
      elementLabel: 'Intro',
      name: 'Review the intro',
      status: 'open',
      assigneeId: 'user_me',
      assignerId: 'user_you',
      teamId: null,
      description: '',
      assigneeName: null,
      assignerName: null,
      card: null,
      createdAt: 1,
      updatedAt: 2,
    });
    renderExplorer(index, { kind: 'inbox' }, { viewerId: 'user_me', filter: 'all' });
    const link = await screen.findByRole('link', { name: /Review the intro/ });
    expect(link.getAttribute('href')).toBe(
      'https://livedocuments.app/open/doc-1?tab=tab-2&el=el-3',
    );
    // The sidebar counts it.
    expect(screen.getByRole('treeitem', { name: 'Inbox (1)' })).toBeTruthy();
  });

  it('stars from a row’s menu at once and takes it back when the index refuses', async () => {
    const index = createFakeIndex({ items: [makeItem(1)] });
    index.fail.set('favourite', new IndexError(500, 'unknown'));
    index.hold.add('favourite');
    renderExplorer(index, { kind: 'all' });
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Menu for Item 1' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Add to Favourites' }));
    const row = rows()[0] as HTMLElement;
    expect(within(row).getByText('Favourite')).toBeTruthy();
    act(() => index.release());
    await waitFor(() =>
      expect(within(rows()[0] as HTMLElement).queryByText('Favourite')).toBeNull(),
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('slides a trashed item out of the list, then offers Undo', async () => {
    const index = createFakeIndex({ items: [makeItem(1), makeItem(2)] });
    renderExplorer(index, { kind: 'all' });
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Menu for Item 1' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete Plan' }));
    // Its exit plays first (160 ms), then it leaves the list.
    expect(document.querySelector('.lw-row-out')).toBeTruthy();
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(index.count('restoreItem')).toBe(1);
  });

  it('lays a list out as cards until the person picks another layout', async () => {
    localStorage.removeItem('liveworkspace:explorer-view-mode');
    const index = createFakeIndex({ items: [makeItem(1)] });
    renderExplorer(index, { kind: 'all' });
    await waitFor(() => expect(document.querySelector('[data-item-card="item-1"]')).toBeTruthy());
    expect(rows()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Card view' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('offers New Folder only where folders live, and New alone elsewhere', async () => {
    renderExplorer(createFakeIndex(), { kind: 'recent' });
    expect(await screen.findByRole('button', { name: 'New Plan' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull();
  });

  it('keeps Shared With Me to one list, with no layout toggle', async () => {
    renderExplorer(createFakeIndex(), { kind: 'shared' });
    await screen.findByText('Nothing shared with you yet');
    expect(screen.queryByRole('group', { name: 'View mode' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^New / })).toBeNull();
  });

  it('groups the Trash by whose it is, with Restore and Delete permanently', async () => {
    const index = createFakeIndex({
      items: [makeItem(1, { trashedAt: Date.now(), trashReason: 'deleted' })],
    });
    renderExplorer(index, { kind: 'trash' });
    expect(await screen.findByRole('heading', { name: 'Your plans' })).toBeTruthy();
    expect(screen.getByText(/Deleted .* · 30 days left/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restore Item 1' }));
    await waitFor(() => expect(index.count('restoreItem')).toBe(1));
  });

  it('empties one Trash group of this app’s items only, the team’s too', async () => {
    const at = Date.now();
    const index = createFakeIndex({
      items: [
        makeItem(1, { trashedAt: at, trashReason: 'deleted' }),
        makeItem(2, { trashedAt: at, trashReason: 'deleted', teamId: 'team_1' }),
      ],
    });
    renderExplorer(
      index,
      { kind: 'trash' },
      { teams: [{ id: 'team_1', name: 'Design' }], filter: 'app' },
    );
    await screen.findByRole('heading', { name: 'Design' });
    fireEvent.click(screen.getByRole('button', { name: 'Empty Trash: Your plans' }));
    const confirm = screen.getByRole('dialog');
    expect(within(confirm).getByText(/Every plan in your Trash is deleted for good/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Empty Trash' }));
    });
    expect(index.calls.find((c) => c.method === 'emptyTrash')?.args).toEqual([
      { app: 'liveplanner' },
    ]);
    fireEvent.click(await screen.findByRole('button', { name: 'Empty Trash: Design' }));
    expect(screen.getByText(/Design’s Trash is deleted for good, for the whole team/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Empty Trash' }),
      );
    });
    expect(index.calls.filter((c) => c.method === 'emptyTrash')[1]?.args).toEqual([
      { team: 'team_1', app: 'liveplanner' },
    ]);
  });

  it('shows a Help button where the host has an article for the view', async () => {
    renderExplorer(createFakeIndex(), { kind: 'all' }, { helpHref: (v) => `/help/${v.kind}` });
    const help = await screen.findByRole('link', { name: 'Help' });
    expect(help.getAttribute('href')).toBe('/help/all');
  });

  it('offers the Undo for an item the host trashed on the way in, once, restoring it and re-reading the lists', async () => {
    const item = makeItem(1, { trashedAt: 10, trashReason: 'deleted' });
    const index = createFakeIndex({ items: [item] });
    const trashed = { id: item.id, title: 'Roadmap' };
    const { rerender } = renderExplorer(index, { kind: 'all' }, { trashedOnArrival: trashed });
    const listsBefore = index.count('listItems');
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(index.count('restoreItem')).toBe(1));
    await screen.findByText('Restored “Roadmap”.');
    await waitFor(() => expect(index.count('listItems')).toBeGreaterThan(listsBefore));
    rerender(
      <Explorer
        app="liveplanner"
        client={index.client}
        view={{ kind: 'all' }}
        onNavigate={vi.fn()}
        itemHref={itemHref}
        onCreate={vi.fn()}
        trashedOnArrival={trashed}
      />,
    );
    expect(screen.queryAllByText('Moved “Roadmap” to the Trash.')).toHaveLength(0);
  });
});

export type { Item };
