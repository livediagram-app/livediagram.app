import { describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveplanner/items';
import { duplicateItem } from './duplicate-item';

// A card's Duplicate (docs/specs/026-plan/items.md "Repeating cards" "Duplicate"): a plain copy, without the votes or
// the repeat rule, so a Participant may make it and it never repeats beside its source.
describe('duplicateItem', () => {
  it('copies the card without its votes or its repeat rule', () => {
    const addItem = vi.fn(async () => undefined);
    const announce = vi.fn();
    const item = {
      id: 'i1',
      key: 1,
      type: 'task',
      rank: 'a',
      fields: {
        title: 'Weekly report',
        status: 'todo',
        votes: ['u1'],
        repeat: { freq: 'weekly', days: [1], from: '2026-11-02', zone: 'Europe/London' },
      },
    } as unknown as Item;
    duplicateItem({ addItem, announce } as never, item);
    expect(addItem).toHaveBeenCalledWith({
      type: 'task',
      fields: { title: 'Weekly report', status: 'todo' },
      status: 'todo',
      after: 'i1',
    });
    expect(announce).toHaveBeenCalledWith('Card duplicated');
  });
});
