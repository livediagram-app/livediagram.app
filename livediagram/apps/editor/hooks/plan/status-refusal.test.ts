import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import {
  cardsMovingRefused,
  cardsStayedMessage,
  moveStatusRefusal,
  typeStatusRefusal,
} from './status-refusal';

// docs/specs/026-plan/item-types.md "An item type": only a move into a left-out status is refused.
const types = ITEM_TYPES.map((t) => (t.id === 'task' ? { ...t, excludedStatuses: ['done'] } : t));
const name = (s: string) => ({ todo: 'To Do', done: 'Done' })[s] ?? s;
const card = (id: string, type: string, status?: string): Pick<Item, 'id' | 'type' | 'fields'> => ({
  id,
  type,
  fields: status ? { title: id, status } : { title: id },
});

describe('typeStatusRefusal', () => {
  it('refuses a left-out status by name, and lets any other through', () => {
    expect(typeStatusRefusal(types, 'task', 'done', name)).toBe("Task cards can't be Done");
    expect(typeStatusRefusal(types, 'task', 'todo', name)).toBeNull();
    expect(typeStatusRefusal(types, 'note', 'done', name)).toBeNull();
    expect(typeStatusRefusal(types, 'task', null, name)).toBeNull();
  });
});

describe('moveStatusRefusal', () => {
  it('never refuses the status the card is in: it may be reordered there or change lanes', () => {
    expect(
      moveStatusRefusal(types, card('a', 'task', 'done'), { status: 'done' }, name),
    ).toBeNull();
    expect(moveStatusRefusal(types, card('a', 'task', 'done'), {}, name)).toBeNull();
    expect(
      moveStatusRefusal(types, card('a', 'task', 'done'), { status: 'todo' }, name),
    ).toBeNull();
  });

  it('refuses a move into a left-out status', () => {
    expect(moveStatusRefusal(types, card('a', 'task', 'todo'), { status: 'done' }, name)).toBe(
      "Task cards can't be Done",
    );
  });

  it('checks the type a swimlane by type gives the card, not the one it has', () => {
    expect(
      moveStatusRefusal(types, card('a', 'note', 'todo'), { status: 'done', type: 'task' }, name),
    ).toBe("Task cards can't be Done");
    expect(
      moveStatusRefusal(types, card('a', 'task', 'todo'), { status: 'done', type: 'note' }, name),
    ).toBeNull();
  });
});

describe('a removed column’s cards', () => {
  it('names the cards whose type leaves the target out, and says so once', () => {
    const cards = [
      card('a', 'task', 'doing'),
      card('b', 'note', 'doing'),
      card('c', 'task', 'doing'),
    ];
    expect([...cardsMovingRefused(cards, types, 'done')]).toEqual(['a', 'c']);
    expect(cardsMovingRefused(cards, types, 'todo').size).toBe(0);
    expect(cardsStayedMessage(1, 'Done')).toBe("1 card stayed: its type can't be Done");
    expect(cardsStayedMessage(2, 'Done')).toBe("2 cards stayed: their types can't be Done");
  });
});
