import { describe, expect, it } from 'vitest';
import { tabHasDrawing } from './tab-has-drawing';

// docs/specs/007-editor/split-view.md "The other pane".

describe('tabHasDrawing', () => {
  it('draws a tab with elements, and nothing for an empty one', () => {
    expect(tabHasDrawing({ elements: [{ id: 'a' }] })).toBe(true);
    expect(tabHasDrawing({ elements: [] })).toBe(false);
  });
});
