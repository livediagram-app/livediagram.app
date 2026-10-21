import { describe, it, expect } from 'vitest';
import { isValidTab, type ArrowElement, type Element } from './index';
import { buildGraphTab, buildTab } from './tab-builders';

// Graph-first authoring end-to-end (docs/specs/015-api/mcp-server.md §4.7): a node/edge graph must
// come out a valid, themed, auto-laid-out tab.
describe('buildGraphTab', () => {
  it('builds a valid themed tab from a graph, positioning the nodes', () => {
    const tab = buildGraphTab(
      'tab-1',
      'Flow',
      {
        nodes: [
          { id: 'a', label: 'Start', shape: 'stadium' },
          { id: 'b', label: 'Work' },
          { id: 'c', label: 'Done', shape: 'stadium' },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
        ],
      },
      'ocean',
    );

    expect(isValidTab(tab)).toBe(true);
    expect(tab.theme).toBe('ocean');
    // 3 shapes + 2 arrows.
    expect(tab.elements.filter((e) => e.type === 'shape')).toHaveLength(3);
    expect(tab.elements.filter((e) => e.type === 'arrow')).toHaveLength(2);
    // Auto-layout spread the nodes off the shared origin.
    const positions = new Set(
      tab.elements
        .filter((e) => e.type === 'shape')
        .map((e) => `${(e as { x: number }).x},${(e as { y: number }).y}`),
    );
    expect(positions.size).toBe(3);
  });

  it('drops edges to unknown nodes rather than producing broken arrows', () => {
    const tab = buildGraphTab(
      'tab-2',
      'T',
      { nodes: [{ id: 'a' }], edges: [{ from: 'a', to: 'ghost' }] },
      undefined,
    );
    expect(isValidTab(tab)).toBe(true);
    expect(tab.elements.filter((e) => e.type === 'arrow')).toHaveLength(0);
  });
});

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
