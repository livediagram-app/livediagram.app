// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createShape, type Element, type ShapeElement } from '@livedesign/design';

const trackMock = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({
  track: (...args: Parameters<typeof trackMock>) => trackMock(...args),
}));

const { useSankeySetters } = await import('./useSankeySetters');

// The Sankey's writes (docs/specs/009-elements/sankey.md): one commit each, on Sankeys only.
function setup(selected: string[]) {
  const commits: Element[][] = [];
  const els: Element[] = [
    { ...createShape('sankey', 0, 0), id: 's1', sankeyNodes: [{ name: 'Rent', color: '#111111' }] },
    { ...createShape('pie-chart', 0, 0), id: 'p1' },
  ];
  const { result } = renderHook(() =>
    useSankeySetters({
      currentSelectionIds: () => new Set(selected),
      commit: (fn) => commits.push(fn(els)),
    }),
  );
  const sankey = (i = 0) => commits[i]!.find((e) => e.id === 's1') as ShapeElement;
  return { s: result.current, commits, sankey };
}

describe('useSankeySetters', () => {
  it('stores the dialog’s flows on the diagram it was opened for, cleaned, pruning stale colours', () => {
    trackMock.mockClear();
    const { s, sankey } = setup([]);
    s.setSankeyFlows(
      's1',
      [{ from: ' A ', to: 'B', value: 2 }],
      [{ name: 'Rent', color: '#111111' }],
    );
    expect(sankey().sankeyFlows).toEqual([{ from: 'A', to: 'B', value: 2 }]);
    expect(sankey().sankeyNodes).toBeUndefined();
    expect(trackMock).toHaveBeenCalledWith('Element', 'Changed', 'SankeyFlows');
  });

  it('clears the nodes when the dialog says none, never keeping the old ones', () => {
    const { s, sankey } = setup([]);
    s.setSankeyFlows('s1', [{ from: 'Rent', to: 'B', value: 2 }], undefined);
    expect(sankey().sankeyNodes).toBeUndefined();
  });

  it('sets and clears a node colour on the selected diagrams only', () => {
    const { s, commits, sankey } = setup(['s1', 'p1']);
    s.setSankeyNodeColorSelected('Budget', '#222222');
    expect(sankey().sankeyNodes).toEqual([
      { name: 'Rent', color: '#111111' },
      { name: 'Budget', color: '#222222' },
    ]);
    expect(commits[0]!.find((e) => e.id === 'p1')).not.toHaveProperty('sankeyNodes');
  });

  it('trims the unit and reports animation apart from style', () => {
    trackMock.mockClear();
    const { s, sankey } = setup(['s1']);
    s.setSankeyOptionSelected({ sankeyUnit: '  kWh ' });
    expect(sankey(0).sankeyUnit).toBe('kWh');
    s.setSankeyOptionSelected({ sankeyUnit: '   ' });
    expect(sankey(1).sankeyUnit).toBeUndefined();
    s.setSankeyOptionSelected({ sankeyAnim: 'flow' });
    expect(trackMock.mock.calls.map((c) => c[2])).toEqual([
      'SankeyStyle',
      'SankeyStyle',
      'SankeyAnim',
    ]);
  });

  it('writes nothing with nothing selected', () => {
    const { s, commits } = setup([]);
    s.setSankeyNodeColorSelected('A', '#000000');
    s.setSankeyOptionSelected({ sankeyAlign: 'left' });
    expect(commits).toHaveLength(0);
  });
});
