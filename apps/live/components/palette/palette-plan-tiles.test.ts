import { describe, expect, it } from 'vitest';
import type { ItemTypeDef } from '@livediagram/items';
import { PLAN_BOARD_PRESET_IDS } from '@livediagram/items';
import { PLAN_BOARD_TILES, PLAN_TILES, planCardTile } from './palette-plan-tiles';

// docs/specs/026-plan/item-types.md "Where types show".
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

// docs/specs/026-plan/plan-mode.md "Starting a board": one list of board types, All Cards always last.
describe('the board tiles', () => {
  const boards = PLAN_TILES.filter((t) => t.section === 'plan-boards').map((t) => t.id);

  it('offer a tile for every preset, the To-do List after Kanban', () => {
    expect(PLAN_BOARD_TILES.map((t) => t.preset).sort()).toEqual([...PLAN_BOARD_PRESET_IDS].sort());
    expect(boards.indexOf('plan:board-todo')).toBe(boards.indexOf('plan:board-kanban') + 1);
  });

  it('end with All Cards: in the presets, the palette and Start with a Board', () => {
    expect(PLAN_BOARD_PRESET_IDS.at(-1)).toBe('all-cards');
    expect(boards.at(-1)).toBe('plan:board-all-cards');
    // Start with a Board is this list without Archive.
    const picker = PLAN_BOARD_TILES.filter((t) => t.preset !== 'archive').map((t) => t.preset);
    expect(picker.at(-1)).toBe('all-cards');
  });
});
