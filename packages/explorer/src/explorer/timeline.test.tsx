import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IndexError, type TimelineEvent } from '@liveworkspace/index-client';
import { createFakeIndex, makeEvent } from '../test/fakeClient';
import { Explorer, type ExplorerProps } from './Explorer';

const itemHref: ExplorerProps['itemHref'] = (item) => `https://${item.app}.app/open/${item.id}`;

function renderTimeline(
  index: ReturnType<typeof createFakeIndex>,
  over: Partial<ExplorerProps> = {},
) {
  const onOpenItem = vi.fn();
  const onTimeline = vi.fn();
  const onNavigate = vi.fn();
  render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'timeline' }}
      onNavigate={onNavigate}
      itemHref={itemHref}
      onCreate={vi.fn()}
      onOpenItem={onOpenItem}
      onTimeline={onTimeline}
      viewerId="user_me"
      {...over}
    />,
  );
  return { onOpenItem, onTimeline, onNavigate };
}

const cards = () => document.querySelectorAll('[data-timeline-event]');
const timelineQueries = (index: ReturnType<typeof createFakeIndex>) =>
  index.calls.filter((c) => c.method === 'timeline').map((c) => c.args[0]);

function mixedApps(): TimelineEvent[] {
  return [
    makeEvent(1, { type: 'renamed', detail: { from: 'Old name' } }),
    makeEvent(2, { app: 'livediagram', type: 'moved' }, { app: 'livediagram', kind: 'canvas' }),
    makeEvent(
      3,
      { app: 'livedocuments', type: 'shared', detail: { level: 'view' } },
      {
        app: 'livedocuments',
        kind: 'document',
      },
    ),
  ];
}

describe('the Timeline view', () => {
  it('shows this app’s events by default, one bounded page, without app marks', async () => {
    const index = createFakeIndex({ events: mixedApps() });
    renderTimeline(index);
    await waitFor(() => expect(cards().length).toBe(1));
    expect(timelineQueries(index)).toEqual([{ app: 'liveplanner', limit: 30 }]);
    expect(screen.getByText('Plan Renamed')).toBeTruthy();
    expect(screen.getByText(/Was “Old name” · by you/)).toBeTruthy();
    expect(document.querySelector('[data-app-mark]')).toBeNull();
    expect(screen.getByRole('treeitem', { name: 'Timeline' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('shows every app’s events under All, each with its app’s mark, and remembers the choice', async () => {
    const index = createFakeIndex({ events: mixedApps() });
    const { onOpenItem } = renderTimeline(index);
    await waitFor(() => expect(cards().length).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() => expect(cards().length).toBe(3));
    expect(timelineQueries(index).at(-1)).toEqual({ limit: 30 });
    const marks = [...document.querySelectorAll('[data-app-mark]')].map((m) =>
      m.getAttribute('data-app-mark'),
    );
    expect(marks.sort()).toEqual(['livediagram', 'livedocuments', 'liveplanner']);
    expect(localStorage.getItem('liveworkspace:explorer-filter:liveplanner')).toBe('all');
    // Another app's card opens in that app.
    fireEvent.click(screen.getByRole('button', { name: /Item 2, Canvas Moved/ }));
    expect(onOpenItem).toHaveBeenCalledWith(
      'https://livediagram.app/open/item-2',
      expect.objectContaining({ id: 'item-2', app: 'livediagram' }),
    );
  });

  it('marks New what others did since the last look, then marks the Timeline seen once', async () => {
    const now = Date.now();
    const index = createFakeIndex({
      seenAt: now - 30 * 60_000,
      events: [
        makeEvent(1, { actorId: 'user_other', occurredAt: now - 60_000 }),
        makeEvent(2, { actorId: 'user_me', occurredAt: now - 120_000, type: 'renamed' }),
        makeEvent(3, { actorId: 'user_other', occurredAt: now - 3_600_000, type: 'moved' }),
      ],
    });
    renderTimeline(index);
    await waitFor(() => expect(cards().length).toBe(3));
    const newPills = screen.getAllByText('New');
    expect(newPills).toHaveLength(1);
    expect(newPills[0]!.closest('[data-timeline-event]')?.getAttribute('data-timeline-event')).toBe(
      'ev-1',
    );
    await waitFor(() => expect(index.count('markTimelineSeen')).toBe(1));
    expect(screen.getByText('To My Work · by a teammate')).toBeTruthy();
  });

  it('pages with Show More, and folds a day’s run of one kind into a stack', async () => {
    const now = Date.now();
    const events = Array.from({ length: 45 }, (_, i) =>
      makeEvent(i, { type: 'renamed', occurredAt: now - i * 1000 }),
    );
    const index = createFakeIndex({ events });
    const { onTimeline } = renderTimeline(index);
    await waitFor(() => expect(document.querySelector('[data-timeline-stack]')).toBeTruthy());
    expect(screen.getByText('30 events · click to expand')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show More' }));
    await waitFor(() => expect(screen.getByText('45 events · click to expand')).toBeTruthy());
    expect(timelineQueries(index)[1]).toEqual({ app: 'liveplanner', limit: 30, cursor: '30' });
    expect(screen.queryByRole('button', { name: 'Show More' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Plans Renamed,/ }));
    expect(cards().length).toBe(46);
    expect(onTimeline).toHaveBeenCalledWith('Loaded', 'More');
    expect(onTimeline).toHaveBeenCalledWith('Opened', 'Stack');
  });

  it('says a failed read failed, never that nothing happened, and tries again', async () => {
    const index = createFakeIndex({ events: [makeEvent(1)] });
    index.fail.set('timeline', new IndexError(500, 'internal'));
    renderTimeline(index);
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Couldn’t load your Timeline')).toBeTruthy();
    index.fail.delete('timeline');
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(cards().length).toBe(1));
  });

  it('is empty, with New, when nothing has happened', async () => {
    const index = createFakeIndex();
    renderTimeline(index);
    expect(await screen.findByText('Nothing has happened yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New Plan' })).toBeTruthy();
  });

  it('filters by kind of event, with a way back', async () => {
    const index = createFakeIndex({ events: mixedApps() });
    const { onTimeline } = renderTimeline(index, { filter: 'all' });
    await waitFor(() => expect(cards().length).toBe(3));
    fireEvent.click(screen.getByRole('button', { name: 'View and filter timeline' }));
    const panel = screen.getByRole('dialog', { name: 'Timeline filters' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Renames' }));
    expect(cards().length).toBe(2);
    expect(onTimeline).toHaveBeenCalledWith('Selected', 'renames');
    fireEvent.click(within(panel).getByRole('button', { name: 'Reset' }));
    expect(cards().length).toBe(3);
  });

  it('moves focus into the Filter panel when it opens and back to the button on Escape', async () => {
    const index = createFakeIndex({ events: mixedApps() });
    renderTimeline(index, { filter: 'all' });
    await waitFor(() => expect(cards().length).toBe(3));
    const button = screen.getByRole('button', { name: 'View and filter timeline' });
    button.focus();
    fireEvent.click(button);
    const panel = screen.getByRole('dialog', { name: 'Timeline filters' });
    expect(document.activeElement).toBe(panel);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Timeline filters' })).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('opens an item in the Trash at the Trash', async () => {
    const index = createFakeIndex({
      events: [makeEvent(1, { type: 'trashed' }, { trashedAt: Date.now() })],
    });
    const { onNavigate, onOpenItem } = renderTimeline(index);
    await waitFor(() => expect(cards().length).toBe(1));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Plan Moved to Trash/ }));
    });
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'trash' }, '/explorer/trash');
    expect(onOpenItem).not.toHaveBeenCalled();
  });

  it('asks for one page of 30 however long the history is', async () => {
    const now = Date.now();
    const events = Array.from({ length: 10_000 }, (_, i) =>
      makeEvent(i, {
        type: (['created', 'edited', 'renamed', 'moved'] as const)[i % 4],
        occurredAt: now - i * 60_000,
      }),
    );
    const index = createFakeIndex({ events });
    const start = performance.now();
    renderTimeline(index);
    await waitFor(() => expect(document.querySelector('[data-timeline-day]')).toBeTruthy());
    const ms = performance.now() - start;
    expect(index.count('timeline')).toBe(1);
    expect(cards().length).toBeLessThanOrEqual(30);
    expect(ms).toBeLessThan(1500);
  });
});

describe('a Timeline card’s menu, links and counts', () => {
  it('opens the item’s menu with Remove from Timeline, which takes the card off at once', async () => {
    const index = createFakeIndex({
      events: [makeEvent(1, { type: 'renamed' }), makeEvent(2, { type: 'moved' })],
    });
    const { onTimeline } = renderTimeline(index);
    await waitFor(() => expect(cards().length).toBe(2));
    fireEvent.click(screen.getByRole('button', { name: 'Menu for Item 1' }));
    const menu = screen.getByRole('menu', { name: 'Actions for Item 1' });
    expect(within(menu).getByRole('menuitem', { name: 'Rename' })).toBeTruthy();
    expect(onTimeline).toHaveBeenCalledWith('Opened', 'Menu');
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Remove from Timeline' }));
    });
    expect(cards().length).toBe(1);
    expect(index.calls.find((c) => c.method === 'dismissTimelineEvents')?.args).toEqual([['ev-1']]);
    expect(onTimeline).toHaveBeenCalledWith('Removed', 'Entry');
  });

  it('puts the card back, and says so, when the index refuses', async () => {
    const index = createFakeIndex({ events: [makeEvent(1)] });
    index.fail.set('dismissTimelineEvents', new IndexError(500, 'internal'));
    renderTimeline(index);
    await waitFor(() => expect(cards().length).toBe(1));
    fireEvent.contextMenu(cards()[0]!);
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from Timeline' }));
    });
    await waitFor(() => expect(cards().length).toBe(1));
    expect(await screen.findByText(/Couldn’t remove that from your Timeline/)).toBeTruthy();
  });

  it('renames in place on the card whose menu started it, and every card follows', async () => {
    const index = createFakeIndex({
      // The index holds the item too, so the rename lands.
      items: [makeEvent(1).item],
      events: [
        makeEvent(1, { type: 'moved' }),
        makeEvent(2, { itemId: makeEvent(1).itemId, item: makeEvent(1).item, type: 'renamed' }),
      ],
    });
    renderTimeline(index);
    await waitFor(() => expect(cards().length).toBe(2));
    fireEvent.click(screen.getAllByRole('button', { name: 'Menu for Item 1' })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const fields = screen.getAllByRole('textbox', { name: 'Rename Item 1' });
    expect(fields).toHaveLength(1);
    fireEvent.change(fields[0]!, { target: { value: 'Launch plan' } });
    await act(async () => {
      fireEvent.keyDown(fields[0]!, { key: 'Enter' });
    });
    await waitFor(() => expect(screen.getAllByText('Launch plan')).toHaveLength(2));
  });

  it('removes a whole stack from its own menu', async () => {
    const now = Date.now();
    const events = Array.from({ length: 4 }, (_, i) =>
      makeEvent(i, { type: 'renamed', occurredAt: now - i * 1000 }),
    );
    const index = createFakeIndex({ events });
    const { onTimeline } = renderTimeline(index);
    await waitFor(() => expect(document.querySelector('[data-timeline-stack]')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Menu for Plans Renamed' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from Timeline' }));
    });
    expect(document.querySelector('[data-timeline-stack]')).toBeNull();
    expect(index.calls.find((c) => c.method === 'dismissTimelineEvents')?.args).toEqual([
      ['ev-0', 'ev-1', 'ev-2', 'ev-3'],
    ]);
    expect(onTimeline).toHaveBeenCalledWith('Removed', 'Stack');
  });

  it('follows #event= a few pages back, opens its stack and rings it', async () => {
    const now = Date.now();
    const events = Array.from({ length: 45 }, (_, i) =>
      makeEvent(i, { type: 'renamed', occurredAt: now - i * 1000 }),
    );
    const index = createFakeIndex({ events });
    window.location.hash = '#event=ev-40';
    try {
      renderTimeline(index);
      await waitFor(() =>
        expect(document.querySelector('[data-timeline-event="ev-40"]')).toBeTruthy(),
      );
      expect(index.count('timeline')).toBe(2);
      expect(document.querySelector('[data-timeline-event="ev-40"]')!.className).toContain(
        'ring-2',
      );
      // It folds again like any other stack.
      fireEvent.click(screen.getByRole('button', { name: /^Plans Renamed,/ }));
      expect(document.querySelector('[data-timeline-event="ev-40"]')).toBeNull();
    } finally {
      window.location.hash = '';
    }
  });

  it('gives up on a linked event after a bounded number of pages', async () => {
    const now = Date.now();
    const events = Array.from({ length: 400 }, (_, i) =>
      makeEvent(i, { occurredAt: now - i * 1000 }),
    );
    const index = createFakeIndex({ events });
    window.location.hash = '#event=nowhere';
    try {
      renderTimeline(index);
      await waitFor(() => expect(index.count('timeline')).toBe(6));
      await new Promise((r) => setTimeout(r, 20));
      expect(index.count('timeline')).toBe(6);
    } finally {
      window.location.hash = '';
    }
  });

  it('draws an event still to come in the Upcoming band', async () => {
    const index = createFakeIndex({
      events: [makeEvent(1, { occurredAt: Date.now() + 3 * 86_400_000 }), makeEvent(2)],
    });
    renderTimeline(index);
    await waitFor(() => expect(cards().length).toBe(2));
    expect(screen.getByText('Upcoming')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('counts what others did since the last look in the sidebar, and clears it on reading', async () => {
    const index = createFakeIndex({ events: [makeEvent(1)] });
    index.inbox.timelineNew = 100;
    index.hold.add('markTimelineSeen');
    renderTimeline(index);
    expect(await screen.findByRole('treeitem', { name: 'Timeline (99+ new)' })).toBeTruthy();
    expect(index.count('inbox')).toBe(1);
    await act(async () => index.release());
    await waitFor(() => expect(screen.getByRole('treeitem', { name: 'Timeline' })).toBeTruthy());
    expect(index.count('inbox')).toBe(1);
  });
});
