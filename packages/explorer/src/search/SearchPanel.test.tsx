import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Folder } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { matchAll, SEARCH_DEBOUNCE_MS, SEARCH_GROUP_MAX } from './match';
import { SearchPanel, type SearchEntry } from './SearchPanel';

const folder = (id: string, name: string, teamId: string | null = null): Folder => ({
  id,
  name,
  parentId: null,
  teamId,
  ownerId: 'user_me',
  createdAt: 1,
  updatedAt: 1,
});

const entries: SearchEntry[] = [
  {
    id: 'filters',
    group: 'help',
    label: 'Filters and Search',
    href: 'https://lp/help/f/',
    newTab: true,
  },
  {
    id: 'notifications',
    group: 'settings',
    label: 'Notifications',
    href: '/explorer?settings=notifications',
  },
];

afterEach(() => vi.useRealTimers());

async function typeAndWait(text: string) {
  fireEvent.change(screen.getByRole('combobox', { name: 'Search' }), { target: { value: text } });
  await act(async () => {
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
  });
  await act(async () => {});
}

describe('the Search panel', () => {
  it('finds items, folders, teams and entries, and opens the one picked', async () => {
    vi.useFakeTimers();
    const index = createFakeIndex({
      items: [makeItem(1, { title: 'Roadmap 2026' }), makeItem(2, { title: 'Budget' })],
      folders: [folder('f1', 'Roadmaps'), folder('f2', 'Road trips', 't1'), folder('f3', 'Other')],
    });
    const onOpen = vi.fn();
    const onClose = vi.fn();
    render(
      <SearchPanel
        client={index.client}
        itemHref={(i) => `/open/${i.id}`}
        teams={[{ id: 't1', name: 'Road Crew' }]}
        entries={entries}
        onOpen={onOpen}
        onClose={onClose}
      />,
    );
    await act(async () => {});
    await typeAndWait('road');
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Roadmap 2026', 'Roadmaps', 'Road tripsin Road Crew', 'Road Crew']);
    // The first result is highlighted; Enter opens it.
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search' }), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search' }), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith('/explorer/folder?id=f1');
    expect(onClose).toHaveBeenCalled();
  });

  it('asks the index once the typing pauses, and only for the app given', async () => {
    vi.useFakeTimers();
    const index = createFakeIndex({ items: [makeItem(1, { title: 'Plan' })] });
    render(
      <SearchPanel
        client={index.client}
        app="liveplanner"
        itemHref={(i) => `/open/${i.id}`}
        onOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const field = screen.getByRole('combobox', { name: 'Search' });
    for (const text of ['p', 'pl', 'pla']) fireEvent.change(field, { target: { value: text } });
    await typeAndWait('plan');
    const searches = index.calls.filter((c) => c.method === 'listItems');
    expect(searches).toHaveLength(1);
    expect(searches[0]!.args[0]).toMatchObject({
      view: 'search',
      q: 'plan',
      app: 'liveplanner',
      limit: SEARCH_GROUP_MAX,
    });
    expect(index.count('listFolders')).toBe(1);
  });

  it('keeps the first result highlighted when an arrow is pressed before the results arrive', async () => {
    vi.useFakeTimers();
    const index = createFakeIndex({ items: [makeItem(1, { title: 'Plan' })] });
    const onOpen = vi.fn();
    render(
      <SearchPanel
        client={index.client}
        itemHref={(i) => `/open/${i.id}`}
        onOpen={onOpen}
        onClose={vi.fn()}
      />,
    );
    await act(async () => {});
    const field = screen.getByRole('combobox', { name: 'Search' });
    fireEvent.change(field, { target: { value: 'plan' } });
    // Still waiting for the pause in typing: nothing to move through yet.
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    await typeAndWait('plan');
    expect(screen.getByRole('option', { name: /Plan/ }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith('/open/item-1');
  });

  it('opens a help article in a new tab', async () => {
    vi.useFakeTimers();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <SearchPanel
        client={createFakeIndex().client}
        itemHref={(i) => `/open/${i.id}`}
        entries={entries}
        onOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await typeAndWait('filters');
    fireEvent.click(screen.getByRole('option', { name: /Filters and Search/ }));
    expect(open).toHaveBeenCalledWith('https://lp/help/f/', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('is a listbox only while it has results: its hints are plain text a screen reader reads', async () => {
    vi.useFakeTimers();
    render(
      <SearchPanel
        client={createFakeIndex().client}
        itemHref={(i) => `/open/${i.id}`}
        entries={entries}
        onOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByText('Start typing to search.')).toBeTruthy();
    await typeAndWait('zzzz');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByText('Nothing matches “zzzz”.')).toBeTruthy();
    await typeAndWait('filters');
    expect(screen.getByRole('listbox', { name: 'Results' })).toBeTruthy();
  });
});

describe('matchAll', () => {
  it('keeps every word, leading matches first, at most the group’s cap', () => {
    const names = ['A road', 'Road one', 'Roads', 'Nothing'];
    expect(matchAll(names, ['road'], (n) => n)).toEqual(['Road one', 'Roads', 'A road']);
    const many = Array.from({ length: 50 }, (_, i) => `Road ${i}`);
    expect(matchAll(many, ['road'], (n) => n)).toHaveLength(SEARCH_GROUP_MAX);
  });

  it('runs over a large list well within a frame', () => {
    const folders = Array.from({ length: 20_000 }, (_, i) => `Folder number ${i} of many`);
    const start = performance.now();
    matchAll(folders, ['number', 'zzz'], (n) => n);
    expect(performance.now() - start).toBeLessThan(50);
  });
});
