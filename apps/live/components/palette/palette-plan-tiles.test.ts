import { describe, expect, it } from 'vitest';
import type { ItemTypeDef } from '@livediagram/items';
import { planCardTile } from './palette-plan-tiles';

// docs/specs/025-plan/item-types.md "Where types show".
describe('card tiles from the document', () => {
  it('makes a tile per type that places a card of it', () => {
    const call: ItemTypeDef = {
      id: 'customer-call',
      label: 'Customer call',
      newTitle: 'New customer call',
      glyph: 'chat',
      color: '#0891b2',
      fields: ['title', 'status'],
    };
    expect(planCardTile(call)).toMatchObject({
      id: 'plan:card-customer-call',
      caption: 'Customer call Card',
      section: 'plan-cards',
      action: { type: 'shape', kind: 'plan-card', plan: 'customer-call' },
    });
  });
});
