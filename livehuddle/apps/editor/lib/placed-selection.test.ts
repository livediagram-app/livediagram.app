import { describe, expect, it } from 'vitest';
import { placedSelection } from './placed-selection';

// docs/specs/009-elements/office.md "Placing selects every piece".
describe('placedSelection', () => {
  it('selects a lone piece on its own', () => {
    expect(placedSelection([{ id: 'chair' }])).toEqual({
      selectedId: 'chair',
      multiSelectedIds: new Set(),
    });
  });

  it('selects every piece of a multi-piece insert together', () => {
    expect(placedSelection([{ id: 'room' }, { id: 'door' }, { id: 'desk' }])).toEqual({
      selectedId: null,
      multiSelectedIds: new Set(['room', 'door', 'desk']),
    });
  });

  it('selects nothing for nothing placed', () => {
    expect(placedSelection([])).toEqual({ selectedId: null, multiSelectedIds: new Set() });
  });
});
