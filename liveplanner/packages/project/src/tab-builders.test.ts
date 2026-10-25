import { describe, it, expect } from 'vitest';
import { type ArrowElement, type Element } from './index';
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

describe("buildTab settles a diagram key's rows", () => {
  it('lists the lines the tab uses, so the key never draws its empty hint', () => {
    const els = [
      { id: 'p', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 60 },
      { id: 'c', type: 'shape', shape: 'square', x: 300, y: 0, width: 100, height: 60 },
      {
        id: 'a',
        type: 'arrow',
        strokeStyle: 'dashed',
        from: { kind: 'pinned', elementId: 'p', anchor: 'e' },
        to: { kind: 'pinned', elementId: 'c', anchor: 'w' },
      },
      { id: 'k', type: 'shape', shape: 'diagram-key', x: 0, y: 200, width: 300, height: 80 },
    ] as Element[];
    const key = buildTab('t', 'T', els, 'preserve', undefined).elements[3] as {
      keyRows?: { id: string }[];
    };
    expect(key.keyRows?.map((r) => r.id)).toEqual(['line:dashed']);
  });
});
