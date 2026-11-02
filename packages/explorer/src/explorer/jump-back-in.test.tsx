// Jump Back In: Most Used (the items opened most often in the last 14 days, "Opened N times"), then Recent (the
// latest opened of the rest), up to eight each, four across on a desktop, from one request; the phone strip
// alternates them, at most eight.
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMostUsed, jumpBackInLine, jumpBackInSet } from '../data/viewLists';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { Explorer } from './Explorer';
import { phoneOrder } from './HomePane';

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

  it('alternates the groups on a phone', () => {
    const items = [{ ...opened(1), useDays: 3 }, { ...opened(2), useDays: 2 }, opened(3)];
    expect(phoneOrder(items).map((i) => i.id)).toEqual(['item-1', 'item-3', 'item-2']);
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

const renderHome = (index: ReturnType<typeof createFakeIndex>) =>
  render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'home' }}
      onNavigate={vi.fn()}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      heroHidden
    />,
  );

describe('Home', () => {
  it('draws Most Used then Recent from one Recent request that carries Most Used', async () => {
    const items = [
      opened(1, { useOpens: 2, useDays: 2 }),
      opened(2, { useOpens: 9, useDays: 1 }),
      opened(3),
      opened(4),
      makeItem(5),
    ];
    const index = createFakeIndex({ items });
    render(
      <Explorer
        app="liveplanner"
        client={index.client}
        view={{ kind: 'home' }}
        onNavigate={vi.fn()}
        itemHref={(i) => `/p/${i.id}`}
        onCreate={vi.fn()}
        heroHidden
      />,
    );
    const mostUsed = await screen.findByRole('heading', { name: 'Most Used' });
    const used = mostUsed.parentElement!;
    expect(
      within(used)
        .getAllByRole('link')
        .map((a) => a.getAttribute('aria-label')),
    ).toEqual(['Item 2', 'Item 1']);
    expect(used.textContent).toContain('Opened 9 times');
    const recent = screen.getByRole('heading', { name: 'Recent' }).parentElement!;
    expect(
      within(recent)
        .getAllByRole('link')
        .map((a) => a.getAttribute('aria-label')),
    ).toEqual(['Item 3', 'Item 4']);
    await waitFor(() => expect(index.count('listItems')).toBe(1));
    expect(index.calls.find((c) => c.method === 'listItems')!.args[0]).toMatchObject({
      view: 'recent',
      used: 8,
      limit: 16,
    });
  });

  it('draws up to eight in each group, four across on a desktop', async () => {
    renderHome(createFakeIndex({ items: twenty() }));
    const used = (await screen.findByRole('heading', { name: 'Most Used' })).parentElement!;
    const recent = screen.getByRole('heading', { name: 'Recent' }).parentElement!;
    const labels = (group: HTMLElement) =>
      within(group)
        .getAllByRole('link')
        .map((a) => a.getAttribute('aria-label'));
    expect(labels(used)).toEqual(Array.from({ length: 8 }, (_, k) => `Item ${k + 1}`));
    // The ninth and tenth most used are among the latest opened of the rest.
    expect(labels(recent)).toEqual(Array.from({ length: 8 }, (_, k) => `Item ${k + 9}`));
    expect(used.querySelector('ul')!.className).toContain('lg:grid-cols-4');
  });

  it('keeps the phone to one strip of at most eight, the groups alternating', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const { container } = renderHome(createFakeIndex({ items: twenty() }));
    await screen.findByRole('link', { name: 'Item 1' });
    const tiles = [...container.querySelectorAll('[data-home-section="jump-back-in"] li a')].map(
      (a) => a.getAttribute('aria-label'),
    );
    expect(tiles).toEqual([
      'Item 1',
      'Item 9',
      'Item 2',
      'Item 10',
      'Item 3',
      'Item 11',
      'Item 4',
      'Item 12',
    ]);
    expect(screen.queryByRole('heading', { name: 'Most Used' })).toBeNull();
    expect(screen.getByRole('link', { name: /See More/ })).toBeTruthy();
  });

  it("says it has nothing with the Explorer's one empty state, not a box of its own", async () => {
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
    expect(title.closest('[data-empty-state="compact"]')).not.toBeNull();
    expect(screen.getByText('The designs you open will gather here.')).toBeTruthy();
    expect(container.querySelector('.border-dashed')).toBeNull();
  });
});
