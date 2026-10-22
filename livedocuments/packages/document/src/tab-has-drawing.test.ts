import { describe, expect, it } from 'vitest';
import { tabHasDrawing } from './tab-has-drawing';

// docs/specs/009-elements/tab-window.md "States", docs/specs/007-editor/split-view.md "The other pane".

describe('tabHasDrawing', () => {
  it('draws every tab: one with elements, and an empty one (it always has a page)', () => {
    expect(tabHasDrawing({ elements: [{ id: 'a' }] })).toBe(true);
    expect(tabHasDrawing({ elements: [] })).toBe(true);
    expect(tabHasDrawing({ elements: [], opensIn: 'draw' })).toBe(true);
  });
});
