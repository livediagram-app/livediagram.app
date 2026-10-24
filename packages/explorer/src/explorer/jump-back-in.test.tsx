// Jump Back In: Most Used (the items opened on the most days, "Used on N days") as large cards, then Recent (the
// latest opened of the rest) as compact ones, at most four each, from one request; the phone strip alternates them.
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { isMostUsed, jumpBackInLine, jumpBackInSet } from '../data/viewLists';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { Explorer } from './Explorer';
import { phoneOrder } from './HomePane';

const opened = (i: number, extra = {}) => makeItem(i, { lastOpenedAt: 5_000_000 - i, ...extra });

describe('jumpBackInSet', () => {
  it('takes four most used, then four recent not among them, padding nothing', () => {
    const used = [3, 1, 7, 9, 11].map((i) => ({ id: `u${i}`, useDays: 12 - i }));
    const recent = [1, 2, 3, 4, 5, 6].map((i) => ({ id: i === 1 ? 'u1' : `r${i}` }));
    expect(jumpBackInSet(used, recent).map((i) => i.id)).toEqual([
      'u3',
      'u1',
      'u7',
      'u9',
      'r2',
      'r3',
      'r4',
      'r5',
    ]);
    expect(jumpBackInSet([], recent.slice(0, 2)).map((i) => i.id)).toEqual(['u1', 'r2']);
    // A most used item needs a day in the window.
    expect(jumpBackInSet([{ id: 'x', useDays: 0 }], [])).toEqual([]);
  });

  it('says why each card is there', () => {
    const now = 10 * 3_600_000;
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
  });
});

describe('Home', () => {
  it('draws Most Used then Recent from one Recent request that carries Most Used', async () => {
    const items = [
      opened(1, { useDays: 2 }),
      opened(2, { useDays: 9 }),
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
    expect(used.textContent).toContain('Used on 9 days');
    const recent = screen.getByRole('heading', { name: 'Recent' }).parentElement!;
    expect(
      within(recent)
        .getAllByRole('link')
        .map((a) => a.getAttribute('aria-label')),
    ).toEqual(['Item 3', 'Item 4']);
    await waitFor(() => expect(index.count('listItems')).toBe(1));
    expect(index.calls.find((c) => c.method === 'listItems')!.args[0]).toMatchObject({
      view: 'recent',
      used: 4,
      limit: 8,
    });
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
