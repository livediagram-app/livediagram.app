import { describe, expect, it } from 'vitest';
import { withEditorModeSwitched } from './editor-mode-switch';
import type { Element, Tab } from './index';

// docs/specs/007-editor/editor-modes.md "Where the mode lives": a switch is one tab edit.
const sticky = (id: string, x: number) =>
  ({ id, type: 'sticky', x, y: 0, width: 150, height: 92 }) as unknown as Element;
const tab = (elements: Element[], extra: Partial<Tab> = {}): Tab => ({
  id: 't',
  name: 'T',
  elements,
  ...extra,
});

describe('withEditorModeSwitched', () => {
  it('sets the mode and leaves the elements as they are', () => {
    const board = tab([sticky('a', -1500), sticky('b', 1500)]);
    const out = withEditorModeSwitched(board, 'draw');
    expect(out.tab.opensIn).toBe('draw');
    expect(out.tab.elements).toBe(board.elements);
  });

  it('returns the same tab when it is already in the mode, or is an event-storming board', () => {
    const inDraw = tab([], { opensIn: 'draw' });
    expect(withEditorModeSwitched(inDraw, 'draw').tab).toBe(inDraw);
    const es = tab([], { kind: 'event-storming' });
    expect(withEditorModeSwitched(es, 'workshop').tab).toBe(es);
  });
});
