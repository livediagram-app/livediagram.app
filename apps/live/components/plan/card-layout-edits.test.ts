import { describe, expect, it } from 'vitest';
import { addCardField, moveCardField, neighbourSlot, removeCardField } from './card-layout-edits';

// docs/specs/026-plan/item-types.md "Editing a type": Display's layout edits.
describe('card layout edits', () => {
  it('adds a field to its default slot, once', () => {
    const one = addCardField('detailed', {}, 'due');
    expect(one).toEqual({ foot: ['due'] });
    expect(addCardField('detailed', one, 'due')).toBe(one);
  });

  it('moves a field to a slot at a place, and refuses where it does not fit', () => {
    const layout = { head: ['type', 'key'] as const, foot: ['due'] as const };
    expect(moveCardField('detailed', layout, 'due', 'head', 1)).toEqual({
      head: ['type', 'due', 'key'],
    });
    expect(moveCardField('detailed', layout, 'key', 'head', 0)).toEqual({
      head: ['key', 'type'],
      foot: ['due'],
    });
    const desc = { body: ['description'] as const };
    expect(moveCardField('detailed', desc, 'description', 'foot', 0)).toBe(desc);
  });

  it('takes a field off, dropping a slot left empty', () => {
    expect(removeCardField({ foot: ['due'], head: ['key'] }, 'due')).toEqual({ head: ['key'] });
  });

  it('finds the slot before or after that takes a field', () => {
    expect(neighbourSlot('detailed', 'foot', 'due', -1)).toBe('body');
    expect(neighbourSlot('detailed', 'body', 'description', 1)).toBeNull();
    expect(neighbourSlot('minimal', 'lead', 'due', -1)).toBeNull();
  });
});
