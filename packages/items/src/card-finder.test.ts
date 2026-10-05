import { describe, expect, it } from 'vitest';
import { cardMatches, findCards, isOffBoard } from './card-finder';
import { item } from './test-items';

// docs/specs/026-plan/items.md "Finding a card".
describe('card finder', () => {
  const onBoard = {
    ...item({ title: 'Checkout flow', status: 'todo', description: 'Fewer fields' }),
    updatedAt: 1,
  };
  const orphan = { ...item({ title: 'Lost card', status: 'old~x1' }), updatedAt: 3 };
  const noStatus = { ...item({ title: 'Loose' }), updatedAt: 2 };
  const archived = item({ title: 'Archived', status: 'todo', archived: true });
  const trashed = item({ title: 'Binned', status: 'trash' });
  const all = [onBoard, orphan, noStatus, archived, trashed];
  const boardStatuses = new Set(['todo', 'done']);

  it('lists live cards, newest change first', () => {
    expect(
      findCards(all, { query: '', show: 'all', boardStatuses }).map((i) => i.fields['title']),
    ).toEqual(['Lost card', 'Loose', 'Checkout flow']);
  });

  it('narrows to cards no column holds', () => {
    expect(isOffBoard(onBoard, boardStatuses)).toBe(false);
    expect(isOffBoard(noStatus, boardStatuses)).toBe(true);
    expect(findCards(all, { query: '', show: 'off-board', boardStatuses })).toHaveLength(2);
  });

  it('matches on number, title and description', () => {
    expect(cardMatches(onBoard, `#${onBoard.key}`)).toBe(true);
    expect(cardMatches(onBoard, 'CHECKOUT')).toBe(true);
    expect(cardMatches(onBoard, 'fewer')).toBe(true);
    expect(cardMatches(onBoard, 'nothing like it')).toBe(false);
    expect(cardMatches(noStatus, '   ')).toBe(true);
  });

  it('searches a full store of long descriptions within a keystroke budget', () => {
    const many = Array.from({ length: 2000 }, (_, n) =>
      item({ title: `Card ${n}`, status: 'todo', description: 'x'.repeat(10_000) }),
    );
    findCards(many, { query: 'warm', show: 'all', boardStatuses });
    const start = performance.now();
    for (const q of ['c', 'ca', 'car', 'card', 'card 1', 'card 19']) {
      findCards(many, { query: q, show: 'all', boardStatuses });
    }
    // Six keystrokes over the cached text (17ms locally); the budget leaves room for a slow CI runner.
    expect(performance.now() - start).toBeLessThan(600);
  });
});
