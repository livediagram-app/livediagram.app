// Home's What Happened: other people's doings from one page of the index's Timeline, grouped per item per day.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexError } from '@liveworkspace/index-client';
import { createFakeIndex, makeEvent } from '../test/fakeClient';
import { Explorer, type ExplorerProps } from './Explorer';

function renderHome(index: ReturnType<typeof createFakeIndex>, over: Partial<ExplorerProps> = {}) {
  const onHome = vi.fn();
  const onOpenItem = vi.fn();
  const onNavigate = vi.fn();
  render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'home' }}
      onNavigate={onNavigate}
      itemHref={(i) => `https://${i.app}.app/open/${i.id}`}
      onCreate={vi.fn()}
      onOpenItem={onOpenItem}
      onHome={onHome}
      viewerId="user_me"
      heroHidden
      {...over}
    />,
  );
  return { onHome, onOpenItem, onNavigate };
}

const section = () => document.querySelector('[data-home-section="what-happened"]');
const timelineCalls = (index: ReturnType<typeof createFakeIndex>) =>
  index.calls.filter((c) => c.method === 'timeline').map((c) => c.args[0]);

describe('What Happened on Home', () => {
  beforeEach(() => localStorage.clear());

  it('shows other people’s doings from one page, never the reader’s own, without marking anything seen', async () => {
    const now = Date.now();
    const index = createFakeIndex({
      seenAt: now - 10 * 60_000,
      events: [
        makeEvent(1, {
          actorId: 'user_sam',
          actorName: 'Sam Lee',
          type: 'renamed',
          detail: { from: 'Budget' },
          occurredAt: now - 60_000,
        }),
        makeEvent(2, { actorId: 'user_me', type: 'moved', occurredAt: now - 120_000 }),
        makeEvent(3, { actorId: 'user_ana', type: 'trashed', occurredAt: now - 3_600_000 }),
      ],
    });
    const { onHome, onOpenItem } = renderHome(index);
    await waitFor(() => expect(section()).toBeTruthy());
    const feed = await within(section() as HTMLElement).findByText('Was “Budget”');
    expect(feed).toBeTruthy();
    const entries = document.querySelectorAll('[data-what-happened-entry]');
    expect([...entries].map((e) => e.getAttribute('data-what-happened-entry'))).toEqual([
      'ev-1',
      'ev-3',
    ]);
    expect(entries[0]!.textContent).toContain('Sam Lee renamed Item 1');
    expect(within(entries[0] as HTMLElement).getByText('New')).toBeTruthy();
    expect(entries[1]!.textContent).toContain('A teammate moved Item 3 to the Trash');
    expect(timelineCalls(index)).toEqual([{ app: 'liveplanner', limit: 30 }]);
    expect(index.count('markTimelineSeen')).toBe(0);
    await act(async () => {
      fireEvent.click(entries[0]!);
    });
    expect(onOpenItem).toHaveBeenCalled();
    expect(onHome).toHaveBeenCalledWith('Selected', 'WhatHappened');
  });

  it('folds several people’s doings on one item in a day into one sentence that deals them out', async () => {
    const now = Date.now();
    const item = makeEvent(1).item;
    const index = createFakeIndex({
      events: [
        makeEvent(1, {
          actorId: 'user_sam',
          actorName: 'Sam Lee',
          type: 'edited',
          occurredAt: now - 1000,
        }),
        makeEvent(2, {
          actorId: 'user_ana',
          actorName: 'Ana Ruiz',
          type: 'renamed',
          itemId: item.id,
          item,
          occurredAt: now - 2000,
        }),
      ],
    });
    const { onHome } = renderHome(index);
    const summary = await screen.findByRole('button', {
      name: /Sam Lee and Ana Ruiz edited and renamed Item 1/,
    });
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    expect(summary.textContent).toContain('2 updates');
    fireEvent.click(summary);
    expect(onHome).toHaveBeenCalledWith('Opened', 'Group');
    expect(screen.getByRole('link', { name: /^Ana Ruiz renamed, Item 1/ })).toBeTruthy();
  });

  it('leaves the section out when nothing happened or the read failed, and links to the Timeline', async () => {
    const quiet = createFakeIndex({ events: [makeEvent(1, { actorId: 'user_me' })] });
    renderHome(quiet);
    await waitFor(() => expect(quiet.count('timeline')).toBe(1));
    await waitFor(() => expect(section()).toBeNull());

    document.body.innerHTML = '';
    const failing = createFakeIndex({ events: [makeEvent(1, { actorId: 'user_sam' })] });
    failing.fail.set('timeline', new IndexError(500, 'internal'));
    renderHome(failing);
    await waitFor(() => expect(failing.count('timeline')).toBe(1));
    await waitFor(() => expect(section()).toBeNull());
  });

  it('asks for every app’s events under All, each wearing its app’s mark, and offers See Timeline', async () => {
    const index = createFakeIndex({
      events: [
        makeEvent(1, { actorId: 'user_sam', type: 'edited' }),
        makeEvent(
          2,
          { app: 'livediagram', actorId: 'user_sam', type: 'moved' },
          { app: 'livediagram', kind: 'canvas' },
        ),
      ],
    });
    const { onNavigate, onHome } = renderHome(index, { filter: 'all' });
    await waitFor(() =>
      expect(document.querySelectorAll('[data-what-happened-entry]').length).toBe(2),
    );
    expect(timelineCalls(index)).toEqual([{ limit: 30 }]);
    expect(section()!.querySelectorAll('[data-app-mark]').length).toBe(2);
    fireEvent.click(within(section() as HTMLElement).getByRole('link', { name: 'See Timeline' }));
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'timeline' }, '/explorer/timeline');
    expect(onHome).toHaveBeenCalledWith('Selected', 'SeeTimeline');
  });
});
