import { describe, expect, it } from 'vitest';
import {
  CARD_FIELD_LABELS,
  cardSlotFits,
  readCardDisplay,
  typeCardDisplay,
  typeOffersCardField,
} from './card-display';
import { ITEM_TYPES } from './item-types';

// Age on a card (docs/specs/026-plan/item-types.md "Card display").
const task = ITEM_TYPES.find((t) => t.id === 'task')!;

describe('Age in a Display', () => {
  it('is offered on every type at both sizes, and placed in no default', () => {
    expect(typeOffersCardField({ fields: ['title'] }, 'age')).toBe(true);
    expect(cardSlotFits('minimal', 'trail', 'age')).toBe(true);
    expect(cardSlotFits('detailed', 'foot', 'age')).toBe(true);
    for (const type of [...ITEM_TYPES, { ...task, id: 'bug' }])
      for (const size of ['minimal', 'detailed'] as const)
        expect(typeCardDisplay(type, size)).not.toContain('age');
    expect(CARD_FIELD_LABELS.age).toBe('Age');
  });

  it('is kept where a Display places it', () => {
    const display = readCardDisplay({ minimal: { trail: ['age'] } }, 'task');
    expect(display).toEqual({ minimal: { trail: ['age'] } });
    expect(typeCardDisplay({ ...task, display: display! }, 'minimal')).toEqual(['age']);
  });
});
