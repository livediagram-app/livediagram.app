// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThreadSharedChip, otherPlanCardHref } from './ThreadSharedChip';
import { contextOf, fakeThreads, PLAN, thread } from './thread-test-kit';

// The shared chip (docs/specs/026-plan/items.md "Where it shows"): every card a thread is on, each opening.
afterEach(cleanup);

const SHARED = thread('th-a', {
  cards: [
    { projectId: PLAN, itemId: 'card-1', key: 1 },
    { projectId: PLAN, itemId: 'card-2', key: 2 },
    { projectId: 'plan-b', itemId: 'x1', key: 4, projectName: 'Sprint 12' },
  ],
});

function chip() {
  const ctx = contextOf(fakeThreads([SHARED]).threads);
  render(
    <ThreadSharedChip
      thread={SHARED}
      itemId="card-1"
      ctx={ctx}
      titleOf={(id) => (id === 'card-2' ? 'Promo code' : 'Basket')}
    />,
  );
  return ctx;
}

describe('the shared chip', () => {
  it('counts the cards, saying when some are in other plans', () => {
    chip();
    expect(
      screen.getByRole('button', { name: 'On 3 cards, some in other plans: show them' }),
    ).toBeTruthy();
  });

  it('lists the cards: this one marked, this plan’s in the panel, another plan’s in a new tab', () => {
    const ctx = chip();
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null);
    fireEvent.click(screen.getByRole('button', { name: /^On 3 cards/ }));
    expect(screen.getByRole('menuitem', { name: '#1 Basket, this card' })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: '#2 Promo code' }));
    expect(ctx.openCard).toHaveBeenCalledWith('card-2');
    fireEvent.click(screen.getByRole('button', { name: /^On 3 cards/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '#4 in Sprint 12, opens in a new tab' }));
    expect(opened).toHaveBeenCalledWith(
      '/project/plan-b#item=x1&thread=th-a',
      '_blank',
      'noopener',
    );
  });

  it('builds another plan’s link on the card and the thread', () => {
    expect(otherPlanCardHref('p 1', 'i/2', 'th-x')).toBe('/project/p%201#item=i%2F2&thread=th-x');
  });
});
