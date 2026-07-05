import { describe, expect, it } from 'vitest';
import { nextTraversalIndex } from './useCanvasA11y';

// The Tab-traversal step (spec/71). Pure: elements in render order, the
// current selection, a direction, and a blocked predicate in; the index
// to select (or null = fall through to the browser's Tab) out.

const els = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
const none = () => false;

describe('nextTraversalIndex', () => {
  it('walks forward and backward from the current selection', () => {
    expect(nextTraversalIndex(els, 'b', 1, none)).toBe(2);
    expect(nextTraversalIndex(els, 'b', -1, none)).toBe(0);
  });

  it('starts at the nearest end when nothing is selected', () => {
    expect(nextTraversalIndex(els, null, 1, none)).toBe(0);
    expect(nextTraversalIndex(els, null, -1, none)).toBe(3);
  });

  it('returns null past either end (no wrap, so no keyboard trap)', () => {
    expect(nextTraversalIndex(els, 'd', 1, none)).toBeNull();
    expect(nextTraversalIndex(els, 'a', -1, none)).toBeNull();
    expect(nextTraversalIndex([], null, 1, none)).toBeNull();
  });

  it('skips elements locked by another participant', () => {
    const blocked = (id: string) => id === 'b' || id === 'c';
    expect(nextTraversalIndex(els, 'a', 1, blocked)).toBe(3);
    expect(nextTraversalIndex(els, 'd', -1, blocked)).toBe(0);
    // Everything ahead blocked: fall through rather than wrap.
    expect(nextTraversalIndex(els, 'c', 1, (id) => id === 'd')).toBeNull();
  });

  it('treats a stale selection id like no selection', () => {
    expect(nextTraversalIndex(els, 'gone', 1, none)).toBe(0);
  });
});
