// Home's Most Used (the rail's first panel: the items opened most often in the last 14 days, ranked, each with its day
// chart) and Recent (a timeline of New's items and the latest opened of the rest, by day), up to eight each, from one
// request; one column on a phone, Most Used first. A section with nothing in it is left out
// (liveworkspace/docs/specs/004-index/one-explorer.md "Recent, a timeline", "Most Used, in the rail").
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndexError } from '@liveworkspace/index-client';
import { isMostUsed, jumpBackInLine, jumpBackInSet } from '../data/viewLists';
import { createFakeIndex, madeLater, makeItem } from '../test/fakeClient';
import { Explorer } from './Explorer';

const opened = (i: number, extra = {}) => makeItem(i, { lastOpenedAt: 5_000_000 - i, ...extra });

describe('jumpBackInSet', () => {
  it('takes eight most used, then eight recent not among them, padding nothing', () => {
    const used = Array.from({ length: 10 }, (_, k) => ({ id: `u${k}`, useOpens: 20 - k }));
    const recent = Array.from({ length: 12 }, (_, k) => ({ id: k === 0 ? 'u1' : `r${k}` }));
    const ids = jumpBackInSet(used, recent).map((i) => i.id);
    expect(ids.slice(0, 8)).toEqual(['u0', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7']);
    expect(ids.slice(8)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8']);
    expect(jumpBackInSet([], recent.slice(0, 2)).map((i) => i.id)).toEqual(['u1', 'r1']);
    // A most used item needs an open in the window; an older index's days count the same.
    expect(jumpBackInSet([{ id: 'x', useOpens: 0 }], [])).toEqual([]);
    expect(jumpBackInSet([{ id: 'y', useDays: 2 }], []).map((i) => i.id)).toEqual(['y']);
  });

  it('says why each card is there', () => {
    const now = 10 * 3_600_000;
    expect(jumpBackInLine({ useOpens: 1, useDays: 1, lastOpenedAt: 1, updatedAt: 1 }, now)).toBe(
      'Opened once',
    );
    expect(jumpBackInLine({ useOpens: 12, useDays: 2, lastOpenedAt: 1, updatedAt: 1 }, now)).toBe(
      'Opened 12 times',
    );
    // An index that sends only days.
    expect(jumpBackInLine({ useDays: 1, lastOpenedAt: 1, updatedAt: 1 }, now)).toBe(
      'Used on 1 day',
    );
    expect(jumpBackInLine({ useDays: 6, lastOpenedAt: 1, updatedAt: 1 }, now)).toBe(
      'Used on 6 days',
    );
    expect(jumpBackInLine({ lastOpenedAt: now - 2 * 3_600_000, updatedAt: 1 }, now)).toMatch(
      /^Opened 2 hours ago$/,
    );
  });

  it('tells a most used item by its opens or its days', () => {
    const items = [{ ...opened(1), useDays: 3 }, { ...opened(2), useDays: 2 }, opened(3)];
    expect(items.filter(isMostUsed)).toHaveLength(2);
    expect([{ useOpens: 3 }, {}].filter(isMostUsed)).toHaveLength(1);
  });
});

afterEach(() => vi.unstubAllGlobals());

/** Twenty items opened, newest first, the first ten most used (the first the most). */
const twenty = () =>
  Array.from({ length: 20 }, (_, k) =>
    opened(k + 1, k < 10 ? { useOpens: 30 - k, useDays: 1 } : {}),
  );

const renderHome = (index: ReturnType<typeof createFakeIndex>, onNavigate = vi.fn()) =>
  render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'home' }}
      onNavigate={onNavigate}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      heroHidden
    />,
  );

const section = (id: string) => document.querySelector<HTMLElement>(`[data-home-section="${id}"]`);
// A section's cards, by name (See More left out).
const cards = (el: HTMLElement) =>
  within(el)
    .getAllByRole('link')
    .map((a) => a.getAttribute('aria-label') ?? a.textContent)
    .filter((name) => name !== 'See More');
// The timeline's rows of one kind, by name: what was opened, or what was made.
const rows = (el: HTMLElement, kind: 'opened' | 'made') =>
  [...el.querySelectorAll(`[data-timeline-event="${kind}"] a[aria-label]`)].map((a) =>
    a.getAttribute('aria-label'),
  );

describe('Home', () => {
  it('draws Most Used then Recent as two sections of their own, from one Recent request that carries Most Used', async () => {
    const items = [
      opened(1, { useOpens: 2, useDays: 2 }),
      opened(2, { useOpens: 9, useDays: 1 }),
      opened(3),
      opened(4),
      makeItem(5),
      // New's four, so none of the above is in New.
      ...madeLater(),
    ];
    const index = createFakeIndex({ items });
    renderHome(index);
    await screen.findByRole('heading', { level: 2, name: 'Most Used' });
    const used = screen.getByRole('region', { name: 'Most Used' });
    expect(cards(used)).toEqual(['Item 2', 'Item 1']);
    expect(used.textContent).toContain('9 opens');
    const recent = screen.getByRole('region', { name: 'Recent' });
    expect(within(recent).getByRole('heading', { level: 2, name: 'Recent' })).toBeTruthy();
    // The timeline: what was opened, and New's four as made, none of them twice.
    expect(rows(recent, 'opened')).toEqual(['Item 3', 'Item 4']);
    expect(rows(recent, 'made')).toHaveLength(4);
    // Most Used first in the page's order (a phone's one column), the timeline after it.
    const order = [...document.querySelectorAll('[data-home-section]')].map((s) =>
      s.getAttribute('data-home-section'),
    );
    expect(order.indexOf('recent')).toBe(order.indexOf('most-used') + 1);
    expect(screen.queryByText('Jump Back In')).toBeNull();
    await waitFor(() => expect(index.count('listItems')).toBe(1));
    expect(index.calls.find((c) => c.method === 'listItems')!.args[0]).toMatchObject({
      view: 'recent',
      // New's four more of each than Home shows, so both still fill once New's leave them.
      used: 12,
      limit: 20,
    });
  });

  it('puts See More on Recent’s heading, into the Recent view, and none on Most Used', async () => {
    const onNavigate = vi.fn();
    renderHome(createFakeIndex({ items: twenty() }), onNavigate);
    await screen.findByRole('heading', { name: 'Most Used' });
    const more = within(screen.getByRole('region', { name: 'Recent' })).getByRole('link', {
      name: 'See More',
    });
    expect(more.parentElement!.querySelector('h2')!.textContent).toBe('Recent');
    expect(
      within(screen.getByRole('region', { name: 'Most Used' })).queryByRole('link', {
        name: 'See More',
      }),
    ).toBeNull();
    fireEvent.click(more);
    expect(onNavigate.mock.calls[0]![0]).toMatchObject({ kind: 'recent' });
  });

  it('draws up to eight in each, Most Used ranked and the rest opened in the timeline', async () => {
    renderHome(createFakeIndex({ items: twenty() }));
    await screen.findByRole('heading', { name: 'Most Used' });
    const used = screen.getByRole('region', { name: 'Most Used' });
    expect(cards(used)).toEqual(Array.from({ length: 8 }, (_, k) => `Item ${k + 1}`));
    // The ninth and tenth most used are among the latest opened of the rest.
    expect(rows(screen.getByRole('region', { name: 'Recent' }), 'opened')).toEqual(
      Array.from({ length: 8 }, (_, k) => `Item ${k + 9}`),
    );
    // Most Used's rows carry no picture: the day chart is theirs.
    expect(used.querySelectorAll('li')).toHaveLength(8);
  });

  it('draws each most used item’s 14 days, today on the right, against the busiest day in the list', async () => {
    const days = (opens: Record<number, number>) =>
      Array.from({ length: 14 }, (_, k) => opens[13 - k] ?? 0);
    renderHome(
      createFakeIndex({
        items: [
          opened(1, { useOpens: 9, useDays: 2, useHistory: days({ 0: 8, 3: 1 }) }),
          opened(2, { useOpens: 4, useDays: 1, useHistory: days({ 10: 4 }) }),
          opened(3, { useOpens: 2, useDays: 2 }),
          ...madeLater(),
        ],
      }),
    );
    await screen.findByRole('heading', { name: 'Most Used' });
    const used = screen.getByRole('region', { name: 'Most Used' });
    const charts = [...used.querySelectorAll('[data-day-chart]')];
    // An index that sends no days draws the count alone.
    expect(charts).toHaveLength(2);
    const levels = (chart: Element) =>
      [...chart.querySelectorAll('[data-day-level]')].map((c) => c.getAttribute('data-day-level'));
    expect(levels(charts[0]!)).toEqual([...Array(10).fill('0'), '1', '0', '0', '4']);
    expect(levels(charts[1]!)).toEqual(['0', '0', '0', '2', ...Array(10).fill('0')]);
    expect(charts[0]!.getAttribute('aria-label')).toBe(
      'Opened on 2 of the last 14 days, 8 times today',
    );
    expect(used.textContent).toContain(
      'Each square is a day: 14 days ago on the left, today on the right.',
    );
  });

  it('keeps only what was made in the timeline when Most Used holds everything opened', async () => {
    renderHome(
      createFakeIndex({
        items: [opened(1, { useOpens: 3 }), opened(2, { useOpens: 2 }), ...madeLater()],
      }),
    );
    await screen.findByRole('heading', { name: 'Most Used' });
    expect(rows(section('recent')!, 'opened')).toEqual([]);
    expect(rows(section('recent')!, 'made')).toHaveLength(4);
  });

  it('leaves out Most Used while nothing is most used', async () => {
    renderHome(createFakeIndex({ items: [opened(1), opened(2), ...madeLater()] }));
    await screen.findByRole('heading', { name: 'Recent' });
    expect(section('most-used')).toBeNull();
    expect(rows(section('recent')!, 'opened')).toEqual(['Item 1', 'Item 2']);
  });

  it('draws each section’s placeholders under its own heading while it loads', async () => {
    const index = createFakeIndex({ items: twenty() });
    index.hold.add('listItems');
    renderHome(index);
    await waitFor(() => expect(section('most-used')).not.toBeNull());
    for (const id of ['most-used', 'recent']) {
      const el = section(id)!;
      expect(el.getAttribute('aria-busy')).toBe('true');
      expect(el.querySelector('h2')).not.toBeNull();
    }
    expect(section('most-used')!.querySelectorAll('[aria-hidden] > div')).toHaveLength(5);
    // A day's heading over six rows.
    expect(section('recent')!.querySelectorAll('[data-home-timeline-skeleton] > div')).toHaveLength(
      7,
    );
    expect(screen.queryByRole('link', { name: 'See More' })).toBeNull();
    index.hold.delete('listItems');
    index.release();
    await screen.findByRole('link', { name: 'Item 1' });
    expect(section('most-used')!.getAttribute('aria-busy')).toBe('false');
  });

  it('says once that Home could not load, under Recent, with Try Again', async () => {
    const index = createFakeIndex({ items: twenty() });
    index.fail.set('listItems', new IndexError(500, 'unknown'));
    renderHome(index);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Couldn’t load Home.');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(section('recent')!.contains(alert)).toBe(true);
    expect(section('most-used')).toBeNull();
    expect(screen.queryByRole('link', { name: 'See More' })).toBeNull();
    index.fail.delete('listItems');
    fireEvent.click(within(alert).getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByRole('heading', { name: 'Most Used' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it("says it has nothing with the Explorer's one empty state for the whole view, under no heading", async () => {
    const index = createFakeIndex({ items: [] });
    const { container } = render(
      <Explorer
        app="livedesign"
        client={index.client}
        view={{ kind: 'home' }}
        onNavigate={vi.fn()}
        itemHref={(i) => `/p/${i.id}`}
        onCreate={vi.fn()}
        heroHidden
      />,
    );
    const title = await screen.findByRole('heading', { name: 'No designs yet' });
    expect(title.closest('[data-home-nothing]')).not.toBeNull();
    expect(section('recent')).toBeNull();
    expect(section('most-used')).toBeNull();
    expect(
      screen.getByText('The designs you make, open or have shared with you gather here.'),
    ).toBeTruthy();
    expect(container.querySelector('.border-dashed')).toBeNull();
  });
});
