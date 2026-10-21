import { describe, expect, it } from 'vitest';
import { SANKEY_MAX_FLOWS } from '@liveplanner/document';
import { flowLevels, flowNodeColors } from './sankey-flow-levels';
import { rowFrom, rowsFromFlows, type SankeyDraftRow } from './sankey-flow-rows';
import { sankeyGraph } from '@liveplanner/document';

const row = (from: string, to: string, value: string): SankeyDraftRow => ({
  key: 0,
  from,
  to,
  value,
});

// docs/specs/009-elements/sankey.md "The Flows dialog": the table's levels.
describe('the Flows table’s levels', () => {
  it('puts each sending node at its step, and makes no step for nodes that only end', () => {
    const { levels, loose } = flowLevels([
      row('Salary', 'Budget', '3200'),
      row('Freelance', 'Budget', '800'),
      row('Budget', 'Needs', '2000'),
      row('Budget', 'Savings', '2000'),
      row('Needs', 'Rent', '1400'),
    ]);
    expect(loose).toEqual([]);
    expect(levels.map((l) => ({ step: l.step, sources: l.sources.map((s) => s.name) }))).toEqual([
      { step: 0, sources: ['Salary', 'Freelance'] },
      { step: 1, sources: ['Budget'] },
      { step: 2, sources: ['Needs'] },
    ]);
    expect(levels[1]!.sources[0]!.rows.map((r) => r.index)).toEqual([2, 3]);
  });

  it('matches a From after trimming, and keeps a row with no From loose', () => {
    const { levels, loose } = flowLevels([
      row('Budget ', 'Rent', '1'),
      row('Budget', 'Food', '1'),
      row('', 'Food', '1'),
    ]);
    expect(levels[0]!.sources).toHaveLength(1);
    expect(levels[0]!.sources[0]!.rows).toHaveLength(2);
    expect(loose.map((r) => r.index)).toEqual([2]);
  });

  it('counts a node whose only flows are set aside as a start', () => {
    const { levels } = flowLevels([row('A', 'B', '5'), row('Bonus', '', '')]);
    expect(levels[0]!.sources.map((s) => s.name)).toEqual(['A', 'Bonus']);
  });

  it('groups the most flows a diagram holds well within a frame', () => {
    const rows = rowsFromFlows(
      Array.from({ length: SANKEY_MAX_FLOWS }, (_, i) => ({
        from: `N${i % 40}`,
        to: `N${(i % 40) + 1 + (i % 7)}`,
        value: i + 1,
      })),
    );
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) flowLevels(rows);
    expect((performance.now() - t0) / 20).toBeLessThan(8);
  });

  it('colours a node as the diagram does: its own colour first, then the ramp by first appearance', () => {
    const graph = sankeyGraph([
      { from: 'A', to: 'B', value: 1 },
      { from: 'B', to: 'C', value: 1 },
    ]);
    const colors = flowNodeColors(
      graph,
      [{ name: 'B', color: '#123456' }],
      ['#111', '#222', '#333'],
      undefined,
    );
    expect([...colors]).toEqual([
      ['A', '#111'],
      ['B', '#123456'],
      ['C', '#333'],
    ]);
  });
});

describe('a row sent from a node', () => {
  it('goes after that node’s last flow, or at the end for a node with none', () => {
    const rows = [row('A', 'B', '1'), row('B', 'C', '1'), row('A', 'D', '1')];
    expect(rowFrom(rows, 'A').rows.map((r) => `${r.from}>${r.to}`)).toEqual([
      'A>B',
      'B>C',
      'A>D',
      'A>',
    ]);
    expect(rowFrom(rows, ' B').rows.map((r) => `${r.from}>${r.to}`)).toEqual([
      'A>B',
      'B>C',
      ' B>',
      'A>D',
    ]);
    expect(rowFrom(rows, 'C').rows.at(-1)).toMatchObject({ from: 'C', to: '' });
  });
});
