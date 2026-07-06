import { describe, it, expect } from 'vitest';
import { isValidTab } from '@livediagram/diagram';
import { buildGraphTab } from './tab-builders';

// Graph-first authoring end-to-end (spec/62 §4.7): a node/edge graph must
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
