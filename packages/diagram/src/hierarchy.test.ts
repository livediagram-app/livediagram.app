import { createPinnedArrow, createShape } from './factories';
import type { Element } from './index';
import { describe, expect, it } from 'vitest';
import { assignBranches, branchOfArrow, ROOT_BRANCH } from './hierarchy';

// Helper: a square with a fixed id so tests can assert on the branch map.
function box(id: string): Element {
  return { ...createShape('square', 0, 0), id };
}

describe('assignBranches', () => {
  it('marks a root and gives each of its subtrees a distinct branch', () => {
    // root → a, root → b. Two limbs, two branches.
    const root = box('root');
    const a = box('a');
    const b = box('b');
    const elements: Element[] = [
      root,
      a,
      b,
      createPinnedArrow(root.id, 's', a.id, 'n'),
      createPinnedArrow(root.id, 's', b.id, 'n'),
    ];
    const branches = assignBranches(elements);
    expect(branches.get('root')).toBe(ROOT_BRANCH);
    expect(branches.get('a')).toBe(0);
    expect(branches.get('b')).toBe(1);
  });

  it('propagates a branch index down a whole subtree', () => {
    // root → a → a1, a2. The leaves inherit a's branch, not new ones.
    const elements: Element[] = [
      box('root'),
      box('a'),
      box('a1'),
      box('a2'),
      box('b'),
      createPinnedArrow('root', 's', 'a', 'n'),
      createPinnedArrow('root', 's', 'b', 'n'),
      createPinnedArrow('a', 's', 'a1', 'n'),
      createPinnedArrow('a', 's', 'a2', 'n'),
    ];
    const branches = assignBranches(elements);
    expect(branches.get('a')).toBe(0);
    expect(branches.get('a1')).toBe(0);
    expect(branches.get('a2')).toBe(0);
    // b is the second limb, so a fresh index.
    expect(branches.get('b')).toBe(1);
  });

  it('cycles loose (graph-less) elements through branch indices by document order', () => {
    const elements: Element[] = [box('x'), box('y'), box('z')];
    const branches = assignBranches(elements);
    expect(branches.get('x')).toBe(0);
    expect(branches.get('y')).toBe(1);
    expect(branches.get('z')).toBe(2);
  });

  it('ignores arrows with a free endpoint (no implied hierarchy)', () => {
    const a = box('a');
    const b = box('b');
    // Free → free arrow shouldn't create an edge; both stay loose.
    const elements: Element[] = [a, b, createPinnedArrow(a.id, 's', b.id, 'n')];
    // Mutate the arrow to a free `to` endpoint.
    const arrow = elements[2] as Extract<Element, { type: 'arrow' }>;
    elements[2] = { ...arrow, to: { kind: 'free', x: 10, y: 10 } };
    const branches = assignBranches(elements);
    // No edge: a and b are both loose → indices 0 and 1.
    expect(branches.get('a')).toBe(0);
    expect(branches.get('b')).toBe(1);
  });

  it('does not assign a branch to arrows themselves', () => {
    const elements: Element[] = [box('root'), box('a'), createPinnedArrow('root', 's', 'a', 'n')];
    const branches = assignBranches(elements);
    expect(branches.size).toBe(2); // root + a, not the arrow
  });

  it('survives a self-loop arrow without crashing', () => {
    const elements: Element[] = [box('a'), createPinnedArrow('a', 's', 'a', 'n')];
    const branches = assignBranches(elements);
    // No real edge → a is loose.
    expect(branches.get('a')).toBe(0);
  });

  it('keeps the first branch that reaches a shared (diamond) descendant', () => {
    // root → a, root → b, a → shared, b → shared.
    const elements: Element[] = [
      box('root'),
      box('a'),
      box('b'),
      box('shared'),
      createPinnedArrow('root', 's', 'a', 'n'),
      createPinnedArrow('root', 's', 'b', 'n'),
      createPinnedArrow('a', 's', 'shared', 'n'),
      createPinnedArrow('b', 's', 'shared', 'n'),
    ];
    const branches = assignBranches(elements);
    // a is branch 0, b is branch 1; shared is painted by a's subtree first.
    expect(branches.get('shared')).toBe(branches.get('a'));
  });
});

describe('branchOfArrow', () => {
  const branches = new Map<string, number>([
    ['root', ROOT_BRANCH],
    ['a', 0],
    ['b', 1],
  ]);

  it('colours an arrow by the branch it feeds into (its `to`)', () => {
    const arrow = createPinnedArrow('root', 's', 'a', 'n');
    expect(branchOfArrow(arrow, branches)).toBe(0);
  });

  it('falls back to the `from` branch when `to` is unknown/free', () => {
    const arrow = {
      ...createPinnedArrow('a', 's', 'b', 'n'),
      to: { kind: 'free', x: 0, y: 0 } as const,
    };
    expect(branchOfArrow(arrow, branches)).toBe(0);
  });

  it('falls back to the trunk when neither endpoint resolves', () => {
    const arrow = {
      ...createPinnedArrow('a', 's', 'b', 'n'),
      from: { kind: 'free', x: 0, y: 0 } as const,
      to: { kind: 'free', x: 1, y: 1 } as const,
    };
    expect(branchOfArrow(arrow, branches)).toBe(ROOT_BRANCH);
  });
});
