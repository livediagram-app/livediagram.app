import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Folder, ItemListQuery } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import type { ExplorerView } from '../views';
import { Explorer, type ExplorerProps } from './Explorer';

// The filter lens on the Explorer's lists (liveplanner/docs/specs/013-workspace/explorer-filters.md), with a host
// that routes as liveplanner's does: the view follows each navigation, `replace` or not.

const folder = (id: string, name: string, parentId: string | null = null): Folder => ({
  id,
  name,
  parentId,
  teamId: null,
  ownerId: 'user_me',
  createdAt: 1,
  updatedAt: 1,
});

function renderRouted(
  index: ReturnType<typeof createFakeIndex>,
  start: ExplorerView,
  over: Partial<ExplorerProps> = {},
) {
  const onNavigate = vi.fn();
  const onLensSelected = vi.fn();
  function Host() {
    const [view, setView] = useState(start);
    return (
      <Explorer
        app="liveplanner"
        client={index.client}
        view={view}
        onNavigate={(v, href, options) => {
          onNavigate(v, href, options);
          setView(v);
        }}
        itemHref={(item) => `/plan/${item.id}`}
        onCreate={() => {}}
        viewerId="user_me"
        teams={[{ id: 'T1', name: 'Acme' }]}
        lensTemplates={[
          { value: 'retrospective', label: 'Retrospective' },
          { value: 'kanban', label: 'Kanban' },
        ]}
        onLensSelected={onLensSelected}
        heroHidden
        {...over}
      />
    );
  }
  return { ...render(<Host />), onNavigate, onLensSelected };
}

const field = () => screen.getByRole('combobox', { name: 'Filter plans' });
const titles = () =>
  [...document.querySelectorAll('[data-item-row] a')].map((a) => a.textContent ?? '');
const lastList = (index: ReturnType<typeof createFakeIndex>) =>
  index.calls.filter((c) => c.method === 'listItems').at(-1)!.args[0] as ItemListQuery;

describe('the filter lens', () => {
  beforeEach(() => localStorage.setItem('liveworkspace:explorer-view-mode', 'list'));

  it('narrows the list it is on, writing ?q= in place at most every 250 ms', async () => {
    const index = createFakeIndex({
      items: [makeItem(1, { title: 'Road map' }), makeItem(2, { title: 'Budget' })],
    });
    const { onNavigate } = renderRouted(index, { kind: 'all' });
    await waitFor(() => expect(titles()).toHaveLength(2));
    fireEvent.focus(field());
    for (const value of ['r', 'ro', 'roa', 'road']) {
      fireEvent.change(field(), { target: { value, selectionStart: value.length } });
    }
    expect(onNavigate).not.toHaveBeenCalled();
    await waitFor(() => expect(onNavigate).toHaveBeenCalledTimes(1), { timeout: 1000 });
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'all', q: 'road' }, '/explorer/all?q=road', {
      replace: true,
    });
    await waitFor(() => expect(titles()).toEqual(['Road map']));
    expect(lastList(index)).toMatchObject({ view: 'all', team: 'personal', q: 'road' });
  });

  it('opens Search results from a view with no list of its own', async () => {
    const index = createFakeIndex({ items: [makeItem(1, { title: 'Road map' })] });
    const { onNavigate } = renderRouted(index, { kind: 'inbox' });
    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: 'road', selectionStart: 4 } });
    expect(onNavigate).toHaveBeenCalledWith(
      { kind: 'search', q: 'road' },
      '/explorer/search?q=road',
      undefined,
    );
    await waitFor(() => expect(titles()).toEqual(['Road map']));
    expect(lastList(index)).toMatchObject({ view: 'search', q: 'road' });
  });

  it('suggests filters as they are typed, and a chosen one becomes a pill the index reads', async () => {
    const index = createFakeIndex({
      items: [
        makeItem(1, { title: 'By hand', lastOpenedAt: 2 }),
        makeItem(2, { title: 'By AI', source: 'ai', lastOpenedAt: 1 }),
      ],
    });
    const { onLensSelected } = renderRouted(index, { kind: 'recent' });
    await waitFor(() => expect(titles()).toHaveLength(2));
    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: 'made', selectionStart: 4 } });
    const option = await screen.findByRole('option', { name: 'Made by AI' });
    fireEvent.click(option);
    fireEvent.click(await screen.findByRole('option', { name: 'Made by AI, Made by AI' }));
    expect(document.querySelector('[data-lens-pill="made-by"]')).toBeTruthy();
    expect(onLensSelected).toHaveBeenCalledWith('MadeBy');
    fireEvent.blur(field());
    await waitFor(() => expect(lastList(index)).toMatchObject({ source: ['ai'] }));
    await waitFor(() => expect(titles()).toEqual(['By AI']));
  });

  it('writes a chip’s choice, lights the chip, and Clear empties the lens', async () => {
    const now = Date.now();
    const index = createFakeIndex({
      items: [
        makeItem(1, { title: 'Fresh', updatedAt: now }),
        makeItem(2, { title: 'Stale', updatedAt: 1 }),
      ],
    });
    const { onNavigate, onLensSelected } = renderRouted(index, { kind: 'all' });
    await waitFor(() => expect(titles()).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Edited, any' }));
    const listbox = await screen.findByRole('listbox', { name: 'Edited' });
    fireEvent.click(within(listbox).getByRole('option', { name: /Last 7 days/ }));
    expect(onNavigate).toHaveBeenLastCalledWith(
      { kind: 'all', q: 'edited:7d' },
      '/explorer/all?q=edited%3A7d',
      { replace: true },
    );
    expect(onLensSelected).toHaveBeenCalledWith('Edited');
    await waitFor(() => expect(titles()).toEqual(['Fresh']));
    expect(screen.getByRole('button', { name: 'Edited: Last 7 days' })).toBeTruthy();
    fireEvent.mouseDown(document.body);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(titles()).toHaveLength(2));
  });

  it('says when nothing matches, names the words it could not read, and clears from there', async () => {
    const index = createFakeIndex({ items: [makeItem(1, { title: 'Road map' })] });
    renderRouted(index, { kind: 'all', q: 'zzz colour:red' });
    expect(await screen.findByText('No plans match these filters')).toBeTruthy();
    expect(screen.getByText('“colour:red” isn’t a filter, so it’s searched as text.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    await waitFor(() => expect(titles()).toEqual(['Road map']));
  });

  it('reaches a folder’s subfolders while set, the folder rows stepping aside', async () => {
    const index = createFakeIndex({
      folders: [folder('f1', 'Top'), folder('f2', 'Inner', 'f1')],
      items: [
        makeItem(1, { title: 'Top plan', folderId: 'f1', source: 'ai' }),
        makeItem(2, { title: 'Inner plan', folderId: 'f2', source: 'ai' }),
        makeItem(3, { title: 'Hand made', folderId: 'f1' }),
      ],
    });
    renderRouted(index, { kind: 'folder', id: 'f1', q: 'made-by:ai' });
    await waitFor(() => expect(titles().sort()).toEqual(['Inner plan', 'Top plan']));
    expect(lastList(index)).toMatchObject({ folder: 'f1', deep: true, source: ['ai'] });
    expect(document.querySelector('[data-folder-row]')).toBeNull();
    // Each row from a subfolder names its folder; every AI-made row wears the pill.
    expect(document.querySelectorAll('[data-made-by-ai]')).toHaveLength(2);
  });

  it('carries the lens from one list across places to another, and not into a place', async () => {
    const index = createFakeIndex({ items: [makeItem(1, { lastOpenedAt: 5, favourite: true })] });
    const { onNavigate } = renderRouted(index, { kind: 'recent', q: 'made-by:ai' });
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    fireEvent.click(within(nav).getByText('Favourites'));
    expect(onNavigate).toHaveBeenLastCalledWith(
      { kind: 'favourites', q: 'made-by:ai' },
      '/explorer/favourites?q=made-by%3Aai',
      undefined,
    );
    fireEvent.click(within(nav).getByText('My Work'));
    expect(onNavigate).toHaveBeenLastCalledWith({ kind: 'all' }, '/explorer/all', undefined);
  });

  it('offers Space only on a list across places', async () => {
    const index = createFakeIndex();
    const { unmount } = renderRouted(index, { kind: 'recent' });
    expect(await screen.findByRole('button', { name: 'Space, any' })).toBeTruthy();
    unmount();
    renderRouted(index, { kind: 'all' });
    await screen.findByRole('button', { name: 'Edited, any' });
    expect(screen.queryByRole('button', { name: 'Space, any' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Template, any' })).toBeTruthy();
  });

  it('announces how many are left once a changed lens has loaded', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const index = createFakeIndex({
        items: [makeItem(1, { title: 'Road' }), makeItem(2, { title: 'Map' })],
      });
      renderRouted(index, { kind: 'all' });
      await waitFor(() => expect(titles()).toHaveLength(2));
      fireEvent.click(screen.getByRole('button', { name: 'Made by AI' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      await waitFor(() =>
        expect(screen.getAllByRole('status').some((s) => s.textContent === 'No plans match')).toBe(
          true,
        ),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
