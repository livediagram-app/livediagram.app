import { createShape } from './factories';
import type { Element } from './index';
import { describe, expect, it } from 'vitest';
import { assignBranches } from './hierarchy';
import { MAX_ELEMENTS_PER_TAB } from './validate';

// A box with a fixed id so tests can assert on the branch map.
function box(id: string): Element {
  return { ...createShape('focus-button', 0, 0), id };
}

// A stored arrow pinned at both ends: a retired element, which takes no branch.
const pinnedArrow = (id: string, from: string, to: string): Element => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: from, anchor: 's' },
  to: { kind: 'pinned', elementId: to, anchor: 'n' },
});

// docs/specs/002-project-scope/blueprints/DEFAULTS.md D34: each box takes the next branch in document order.
describe('assignBranches', () => {
  it('gives each boxed element the next branch in document order', () => {
    const branches = assignBranches([box('a'), box('b'), box('c')]);
    expect([...branches]).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
  });

  it('reads no arrow: a stored tree is painted as loose boxes, and the arrow takes no branch', () => {
    const elements = [box('root'), box('child'), pinnedArrow('e', 'root', 'child')];
    const branches = assignBranches(elements);
    expect(branches.get('root')).toBe(0);
    expect(branches.get('child')).toBe(1);
    expect(branches.has('e')).toBe(false);
  });

  it('is empty for an empty tab', () => {
    expect(assignBranches([]).size).toBe(0);
  });

  it('stays linear on the largest tab allowed', () => {
    const elements = Array.from({ length: MAX_ELEMENTS_PER_TAB }, (_, i) => box(`n${i}`));
    const branches = assignBranches(elements);
    expect(branches.size).toBe(MAX_ELEMENTS_PER_TAB);
    expect(branches.get(`n${MAX_ELEMENTS_PER_TAB - 1}`)).toBe(MAX_ELEMENTS_PER_TAB - 1);
  });
});
