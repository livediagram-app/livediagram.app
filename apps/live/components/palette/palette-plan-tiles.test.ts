import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef } from '@livediagram/items';
import { PLAN_TILES, planCardTile, withDocumentCardTiles } from './palette-plan-tiles';

// docs/specs/025-plan/item-types.md "Where types show".
describe('card tiles from the document', () => {
  const call: ItemTypeDef = {
    id: 'customer-call',
    label: 'Customer call',
    newTitle: 'New customer call',
    glyph: 'chat',
    color: '#0891b2',
    fields: ['title', 'status'],
  };

  it('makes a tile per type that places a card of it', () => {
    expect(planCardTile(call)).toMatchObject({
      id: 'plan:card-customer-call',
      caption: 'Customer call card',
      section: 'plan-cards',
      action: { type: 'shape', kind: 'plan-card', plan: 'customer-call' },
    });
  });

  it('follows a renamed type and drops a deleted one, leaving other tiles alone', () => {
    const renamed = ITEM_TYPES.filter((t) => t.id !== 'bug').map((t) =>
      t.id === 'task' ? { ...t, label: 'Chore' } : t,
    );
    const tiles = withDocumentCardTiles(PLAN_TILES, renamed);
    expect(tiles.find((t) => t.id === 'plan:card-task')?.caption).toBe('Chore card');
    expect(tiles.some((t) => t.id === 'plan:card-bug')).toBe(false);
    expect(tiles.some((t) => t.id === 'plan:board-kanban')).toBe(true);
  });
});
