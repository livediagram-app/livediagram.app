import { describe, expect, it } from 'vitest';
import { PLACEMENT_REJECTIONS, isPlacementRejection } from './placement';

// The named refusals of a create's placement (docs/specs/013-workspace/folders.md "Placement on
// create"): the api answers them, the editor branches on them, so both read one list.
describe('placement rejections', () => {
  it('names every refusal the spec lists', () => {
    expect([...PLACEMENT_REJECTIONS].sort()).toEqual([
      'folder_not_found',
      'folder_scope_mismatch',
      'placement_invalid',
      'team_forbidden',
    ]);
  });

  it('recognises a placement token and nothing else', () => {
    expect(isPlacementRejection('team_forbidden')).toBe(true);
    expect(isPlacementRejection('forbidden')).toBe(false);
    expect(isPlacementRejection(null)).toBe(false);
  });
});
