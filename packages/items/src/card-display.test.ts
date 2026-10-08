import { describe, expect, it } from 'vitest';
import {
  cardDisplayFields,
  cardLayoutFields,
  cardSlotFits,
  defaultCardLayout,
  readCardDisplay,
  sameCardLayout,
  typeCardDisplay,
  typeOffersCardField,
} from './card-display';
import { ITEM_TYPES } from './item-types';
import { validateItemTypeCatalogue } from './type-catalogue';

// docs/specs/026-plan/item-types.md "Card display".
const task = ITEM_TYPES.find((t) => t.id === 'task')!;

describe('card display', () => {
  it('gives the built-in types their own defaults, and any other type the generic one', () => {
    expect(cardLayoutFields('compact', defaultCardLayout('note', 'compact'))).toEqual([
      'type',
      'votes',
      'comments',
    ]);
    expect(defaultCardLayout('task', 'minimal')).toEqual({});
    expect(cardLayoutFields('detailed', defaultCardLayout('bug', 'detailed'))).toContain(
      'estimate',
    );
  });

  it('uses a type’s own Display for a size it sets', () => {
    expect(
      typeCardDisplay({ ...task, display: { minimal: { trail: ['due'] } } }, 'minimal'),
    ).toEqual(['due']);
    expect(typeCardDisplay(task, 'compact')).toEqual(
      cardLayoutFields('compact', defaultCardLayout('task', 'compact')),
    );
  });

  it('stores a size only when it differs from the default, with each field where it fits, once', () => {
    expect(readCardDisplay({ minimal: { trail: ['due', 'key'] } }, 'task')).toEqual({
      minimal: { trail: ['due', 'key'] },
    });
    expect(readCardDisplay({ minimal: {} }, 'task')).toBeUndefined();
    expect(readCardDisplay({ minimal: { trail: ['labels'] } }, 'task')).toBeNull();
    expect(readCardDisplay({ minimal: { lead: ['description'] } }, 'task')).toBeNull();
    expect(readCardDisplay({ detailed: { head: ['key'], foot: ['key'] } }, 'task')).toBeNull();
    expect(readCardDisplay({ compact: { nowhere: [] } }, 'task')).toBeNull();
    expect(readCardDisplay({ huge: {} }, 'task')).toBeNull();
    const ok = validateItemTypeCatalogue({
      version: 1,
      types: [{ ...task, display: { compact: { row: ['key'] } } }],
    });
    expect(ok.ok && ok.catalogue.types[0]!.display).toEqual({ compact: { row: ['key'] } });
  });

  it('places a default where a board drew it, and says what each size can draw', () => {
    expect(defaultCardLayout('task', 'detailed')).toMatchObject({
      head: ['type', 'key'],
      headEnd: ['priority'],
      body: ['parent', 'description', 'labels'],
    });
    expect(cardDisplayFields('minimal')).toEqual(['key', 'priority', 'due', 'assignee']);
    expect(cardSlotFits('detailed', 'foot', 'description')).toBe(true);
    expect(cardSlotFits('compact', 'row', 'description')).toBe(false);
  });

  it('says which fields a type can show', () => {
    const note = ITEM_TYPES.find((t) => t.id === 'note')!;
    expect(typeOffersCardField(note, 'key')).toBe(true);
    expect(typeOffersCardField(note, 'assignee')).toBe(false);
  });

  it('compares layouts slot by slot, order included', () => {
    expect(sameCardLayout('compact', { row: ['due', 'votes'] }, { row: ['due', 'votes'] })).toBe(
      true,
    );
    expect(sameCardLayout('compact', { row: ['due', 'votes'] }, { row: ['votes', 'due'] })).toBe(
      false,
    );
  });
});

describe('Compact’s bottom right', () => {
  it('holds the assignee by default, and takes any compact field', () => {
    expect(defaultCardLayout('task', 'compact').trail).toEqual(['assignee']);
    expect(defaultCardLayout('task', 'compact').row).not.toContain('assignee');
    expect(cardSlotFits('compact', 'trail', 'due')).toBe(true);
  });
});
