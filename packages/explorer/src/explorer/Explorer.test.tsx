import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  it('asks the index once per list, never once per row, folder or tag', async () => {
    const items = Array.from({ length: 2000 }, (_, i) => makeItem(i, { tagIds: ['t1'] }));
    const index = createFakeIndex({
      items,
      tags: [{ id: 't1', name: 'Q3', colour: 'blue', createdAt: 1 }],
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
    expect(index.count('listTags')).toBe(1);
    expect(index.count('inbox')).toBe(1);
    // Windowed: a screenful of rows, not the page of 200.
    expect(rows().length).toBeLessThan(60);
    expect(screen.getByRole('heading', { name: 'My Work' })).toBeTruthy();
    expect(document.querySelector('[data-folder-row="f1"]')).toBeTruthy();
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

  it('shows every app’s items with their marks under All, each linking to its own app', async () => {
    const index = createFakeIndex({
      items: [makeItem(1), makeItem(2, { app: 'livediagram', kind: 'canvas', title: 'Flow' })],
    });
    renderExplorer(index, { kind: 'all' });
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(index.calls.at(-1)!.args[0]).toMatchObject({ app: 'liveplanner' });
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(index.calls.filter((c) => c.method === 'listItems').at(-1)!.args[0]).not.toHaveProperty(
      'app',
    );
    const flow = screen.getByRole('link', { name: 'Flow' });
    expect(flow.getAttribute('href')).toBe('https://livediagram.app/open/item-2');
    expect(document.querySelector('[data-app-mark="livediagram"]')).toBeTruthy();
    expect(localStorage.getItem('liveworkspace:explorer-filter:liveplanner')).toBe('all');
  });

  it('debounces search by 250 ms before going to the Search view', async () => {
    const index = createFakeIndex();
    const { onNavigate } = renderExplorer(index, { kind: 'all' });
    const field = screen.getByRole('searchbox', { name: 'Search' });
    fireEvent.change(field, { target: { value: 'r' } });
    fireEvent.change(field, { target: { value: 'ro' } });
    fireEvent.change(field, { target: { value: 'road' } });
    expect(onNavigate).not.toHaveBeenCalled();
    await waitFor(() => expect(onNavigate).toHaveBeenCalledTimes(1), { timeout: 1000 });
    expect(onNavigate).toHaveBeenCalledWith(
      { kind: 'search', q: 'road' },
      '/explorer/search?q=road',
    );
  });

  it('links an Inbox row to its app, item, tab and element', async () => {
    const index = createFakeIndex();
    index.inbox.actions.push({
      app: 'livedocuments',
      itemId: 'doc-1',
      itemTitle: 'Brief',
      tabId: 'tab-2',
      elementId: 'el-3',
      actionId: 'a1',
      elementLabel: 'Intro',
      name: 'Review the intro',
      status: 'open',
      assigneeId: 'user_me',
      assignerId: 'user_you',
      teamId: null,
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

  it('moves a trashed item out of the list at once, with Undo', async () => {
    const index = createFakeIndex({ items: [makeItem(1), makeItem(2)] });
    renderExplorer(index, { kind: 'all' });
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Menu for Item 1' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete Plan' }));
    expect(rows()).toHaveLength(1);
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(index.count('restoreItem')).toBe(1);
  });

  it('shows the Tags overview without asking for any tag’s items', async () => {
    const index = createFakeIndex({
      tags: Array.from({ length: 30 }, (_, i) => ({
        id: `t${i}`,
        name: `Tag ${i}`,
        colour: 'red',
        createdAt: 1,
      })),
    });
    renderExplorer(index, { kind: 'tags' });
    await screen.findByRole('button', { name: 'Tag 29' });
    expect(index.count('listItems')).toBe(0);
  });
});

export type { Item };
