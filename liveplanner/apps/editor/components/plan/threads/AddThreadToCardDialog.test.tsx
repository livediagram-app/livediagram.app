// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARCHIVED_FIELD, ITEM_TYPES, TRASH_STATUS } from '@liveplanner/items';

vi.mock('@/lib/api/plan-grants', () => ({ planGrant: vi.fn() }));
vi.mock('@/lib/api/items', () => ({ fetchItems: vi.fn() }));

import { planGrant } from '@/lib/api/plan-grants';
import { fetchItems } from '@/lib/api/items';
import { PlanProvider } from '../PlanContext';
import { AddThreadToCardDialog } from './AddThreadToCardDialog';
import { matchesPick, pickCardsOf } from './useThreadCardPicker';
import { card, contextOf, fakeThreads, PLAN, thread } from './thread-test-kit';

// Add Thread to Card (docs/specs/026-plan/items.md "Where it shows"; #82 and the owner's cross-plan rule).
afterEach(cleanup);
beforeEach(() => {
  vi.mocked(planGrant).mockReset();
  vi.mocked(fetchItems).mockReset();
});

const flush = () => act(async () => {});
const ITEMS = [
  card('card-1', 1, 'Basket empties'),
  card('card-2', 2, 'Promo code'),
  card('card-3', 3, 'Apple Pay'),
];
const SPRINT = { id: 'plan-b', name: 'Sprint 12' };

function open(extra: Parameters<typeof contextOf>[1] = {}) {
  const t = thread('th-a');
  const { threads, acts } = fakeThreads([t]);
  const onClose = vi.fn();
  const ctx = contextOf(threads, { otherPlans: [SPRINT], ...extra });
  render(
    <PlanProvider
      value={{ items: new Map(ITEMS.map((i) => [i.id, i])), types: ITEM_TYPES } as never}
    >
      <AddThreadToCardDialog thread={t} ctx={ctx} onClose={onClose} />
    </PlanProvider>,
  );
  return { acts, onClose, ctx };
}

describe('the picker’s cards', () => {
  it('lists live cards newest first, marking the ones the thread is on', () => {
    const items = [
      { ...card('a', 1, 'Old'), updatedAt: 1 },
      { ...card('b', 2, 'New'), updatedAt: 5 },
      { ...card('c', 3, 'Archived'), fields: { title: 'Archived', [ARCHIVED_FIELD]: true } },
      { ...card('d', 4, 'Trashed'), fields: { title: 'Trashed', status: TRASH_STATUS } },
    ];
    const cards = pickCardsOf(items, PLAN, ITEM_TYPES, {
      cards: [{ projectId: PLAN, itemId: 'a', key: 1 }],
    });
    expect(cards.map((c) => [c.itemId, c.onThread])).toEqual([
      ['b', false],
      ['a', true],
    ]);
  });

  it('matches a number, with or without #, a title or a type', () => {
    const [c] = pickCardsOf([card('a', 12, 'Promo maths')], PLAN, ITEM_TYPES, { cards: [] });
    expect(matchesPick(c!, '12')).toBe(true);
    expect(matchesPick(c!, '#12')).toBe(true);
    expect(matchesPick(c!, '#13')).toBe(false);
    expect(matchesPick(c!, 'MATHS')).toBe(true);
    expect(matchesPick(c!, 'task')).toBe(true);
    expect(matchesPick(c!, '')).toBe(true);
    expect(matchesPick(c!, 'bug')).toBe(false);
  });
});

describe('Add Thread to Card', () => {
  it('lists this plan’s cards, the current one already on it', () => {
    open();
    const on = screen.getByRole('button', {
      name: 'Basket empties, Task #1, already on this thread',
    });
    expect(on).toHaveProperty('disabled', true);
    expect(screen.getByText('Already on this card')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Promo code, Task #2' })).toBeTruthy();
  });

  it('narrows by the search', () => {
    open();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search cards and plans' }), {
      target: { value: '#3' },
    });
    expect(screen.queryByRole('button', { name: 'Promo code, Task #2' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Apple Pay, Task #3' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search cards and plans' }), {
      target: { value: 'nothing like it' },
    });
    expect(screen.getByText('No cards here match.')).toBeTruthy();
    expect(screen.getByText('No plans match.')).toBeTruthy();
  });

  it('adds the thread to a card in this plan at once', async () => {
    const { acts, onClose, ctx } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Promo code, Task #2' }));
    await flush();
    expect(acts).toEqual([{ kind: 'addToCard', threadId: 'th-a', itemId: 'card-2' }]);
    expect(ctx.announce).toHaveBeenCalledWith('Added to #2');
    expect(onClose).toHaveBeenCalled();
  });

  it('reads another plan’s cards when opened, and warns before sharing into it', async () => {
    vi.mocked(planGrant).mockResolvedValue({ level: 'edit', tabId: null } as never);
    vi.mocked(fetchItems).mockResolvedValue({
      items: [card('x1', 4, 'Cart service refactor')],
      rev: 1,
      nextKey: 5,
    });
    const { acts, onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Sprint 12' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Cart service refactor, Task #4' }));
    // Nothing is shared until the warning is accepted.
    expect(acts).toEqual([]);
    const warning = screen.getByRole('alertdialog', {
      name: 'Share this thread into “Sprint 12”?',
    });
    expect(warning.textContent).toContain(
      'Everyone who can see #4 in Sprint 12 will be able to read this thread. Participants and Editors there can reply and resolve it; Viewers can only read it.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cart service refactor, Task #4' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share Thread' }));
    await flush();
    expect(acts).toEqual([
      { kind: 'addToCard', threadId: 'th-a', itemId: 'x1', projectId: 'plan-b' },
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it('offers no card in a plan the person may only view, and says when one cannot be read', async () => {
    vi.mocked(planGrant).mockResolvedValueOnce({ level: 'view', tabId: null } as never);
    open({ otherPlans: [SPRINT, { id: 'plan-c', name: 'Broken' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Sprint 12' }));
    await flush();
    expect(screen.getByText('You can only view this plan')).toBeTruthy();
    vi.mocked(planGrant).mockRejectedValueOnce(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Broken' }));
    await flush();
    expect(screen.getByText('Couldn’t read this plan’s cards.')).toBeTruthy();
  });

  it('keeps a This Browser plan’s threads in it', () => {
    open({ offline: true });
    expect(screen.queryByText('Other plans')).toBeNull();
    expect(
      screen.getByText('This plan is saved in this browser, so its threads stay in it.'),
    ).toBeTruthy();
  });

  it('closes on Escape, stepping back from the warning first', async () => {
    vi.mocked(planGrant).mockResolvedValue({ level: 'edit', tabId: null } as never);
    vi.mocked(fetchItems).mockResolvedValue({ items: [card('x1', 4, 'Cart')], rev: 1, nextKey: 5 });
    const { onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Sprint 12' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Cart, Task #4' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
