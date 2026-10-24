// Shared With Me's list, the Details table and the layout toggle (a team's page: teams/teams.test.tsx).
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Folder } from '@liveworkspace/index-client';
import type { ExplorerAccounts } from '../data/accounts';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import type { ExplorerView } from '../views';
import { Explorer } from './Explorer';

const folder = (id: string, name: string, over: Partial<Folder> = {}): Folder => ({
  id,
  name,
  parentId: null,
  teamId: null,
  ownerId: 'user_me',
  createdAt: Date.UTC(2026, 0, 2),
  updatedAt: Date.UTC(2026, 0, 3),
  ...over,
});

function fakeAccounts(
  over: Partial<ExplorerAccounts> = {},
): ExplorerAccounts & { asked: string[][] } {
  const asked: string[][] = [];
  return {
    asked,
    people: async (ids) => {
      asked.push([...ids]);
      return new Map(ids.map((id) => [id, id === 'user_ann' ? 'Ann Lee' : null]));
    },
    ...over,
  };
}

function page(
  index: ReturnType<typeof createFakeIndex>,
  view: ExplorerView,
  extra: Partial<React.ComponentProps<typeof Explorer>> = {},
) {
  return render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={view}
      onNavigate={vi.fn()}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      viewerId="user_me"
      heroHidden
      {...extra}
    />,
  );
}

describe('Shared With Me', () => {
  beforeEach(() => localStorage.clear());

  it('names the owner, shows the role, and dismisses only after asking', async () => {
    const index = createFakeIndex({
      items: [
        makeItem(1, { sharedVia: 'c1', ownerId: 'user_ann', access: 'view' }),
        makeItem(2, { sharedVia: 'c2', ownerId: 'user_bo', access: 'edit' }),
      ],
    });
    const accounts = fakeAccounts();
    page(index, { kind: 'shared' }, { accounts });
    const row = await screen.findByText('Item 1');
    const li = row.closest('li')!;
    await waitFor(() => expect(within(li).getByText('Ann Lee')).toBeTruthy());
    // One request for every owner on screen.
    expect(accounts.asked).toHaveLength(1);
    expect(within(li).getByText('View')).toBeTruthy();
    // Someone with no name reads as shared with you.
    expect(
      within(screen.getByText('Item 2').closest('li')!).getByText('Shared with you'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Item 1 from Shared With Me' }));
    expect(index.count('removeShared')).toBe(0);
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(index.count('removeShared')).toBe(1));
  });

  it('counts what is shared on its sidebar row', async () => {
    const index = createFakeIndex({
      items: [makeItem(1, { sharedVia: 'c1', ownerId: 'user_ann' })],
    });
    page(index, { kind: 'all' });
    expect(
      await screen.findByRole('treeitem', { name: 'Shared With Me (1 shared with you)' }),
    ).toBeTruthy();
  });
});

describe('the Details table', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('liveworkspace:explorer-view-mode', 'details');
  });

  it('keeps folders first, sorts by a header press, and keeps the choice', async () => {
    const index = createFakeIndex({
      items: [makeItem(1, { title: 'Zebra' }), makeItem(2, { title: 'apple' })],
      folders: [folder('f1', 'Specs')],
    });
    const view = page(index, { kind: 'all' });
    await screen.findByText('Zebra');
    fireEvent.click(screen.getByRole('columnheader', { name: /Name/ }));
    const names = () =>
      [...document.querySelectorAll('[data-folder-row], [data-item-row]')].map(
        (r) => r.getAttribute('data-folder-row') ?? r.getAttribute('data-item-row'),
      );
    expect(names()).toEqual(['f1', 'item-2', 'item-1']);
    expect(localStorage.getItem('liveworkspace:explorer-details-sort')).toBe('name:asc');
    view.unmount();
    page(index, { kind: 'all' });
    await screen.findByText('Zebra');
    expect(names()).toEqual(['f1', 'item-2', 'item-1']);
  });

  it('carries a sort chosen in the app’s own Explorer', async () => {
    localStorage.setItem('liveplanner:explorer-details-sort', 'name:desc');
    const index = createFakeIndex({
      items: [makeItem(1, { title: 'Zebra' }), makeItem(2, { title: 'apple' })],
    });
    page(index, { kind: 'all' });
    await screen.findByText('Zebra');
    expect(screen.getByRole('columnheader', { name: /Name/ }).getAttribute('aria-sort')).toBe(
      'descending',
    );
  });

  it('gives folders their menu, their dates and a dash until counted; items their cells', async () => {
    const index = createFakeIndex({
      items: [makeItem(1, { summary: { comments: 140, bytes: 3_500, elements: 12 } }), makeItem(2)],
      folders: [folder('f1', 'Specs')],
    });
    const prefetch = vi.fn();
    page(index, { kind: 'all' }, { prefetchThumbnail: prefetch });
    await screen.findByText('Item 1');
    const row1 = document.querySelector('[data-item-row="item-1"]') as HTMLElement;
    // Every cell in words: the count beside its bubble, the type in its app's colour, what the person may do.
    expect(within(row1).getByText('140')).toBeTruthy();
    expect(within(row1).getByText('140 comments')).toBeTruthy();
    expect(within(row1).getByText('12 objects').getAttribute('title')).toBe('12 objects (3.4 KB)');
    expect(within(row1).getByText('Plan')).toBeTruthy();
    expect(row1.textContent).toMatch(/Can (edit|comment|view)/);
    // The headers are words, never one letter.
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Name',
      'Type',
      'Comments',
      'Access',
      'Size',
      'Created',
      'Updated',
    ]);
    expect(
      within(document.querySelector('[data-item-row="item-2"]') as HTMLElement).getAllByText(
        'Not counted yet',
      ).length,
    ).toBeGreaterThan(0);
    expect(prefetch).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Menu for folder Specs' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    const input = await screen.findByRole('textbox', { name: 'Rename Specs' });
    fireEvent.change(input, { target: { value: 'Briefs' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(index.count('updateFolder')).toBe(1));
  });

  it('previews a row after a 600 ms rest', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const index = createFakeIndex({ items: [makeItem(1)] });
      page(index, { kind: 'all' }, { renderThumbnail: (i, size) => <i>{`${size}:${i.id}`}</i> });
      await screen.findByText('Item 1');
      const row = document.querySelector('[data-item-row="item-1"]') as HTMLElement;
      fireEvent.pointerEnter(row, { pointerType: 'mouse' });
      act(() => vi.advanceTimersByTime(500));
      expect(document.querySelector('[data-hover-preview]')).toBeNull();
      act(() => vi.advanceTimersByTime(150));
      expect(document.querySelector('[data-hover-preview]')?.textContent).toBe('card:item-1');
      fireEvent.pointerLeave(row);
      expect(document.querySelector('[data-hover-preview]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the layout toggle', () => {
  beforeEach(() => localStorage.clear());

  it('reports only a real switch, describes each layout, and carries an older choice', async () => {
    localStorage.setItem('livediagram:explorer-view', 'list');
    const onViewToggled = vi.fn();
    const index = createFakeIndex({ items: [makeItem(1)] });
    page(index, { kind: 'all' }, { onViewToggled });
    const list = await screen.findByRole('button', { name: 'List view' });
    expect(list.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(list);
    expect(onViewToggled).not.toHaveBeenCalled();
    const details = screen.getByRole('button', { name: 'Details view' });
    expect(details.getAttribute('aria-describedby')).toBeTruthy();
    expect(
      screen.getByText('A sortable table: type, comments, access, size and dates.'),
    ).toBeTruthy();
    fireEvent.click(details);
    expect(onViewToggled).toHaveBeenCalledWith('ExplorerViewDetails');
    expect(localStorage.getItem('liveworkspace:explorer-view-mode')).toBe('details');
  });
});
