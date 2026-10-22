import { describe, it, expect } from 'vitest';
import type { ArrowElement, Element } from './index';
import { buildTab } from './tab-builders';

describe("buildTab bends an agent's facing angled arrows", () => {
  it('gives a bottom-to-top arrow into a lower box two bends', () => {
    const els = [
      { id: 'p', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 60 },
      { id: 'c', type: 'shape', shape: 'square', x: 300, y: 200, width: 100, height: 60 },
      {
        id: 'a',
        type: 'arrow',
        arrowStyle: 'angled',
        from: { kind: 'pinned', elementId: 'p', anchor: 's' },
        to: { kind: 'pinned', elementId: 'c', anchor: 'n' },
      },
    ] as Element[];
    const tab = buildTab('t', 'T', els, 'preserve', undefined);
    expect((tab.elements[2] as ArrowElement).curvePoints).toHaveLength(2);
  });
});
