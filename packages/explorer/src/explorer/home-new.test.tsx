// Home's New (one-explorer.md "New, on Home"): the four items made most recently in the person's own space and their
// teams', newest first, in this app or every app under All; leading Recent's timeline as made rows ("Made · Marketing"),
// Made by AI on an AI tool's; Offline's merged in; left out with none or a failed read; the timeline's placeholders
// while it loads; no request of its own.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndexError, type Item } from '@liveworkspace/index-client';
import { newLine } from '../data/viewLists';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import type { ThisBrowserItem } from '../this-browser';
import { Explorer } from './Explorer';
import { mergeMade } from './HomeNew';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const HOUR = 3_600_000;
const made = (i: number, hoursAgo: number, over: Partial<Item> = {}) =>
  makeItem(i, { createdAt: Date.now() - hoursAgo * HOUR, ...over });

function renderHome(
  index: ReturnType<typeof createFakeIndex>,
  over: Partial<Parameters<typeof Explorer>[0]> = {},
) {
  return render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'home' }}
      onNavigate={vi.fn()}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      heroHidden
      {...over}
    />,
  );
}

// New's items are the timeline's made rows, in Recent's section.
const section = () => document.querySelector<HTMLElement>('[data-home-section="recent"]');
const labels = (el: HTMLElement) =>
  [...el.querySelectorAll('[data-timeline-event="made"] a[aria-label]')].map((a) =>
    a.getAttribute('aria-label'),
  );

describe('New, on Home', () => {
  it('shows the four newest made, newest first, in the timeline, from no request of its own', async () => {
    const index = createFakeIndex({
      items: [
        made(1, 50, { lastOpenedAt: Date.now() }),
        made(2, 1, { teamId: 'team-1' }),
        made(3, 3, { source: 'ai' }),
        made(4, 2),
        made(5, 4),
        made(6, 0.5, { app: 'livediagram', kind: 'canvas' }),
        // Reached only through a link: someone else's space.
        made(7, 0.1, { ownerId: 'user_you', sharedVia: 'code7', access: 'view' }),
        made(8, 0.2, { trashedAt: Date.now() }),
        made(9, 0.3, { archivedAt: Date.now() }),
      ],
    });
    renderHome(index, { teams: [{ id: 'team-1', name: 'Marketing' }] });
    await waitFor(() => expect(section()).toBeTruthy());
    const el = section()!;
    await waitFor(() => expect(labels(el)).toEqual(['Item 2', 'Item 4', 'Item 3', 'Item 5']));
    // No section of its own: New leads Recent's timeline.
    expect(screen.queryByRole('heading', { name: 'New' })).toBeNull();
    // Each line says it was made and where it lives; the timeline's clock says when.
    const team = el.querySelector('[data-item-card="item-2"]')!;
    expect(team.textContent).toContain('Made · Marketing');
    expect(el.querySelector('[data-item-card="item-4"]')!.textContent).toContain('Made · My Work');
    // An AI tool's item wears Made by AI; the rest don't.
    expect(el.querySelector('[data-item-card="item-3"] [data-made-by-ai]')).toBeTruthy();
    expect(el.querySelectorAll('[data-made-by-ai]')).toHaveLength(1);
    // Each opens the item.
    expect(within(el).getByRole('link', { name: 'Item 2' }).getAttribute('href')).toBe('/p/item-2');
    // Folded into Home's one items read.
    await waitFor(() => expect(index.count('listItems')).toBe(1));
    expect(index.calls.find((c) => c.method === 'listItems')!.args[0]).toMatchObject({
      view: 'recent',
      newest: 4,
      app: 'liveplanner',
    });
  });

  it('shows every app’s under All Apps, each with its app’s mark', async () => {
    const index = createFakeIndex({
      items: [made(1, 3), made(2, 1, { app: 'livediagram', kind: 'canvas' })],
    });
    renderHome(index, { filter: 'all' });
    await waitFor(() => expect(section()).toBeTruthy());
    await waitFor(() => expect(labels(section()!)).toEqual(['Item 2', 'Item 1']));
    expect(
      section()!.querySelectorAll('[data-timeline-event="made"] [data-app-mark]'),
    ).toHaveLength(2);
    expect(index.calls.find((c) => c.method === 'listItems')!.args[0]).not.toHaveProperty('app');
  });

  it('stays away with nothing made, or when its read fails', async () => {
    const { unmount } = renderHome(createFakeIndex({ items: [] }));
    await waitFor(() => expect(document.querySelector('[data-explorer-view="home"]')).toBeTruthy());
    await waitFor(() => expect(document.querySelector('[data-timeline-event="made"]')).toBeNull());
    unmount();
    const index = createFakeIndex({ items: [made(1, 1, { lastOpenedAt: Date.now() })] });
    index.fail.set('listItems', new IndexError(500, 'down'));
    renderHome(index);
    await screen.findByText(/Couldn’t load Home/);
    expect(labels(section()!)).toEqual([]);
  });

  it('draws the timeline’s placeholders while it loads', async () => {
    const index = createFakeIndex({ items: [made(1, 1)] });
    index.hold.add('listItems');
    renderHome(index);
    await waitFor(() => expect(section()).toBeTruthy());
    expect(section()!.getAttribute('aria-busy')).toBe('true');
    expect(section()!.querySelector('[data-home-timeline-skeleton]')).toBeTruthy();
    index.release();
    await waitFor(() => expect(labels(section()!)).toEqual(['Item 1']));
    expect(section()!.getAttribute('aria-busy')).toBe('false');
  });

  it('lets an item trashed here go at once', async () => {
    const index = createFakeIndex({ items: [made(1, 1), made(2, 2)] });
    renderHome(index);
    await waitFor(() => expect(labels(section()!)).toEqual(['Item 1', 'Item 2']));
    fireEvent.click(within(section()!).getByRole('button', { name: 'Menu for Item 1' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Move to Trash|Delete/ }));
    await waitFor(() => expect(labels(section()!)).toEqual(['Item 2']));
  });

  it('renames in the card whose menu started it, even when Recent shows the item too', async () => {
    const index = createFakeIndex({ items: [made(1, 1, { lastOpenedAt: Date.now() })] });
    renderHome(index);
    await waitFor(() => expect(labels(section()!)).toEqual(['Item 1']));
    fireEvent.click(within(section()!).getByRole('button', { name: 'Menu for Item 1' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    const input = await screen.findByRole('textbox', { name: 'Rename Item 1' });
    expect(section()!.contains(input)).toBe(true);
    expect(screen.getAllByRole('textbox', { name: 'Rename Item 1' })).toHaveLength(1);
  });
});

describe('mergeMade', () => {
  const local = (id: string, createdAt: number): ThisBrowserItem => ({
    id,
    title: id,
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: null,
    trashedAt: null,
  });

  it('merges this browser’s by when each was made, at most the cap', () => {
    const index = [
      { id: 'a', createdAt: 50 },
      { id: 'b', createdAt: 10 },
    ];
    expect(mergeMade(index, [], 4).map((i) => i.id)).toEqual(['a', 'b']);
    expect(
      mergeMade(index, [local('l1', 30), local('l2', 60), local('l3', 5)], 3).map((i) => i.id),
    ).toEqual(['l2', 'a', 'l1']);
  });

  it('says when it was made and where it lives', () => {
    expect(newLine({ createdAt: 0 }, 2 * HOUR, 'Marketing')).toBe('Made 2 hours ago · Marketing');
    expect(newLine({ createdAt: 0 }, 2 * HOUR, null)).toBe('Made 2 hours ago');
  });
});
