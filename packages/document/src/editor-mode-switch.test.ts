import { describe, expect, it } from 'vitest';
import { withEditorModeSwitched } from './editor-mode-switch';
import type { Element, Tab } from './index';

// docs/specs/007-editor/editor-modes.md "Where the mode lives": a switch is one tab edit.
const sticky = (id: string, x: number) =>
  ({ id, type: 'sticky', x, y: 0, width: 150, height: 92 }) as unknown as Element;
const tab = (elements: Element[], extra: Partial<Tab> = {}): Tab =>
  ({ id: 't', name: 'T', elements, ...extra }) as Tab;

describe('withEditorModeSwitched', () => {
  it('sets the mode, and on entering Illustrate puts a wide board on a page in the same edit', () => {
    const board = tab([sticky('a', -1500), sticky('b', 1500)]);
    const out = withEditorModeSwitched(board, 'illustrate');
    expect(out.pagedContent).toBe(true);
    expect(out.tab.opensIn).toBe('illustrate');
    expect(out.tab.pages).toHaveLength(1);
    expect(out.tab.elements).toBe(board.elements);
  });

  it('only sets the mode where there is nothing to put on a page', () => {
    const out = withEditorModeSwitched(tab([sticky('a', -75)]), 'illustrate');
    expect(out).toMatchObject({ pagedContent: false, tab: { opensIn: 'illustrate' } });
    expect(out.tab.pages).toBeUndefined();
    const draw = withEditorModeSwitched(tab([sticky('a', -1500), sticky('b', 1500)]), 'draw');
    expect(draw).toMatchObject({ pagedContent: false, tab: { opensIn: 'draw' } });
  });

  it('returns the same tab when it is already in the mode, or is an event-storming board', () => {
    const inDraw = tab([], { opensIn: 'draw' });
    expect(withEditorModeSwitched(inDraw, 'draw').tab).toBe(inDraw);
    const es = tab([], { kind: 'event-storming' });
    expect(withEditorModeSwitched(es, 'illustrate').tab).toBe(es);
  });
});
