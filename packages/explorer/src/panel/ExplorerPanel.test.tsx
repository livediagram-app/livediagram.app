import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { ExplorerPanel, type ExplorerPanelProps } from './ExplorerPanel';
import { panelSectionStorageKey } from './sections';

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

  it('sends Open Page to the Explorer at the section shown', () => {
    const { onOpenExplorer } = renderPanel(createFakeIndex({ items: [] }));
    fireEvent.click(within(rail()).getByRole('button', { name: 'My Work' }));
    fireEvent.click(screen.getByRole('link', { name: /Open Page/ }));
    expect(onOpenExplorer).toHaveBeenCalledWith({ kind: 'all' });
  });
});
