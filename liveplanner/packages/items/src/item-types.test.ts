import { describe, expect, it } from 'vitest';
import { ITEM_TYPES } from './item-types';
import { defaultNewTitle } from './type-catalogue';

describe('built-in card types', () => {
  it('title a new card after its own type ("New project" for a Project, never the plan it is on)', () => {
    for (const type of ITEM_TYPES) expect(type.newTitle, type.id).toBe(defaultNewTitle(type.label));
  });
});
