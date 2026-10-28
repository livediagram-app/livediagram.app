// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ARCHIVED_FIELD, ITEM_TYPES, TRASH_STATUS } from '@liveplanner/items';
import { PlanProvider } from '../PlanContext';
import { AddThreadToCardDialog } from './AddThreadToCardDialog';
import { matchesPick, pickCardsOf } from './useThreadCardPicker';
import { card, contextOf, fakeThreads, PLAN, thread } from './thread-test-kit';

// Add Thread to Card (docs/specs/026-plan/items.md "Where it shows"): this plan's cards only (owner, 2026-10-28).
afterEach(cleanup);

const flush = () => act(async () => {});
const ITEMS = [
  card('card-1', 1, 'Basket empties'),
  card('card-2', 2, 'Promo code'),
  card('card-3', 3, 'Apple Pay'),
];
function open(extra: Parameters<typeof contextOf>[1] = {}) {
  const t = thread('th-a');
  const { threads, acts } = fakeThreads([t]);
  const onClose = vi.fn();
  const ctx = contextOf(threads, extra);
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

  it('offers no other plan', () => {
    open();
    expect(screen.queryByText('Other plans')).toBeNull();
    expect(screen.getAllByRole('list')).toHaveLength(1);
    expect(screen.getByRole('list', { name: 'Cards in this plan' })).toBeTruthy();
  });

  it('narrows by the search', () => {
    open();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search cards' }), {
      target: { value: '#3' },
    });
    expect(screen.queryByRole('button', { name: 'Promo code, Task #2' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Apple Pay, Task #3' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search cards' }), {
      target: { value: 'nothing like it' },
    });
    expect(screen.getByText('No cards match.')).toBeTruthy();
  });

  it('adds the thread to a card in this plan at once', async () => {
    const { acts, onClose, ctx } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Promo code, Task #2' }));
    await flush();
    expect(acts).toEqual([{ kind: 'addToCard', threadId: 'th-a', itemId: 'card-2' }]);
    expect(ctx.announce).toHaveBeenCalledWith('Added to #2');
    expect(onClose).toHaveBeenCalled();
  });

  it('stays open when the write is refused', async () => {
    const t = thread('th-a');
    const { threads, acts } = fakeThreads([t]);
    const refused = {
      ...threads,
      act: vi.fn(async (a: unknown) => (acts.push(a as never), false)),
    };
    const onClose = vi.fn();
    const ctx = contextOf(refused as never);
    render(
      <PlanProvider
        value={{ items: new Map(ITEMS.map((i) => [i.id, i])), types: ITEM_TYPES } as never}
      >
        <AddThreadToCardDialog thread={t} ctx={ctx} onClose={onClose} />
      </PlanProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Promo code, Task #2' }));
    await flush();
    expect(acts).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(ctx.announce).not.toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const { onClose } = open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
