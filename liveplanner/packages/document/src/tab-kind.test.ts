import { describe, expect, it } from 'vitest';
import type { Tab } from './index';
import { stampTabKind, tabKindOf } from './tab-kind';

const tab = (t: Partial<Tab> = {}): Tab => ({ id: 't', name: 'T', elements: [], ...t });

describe('tabKindOf', () => {
  it('names the ordinary tab rather than leaving it an absence', () => {
    expect(tabKindOf(tab())).toBe('diagram');
  });

  it('reads a Plan kind', () => {
    expect(tabKindOf(tab({ kind: 'board' }))).toBe('board');
  });

  it('reads the retired event-storming kind as an ordinary diagram', () => {
    expect(tabKindOf({ kind: 'event-storming' })).toBe('diagram');
  });

  // Whiteboarding is an editor mode, not a kind (docs/specs/007-editor/editor-modes.md): a stored
  // 'whiteboard' is migrated on read (./legacy-whiteboard-tab); a reader alone sees a general tab.
  it('reads the former whiteboard kind as an ordinary diagram', () => {
    expect(tabKindOf({ kind: 'whiteboard' })).toBe('diagram');
  });

  it('reads an unknown kind as an ordinary diagram', () => {
    expect(tabKindOf({ kind: 'sketchpad' })).toBe('diagram');
  });

  it('treats a tab written before the field as an ordinary diagram', () => {
    expect(tabKindOf(tab({ kind: undefined }))).toBe('diagram');
  });
});

describe('stampTabKind', () => {
  it('writes the default kind onto a tab that has none', () => {
    expect(stampTabKind(tab()).kind).toBe('diagram');
  });

  it('leaves a specialised kind alone', () => {
    expect(stampTabKind(tab({ kind: 'sheet' })).kind).toBe('sheet');
  });

  it('returns the SAME object when nothing needs stamping', () => {
    // Identity matters: this runs at the editor's commit choke point on
    // every tab of every commit, and a fresh object for an unchanged tab
    // would defeat the memoised element views downstream.
    const already = tab({ kind: 'diagram' });
    expect(stampTabKind(already)).toBe(already);
    const board = tab({ kind: 'board' });
    expect(stampTabKind(board)).toBe(board);
  });

  it('does not otherwise touch the tab', () => {
    const before = tab({ name: 'Cart', theme: 'slate' });
    const after = stampTabKind(before);
    expect({ ...after, kind: undefined }).toEqual({ ...before, kind: undefined });
  });
});
