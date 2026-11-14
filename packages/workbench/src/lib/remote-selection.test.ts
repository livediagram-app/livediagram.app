import { describe, expect, it } from 'vitest';
import { heldElementIds, remoteSelectionOf } from './remote-selection';

// docs/specs/007-editor/editor-app.md "The whole selection holds" (every product).

describe('remoteSelectionOf', () => {
  it('keeps only string ids, capped, and leaves an empty list out', () => {
    expect(
      remoteSelectionOf({ elementId: 'a', tabId: 't1', elementIds: ['a', 7, 'b', 'c'] }, 2),
    ).toEqual({ elementId: 'a', tabId: 't1', elementIds: ['a', 'b'] });
    expect(remoteSelectionOf({ elementId: null, elementIds: [] }, 5)).toEqual({
      elementId: null,
      tabId: undefined,
    });
    expect(remoteSelectionOf({ elementId: 'a', elementIds: 'a' }, 5)).toEqual({
      elementId: 'a',
      tabId: undefined,
    });
  });
});

describe('heldElementIds', () => {
  it('holds the whole list, else the primary element, else nothing', () => {
    // A held element let go of has no primary element, and still holds.
    expect(heldElementIds({ elementId: null, elementIds: ['x', 'x', 'y'] })).toEqual(['x', 'y']);
    expect(heldElementIds({ elementId: 'a' })).toEqual(['a']);
    expect(heldElementIds({ elementId: null })).toEqual([]);
  });
});
