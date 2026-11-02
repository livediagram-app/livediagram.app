import { Profiler } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { Folder } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { Explorer } from '../explorer/Explorer';
import { ExplorerPanel } from '../panel/ExplorerPanel';
import { DRAG_HOVER_OPEN_MS, FOLDER_DRAG_MIME, ITEM_DRAG_MIME } from './drag';

// A DataTransfer as a browser hands one to every event of a drag.
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

function dragOnto(source: Element, target: Element, dt = transfer()) {
  fireEvent.dragStart(source, { dataTransfer: dt });
  fireEvent.dragEnter(target, { dataTransfer: dt });
  fireEvent.dragOver(target, { dataTransfer: dt });
  fireEvent.drop(target, { dataTransfer: dt });
  fireEvent.dragEnd(source, { dataTransfer: dt });
  return dt;
}

const folder = (id: string, over: Partial<Folder> = {}): Folder => ({
  id,
  name: id === 'f1' ? 'Specs' : id,
  parentId: null,
  teamId: null,
  ownerId: 'user_me',
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

function renderPage(
  index: ReturnType<typeof createFakeIndex>,
  teams = [{ id: 't1', name: 'Design' }],
) {
  return render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'all' }}
      onNavigate={vi.fn()}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      teams={teams}
    />,
  );
}

const sections = () => within(screen.getByRole('navigation', { name: 'Sections' }));
const rowOf = (name: string) =>
  sections().getByRole('treeitem', { name }).firstElementChild as HTMLElement;
const findRow = async (name: string) =>
  (await sections().findByRole('treeitem', { name })).firstElementChild as HTMLElement;
const itemRow = async (id: string) => {
  await waitFor(() => expect(document.querySelector(`[data-item-row="${id}"]`)).toBeTruthy());
  return document.querySelector(`[data-item-row="${id}"]`)!;
};

describe('drag and drop on the Explorer page', () => {
  beforeEach(() => localStorage.setItem('liveworkspace:explorer-view-mode', 'list'));
  afterEach(() => vi.useRealTimers());

  it('moves a dragged row into a sidebar folder, says where, and undoes', async () => {
    const index = createFakeIndex({ items: [makeItem(1)], folders: [folder('f1')] });
    renderPage(index);
    const row = await itemRow('item-1');
    dragOnto(row, rowOf('Specs'));
    await waitFor(() =>
      expect(index.calls.find((c) => c.method === 'updateItem')?.args).toEqual([
        'item-1',
        { folderId: 'f1' },
      ]),
    );
    expect(
      await screen.findByText('Moved “\u2068Item 1\u2069” to \u2068Specs\u2069.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(index.count('updateItem')).toBe(2));
    expect(index.calls.at(-1)!.args).toEqual(['item-1', { folderId: null }]);
  });

  it('moves into a team, and onto a folder row in the list', async () => {
    const index = createFakeIndex({ items: [makeItem(1), makeItem(2)], folders: [folder('f1')] });
    renderPage(index);
    dragOnto(await itemRow('item-1'), rowOf('Design'));
    await waitFor(() =>
      expect(index.calls.find((c) => c.method === 'updateItem')?.args).toEqual([
        'item-1',
        { folderId: null, teamId: 't1' },
      ]),
    );
    dragOnto(await itemRow('item-2'), document.querySelector('[data-folder-row="f1"]')!);
    await waitFor(() => expect(index.count('updateItem')).toBe(2));
    expect(index.calls.at(-1)!.args).toEqual(['item-2', { folderId: 'f1' }]);
  });

  it('highlights a target while an item is over it, and not after', async () => {
    const index = createFakeIndex({ items: [makeItem(1)], folders: [folder('f1')] });
    renderPage(index);
    const dt = transfer();
    const row = await itemRow('item-1');
    const target = rowOf('Specs');
    fireEvent.dragStart(row, { dataTransfer: dt });
    fireEvent.dragEnter(target, { dataTransfer: dt });
    fireEvent.dragOver(target, { dataTransfer: dt });
    expect(target.getAttribute('data-drop-over')).toBe('true');
    fireEvent.dragLeave(target, { dataTransfer: dt });
    expect(target.getAttribute('data-drop-over')).toBeNull();
    fireEvent.dragEnd(row, { dataTransfer: dt });
  });

  it('does nothing for a drop where the item already is, or for a drag from elsewhere', async () => {
    const index = createFakeIndex({ items: [makeItem(1)], folders: [folder('f1')] });
    renderPage(index);
    dragOnto(await itemRow('item-1'), rowOf('My Work'));
    // Another tab's drag carries the type but no item here.
    const foreign = transfer();
    foreign.setData(ITEM_DRAG_MIME, 'item-1');
    const target = await findRow('Specs');
    fireEvent.dragOver(target, { dataTransfer: foreign });
    fireEvent.drop(target, { dataTransfer: foreign });
    await act(async () => {});
    expect(index.count('updateItem')).toBe(0);
  });

  it('drags only what the person manages: never a link-shared item, nor a team folder', async () => {
    const index = createFakeIndex({
      items: [makeItem(1, { sharedVia: 'code1', access: 'view' })],
      folders: [folder('f1'), folder('tf', { teamId: 't1' })],
    });
    render(
      <Explorer
        app="liveplanner"
        client={index.client}
        view={{ kind: 'shared' }}
        onNavigate={vi.fn()}
        itemHref={(i) => `/p/${i.id}`}
        onCreate={vi.fn()}
        teams={[{ id: 't1', name: 'Design' }]}
      />,
    );
    expect((await itemRow('item-1')).getAttribute('draggable')).toBeNull();
    expect((await findRow('Specs')).getAttribute('draggable')).toBe('true');
    fireEvent.click(
      within(sections().getByRole('treeitem', { name: 'Design' })).getAllByRole('button', {
        hidden: true,
      })[0]!,
    );
    expect((await findRow('tf')).getAttribute('draggable')).toBeNull();
  });

  it('wakes the Trash for the whole drag, and trashes what is dropped on it with an Undo', async () => {
    const index = createFakeIndex({ items: [makeItem(1)] });
    renderPage(index);
    const row = await itemRow('item-1');
    const trash = rowOf('Trash');
    const dt = transfer();
    fireEvent.dragStart(row, { dataTransfer: dt });
    expect(within(trash).getByRole('status').textContent).toBe('Drop to Trash');
    fireEvent.dragEnter(trash, { dataTransfer: dt });
    fireEvent.dragOver(trash, { dataTransfer: dt });
    expect(within(trash).getByRole('status').textContent).toBe('Let go to trash it');
    expect(trash.querySelector('[data-trash-bin]')!.getAttribute('data-trash-bin')).toBe('over');
    fireEvent.drop(trash, { dataTransfer: dt });
    fireEvent.dragEnd(row, { dataTransfer: dt });
    await waitFor(() => expect(index.count('deleteItem')).toBe(1));
    expect(await screen.findByText('Moved “\u2068Item 1\u2069” to the Trash.')).toBeTruthy();
    expect(within(trash).getByText('Trash')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(index.count('restoreItem')).toBe(1));
  });

  it("asks before deleting a folder dropped on the Trash, and takes nothing from a drag that isn't the Explorer's", async () => {
    const index = createFakeIndex({ folders: [folder('f1')] });
    renderPage(index);
    const dt = dragOnto(await findRow('Specs'), rowOf('Trash'));
    expect(dt.types).toContain(FOLDER_DRAG_MIME);
    expect(await screen.findByRole('dialog', { name: /Delete “\u2068Specs\u2069”/ })).toBeTruthy();
  });

  it('opens a closed folder a drag rests on', async () => {
    const index = createFakeIndex({
      items: [makeItem(1)],
      folders: [folder('f1'), folder('sub', { parentId: 'f1', name: 'Q3' })],
    });
    renderPage(index);
    const row = await itemRow('item-1');
    expect(sections().queryByRole('treeitem', { name: 'Q3' })).toBeNull();
    vi.useFakeTimers();
    const dt = transfer();
    const target = rowOf('Specs');
    fireEvent.dragStart(row, { dataTransfer: dt });
    fireEvent.dragEnter(target, { dataTransfer: dt });
    fireEvent.dragOver(target, { dataTransfer: dt });
    act(() => vi.advanceTimersByTime(DRAG_HOVER_OPEN_MS));
    expect(sections().getByRole('treeitem', { name: 'Q3' })).toBeTruthy();
    fireEvent.dragEnd(row, { dataTransfer: dt });
  });
});

describe('drag and drop in the panel', () => {
  beforeEach(() => localStorage.clear());

  it('drops a card on My Work in the rail, and hands the open item to the host when dropped on the Trash', async () => {
    const items = [1, 2].map((i) => makeItem(i, { lastOpenedAt: 5_000_000 - i, folderId: 'f1' }));
    const index = createFakeIndex({ items, folders: [folder('f1')] });
    const onTrashCurrent = vi.fn(async () => true);
    render(
      <ExplorerPanel
        app="liveplanner"
        client={index.client}
        itemHref={(i) => `/p/${i.id}`}
        onCreate={vi.fn()}
        current={items[1]}
        currentId="item-2"
        onTrashCurrent={onTrashCurrent}
      />,
    );
    const rail = within(screen.getByRole('navigation', { name: 'Explorer sections' }));
    const grid = await screen.findByRole('list', { name: 'Jump Back In' });
    const card = within(grid).getAllByRole('listitem')[0]!;
    dragOnto(card, rail.getByRole('button', { name: 'My Work' }));
    await waitFor(() =>
      expect(index.calls.find((c) => c.method === 'updateItem')?.args).toEqual([
        'item-1',
        { folderId: null },
      ]),
    );
    // The open item, dragged from My Work, goes through the host.
    fireEvent.click(rail.getByRole('button', { name: 'My Work' }));
    const folderCard = await screen.findByRole('button', { name: 'Specs' });
    fireEvent.click(folderCard);
    await waitFor(() =>
      expect(screen.getAllByText('Item 2').some((el) => el.closest('li'))).toBe(true),
    );
    const row = screen
      .getAllByText('Item 2')
      .map((el) => el.closest('li'))
      .find(Boolean)!;
    dragOnto(row, rail.getByRole('button', { name: 'Trash' }));
    await waitFor(() => expect(onTrashCurrent).toHaveBeenCalled());
    expect(index.count('deleteItem')).toBe(0);
  });
});

describe('cost of a drag', () => {
  beforeEach(() => localStorage.setItem('liveworkspace:explorer-view-mode', 'list'));

  it("re-renders only the targets on a drag's start and end, not the rows, with 2,000 items and 10 folders", async () => {
    const items = Array.from({ length: 2000 }, (_, i) => makeItem(i));
    const folders = Array.from({ length: 10 }, (_, i) => folder(`f${i}`));
    const index = createFakeIndex({ items, folders });
    let commits = 0;
    render(
      <Profiler
        id="explorer"
        onRender={() => {
          commits += 1;
        }}
      >
        <Explorer
          app="liveplanner"
          client={index.client}
          view={{ kind: 'all' }}
          onNavigate={vi.fn()}
          itemHref={(i) => `/p/${i.id}`}
          onCreate={vi.fn()}
        />
      </Profiler>,
    );
    await waitFor(() => expect(document.querySelector('[data-item-row]')).toBeTruthy());
    const row = document.querySelector('[data-item-row]')!;
    await act(async () => {});
    commits = 0;
    const dt = transfer();
    // CPU time, not the Profiler's wall-clock actualDuration, which a busy CI runner stretched past the budget.
    const cpu = cpuMsOf(() => {
      fireEvent.dragStart(row, { dataTransfer: dt });
      fireEvent.dragEnd(row, { dataTransfer: dt });
    });
    // eslint-disable-next-line no-console
    console.log(`[drag] start+end: ${commits} commits, ${cpu.toFixed(1)}ms CPU`);
    expect(commits).toBeLessThanOrEqual(2);
    expect(cpu).toBeLessThan(cpuBudgetMs(50));
  });
});
