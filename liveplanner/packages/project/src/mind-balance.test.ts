// A balanced map deals each branch to the side with less, weighed by the room its whole subtree takes
// (docs/specs/009-elements/mind-node.md): by the branch boxes alone, every branch counted the same.
import { describe, expect, it } from 'vitest';
import { layoutGraph } from './graph-input';
import type { BoxedElement } from './index';

describe('balanced sides', () => {
  it('weighs a branch by its subtree, so one big branch faces the small ones', () => {
    const leaves = (parent: string, n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `${parent}${i}`, label: `${parent} idea ${i}` }));
    const branches = { a: 1, b: 5, c: 1, d: 1 } as const;
    const nodes = [
      { id: 'root', label: 'Launch' },
      ...Object.entries(branches).flatMap(([id, n]) => [
        { id, label: `Branch ${id}` },
        ...leaves(id, n),
      ]),
    ];
    const edges = Object.entries(branches).flatMap(([id, n]) => [
      { from: 'root', to: id },
      ...Array.from({ length: n }, (_, i) => ({ from: id, to: `${id}${i}` })),
    ]);
    let k = 0;
    const els = layoutGraph({ style: 'mindmap', nodes, edges }, { makeEdgeId: () => `e${k++}` });
    const at = (id: string) => els.find((e) => e.id === id) as BoxedElement;
    const rootX = at('root').x + at('root').width / 2;
    const leftLeaves = nodes.filter(
      (n) => /\d$/.test(n.id) && at(n.id).x + at(n.id).width / 2 < rootX,
    ).length;
    // 8 leaves: the big branch's 5 against the small ones' 3, never 6 against 2.
    expect([5, 3]).toContain(leftLeaves);
  });
});
