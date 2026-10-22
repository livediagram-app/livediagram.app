import { describe, expect, it } from 'vitest';
import { tabHasDrawing } from './tab-has-drawing';

// docs/specs/009-elements/tab-window.md "States", docs/specs/007-editor/split-view.md "The other pane".

describe('tabHasDrawing', () => {
  it('draws a tab with elements and a Form tab with its form', () => {
    const el = { id: 'a' };
    expect(tabHasDrawing({ elements: [el] })).toBe(true);
    expect(tabHasDrawing({ elements: [] })).toBe(false);
    expect(tabHasDrawing({ elements: [], kind: 'form', form: { v: 1 } })).toBe(true);
    expect(tabHasDrawing({ elements: [], kind: 'form' })).toBe(false);
    expect(tabHasDrawing({ elements: [], kind: 'board' })).toBe(false);
  });
});
