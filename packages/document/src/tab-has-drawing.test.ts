import { describe, expect, it } from 'vitest';
import { tabHasDrawing } from './tab-has-drawing';

// docs/specs/009-elements/tab-window.md "States", docs/specs/007-editor/split-view.md "The other pane".

describe('tabHasDrawing', () => {
  it('draws a tab with elements, a tab in Pages (it always has a page) and a Form tab with its form', () => {
    const el = { id: 'a' };
    expect(tabHasDrawing({ elements: [el] })).toBe(true);
    expect(tabHasDrawing({ elements: [] })).toBe(false);
    expect(tabHasDrawing({ elements: [], opensIn: 'draw' })).toBe(false);
    expect(tabHasDrawing({ elements: [], opensIn: 'pages' })).toBe(true);
    expect(tabHasDrawing({ elements: [], kind: 'form', form: { v: 1 } })).toBe(true);
    expect(tabHasDrawing({ elements: [], kind: 'form' })).toBe(false);
    // A Plan tab is in Plan, never Pages, whatever a stale `opensIn` says.
    expect(tabHasDrawing({ elements: [], kind: 'board', opensIn: 'pages' })).toBe(false);
  });
});
