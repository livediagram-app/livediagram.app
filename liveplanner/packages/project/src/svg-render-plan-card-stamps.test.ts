import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, dayLabel, type Item, type ItemTypeDef } from '@liveplanner/items';
import { planPalette } from './plan-palette';
import { planCardFace } from './svg-render-plan-card';

// A card's stamps in exports and thumbnails (docs/specs/026-plan/items.md "Created and Last Edited", item-types.md
// "Card display"): the days as muted pills, the people as their discs, nothing for a card without one.

const MADE = new Date(2026, 9, 3, 14).getTime();
const EDITED = new Date(2026, 9, 31, 9).getTime();
const palette = planPalette('light');
const task = ITEM_TYPES.find((t) => t.id === 'task')!;
const stamped: ItemTypeDef = {
  ...task,
  display: { detailed: { foot: ['createdAt', 'updatedAt'], footEnd: ['createdBy', 'updatedBy'] } },
};
const types = ITEM_TYPES.map((t) => (t.id === 'task' ? stamped : t));
const SAM = { id: 'p-sam', name: 'Sam Lee', color: '#2563eb' };
const ALI = { id: 'p-ali', name: 'Ali Khan', color: '#dc2626' };

const card = (extra: Partial<Item> = {}): Item => ({
  id: 'c1',
  type: 'task',
  key: 3,
  rank: 'i',
  fields: { title: 'Stamped' },
  rev: 1,
  createdAt: MADE,
  updatedAt: EDITED,
  createdBy: SAM,
  updatedBy: ALI,
  ...extra,
});
// A board's old field list leaves them out: the type's Display alone decides, as for Age.
const face = (c: Item) =>
  planCardFace(c, 0, 0, 300, { palette, types, boardFields: ['key', 'due'] }).svg;

describe('stamps on an exported card', () => {
  it('draws when it was made and last edited, and who by', () => {
    const svg = face(card());
    expect(svg).toContain(`Created ${dayLabel('2026-10-03')}`);
    expect(svg).toContain(`Edited ${dayLabel('2026-10-31')}`);
    expect(svg).toContain('>SL<');
    expect(svg).toContain('>AK<');
  });

  it('draws nothing for a stamp the card does not hold', () => {
    const lost = { id: '', name: 'Someone', color: '#94a3b8' };
    const svg = face(card({ createdAt: 0, updatedAt: 0, createdBy: lost, updatedBy: lost }));
    expect(svg).not.toContain('Created ');
    expect(svg).not.toContain('Edited ');
    expect(svg).not.toContain('>S<');
  });
});
