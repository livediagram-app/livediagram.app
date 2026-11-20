import { describe, expect, it } from 'vitest';
import { graphFromMermaid, resolveGraphInput } from './graph-input';

// docs/specs/020-import-export/mermaid.md "Subgraphs → frames": a nested subgraph is folded, and said.

describe('graph input notes', () => {
  const nested = `flowchart TD
  subgraph vpc[VPC]
    subgraph aza[AZ a]
      a1[ECS a]
    end
    subgraph azb[AZ b]
      b1[ECS b]
    end
  end
  a1 --> b1`;

  it('says how many nested subgraphs it folded into their outer group', () => {
    const g = graphFromMermaid(nested);
    expect(g.ok && g.notes).toEqual([
      '2 nested subgraphs folded into their outer group: groups draw one level deep',
    ]);
    expect(resolveGraphInput({ mermaid: nested }).notes).toHaveLength(1);
    // The second nested subgraph cut out, from its opening line to the end that closes it.
    const from = nested.indexOf('subgraph azb[AZ b]');
    const to = nested.indexOf('end\n', from) + 'end\n'.length;
    const one = graphFromMermaid(nested.slice(0, from) + nested.slice(to));
    expect(one.ok && one.notes?.[0]).toMatch(/^1 nested subgraph folded/);
  });

  it('says nothing when nothing was folded', () => {
    expect(resolveGraphInput({ mermaid: 'flowchart TD\n  a --> b' }).notes).toBeUndefined();
    expect(resolveGraphInput({ graph: { nodes: [{ id: 'a' }], edges: [] } }).notes).toBeUndefined();
  });

  // docs/specs/015-api/mcp-server.md §4.7 "What a graph leaves out".
  const node = (id: string, label = id) => ({ id, label });
  const LONG = 'This is a really long label that goes on well past the forty character limit';

  it('says which edges it left out, which labels became headings and which edge labels were cut', () => {
    const { graph, notes } = resolveGraphInput({
      graph: {
        nodes: [node('a', LONG), node('b'), { id: 'c', label: 'C', group: 'made' }],
        groups: [{ id: 'g', members: ['b'] }],
        edges: [
          { from: 'a', to: 'b', label: LONG },
          { from: 'a', to: 'ghost', label: LONG },
          { from: 'nowhere', to: 'b' },
          { from: 'a', to: 'g' },
          { from: 'a', to: 'made' },
          { from: 'b', to: 'c', label: 'short' },
        ],
      },
    });
    expect(graph).toBeDefined();
    expect(notes).toHaveLength(3);
    expect(notes![0]).toBe('2 edges left out, naming no node or group: a → ghost, nowhere → b');
    expect(notes![1]).toMatch(
      /^1 node label shortened to a heading of up to 40 characters, the full text kept in the node's note: a reads "/,
    );
    expect(notes![2]).toMatch(
      /^1 edge label cut to fit an arrow \(up to 40 characters\): a → b reads "/,
    );
  });

  it('counts the rest past five names, and says nothing of a graph drawn whole', () => {
    const edges = Array.from({ length: 7 }, (_, i) => ({ from: 'a', to: `x${i}` }));
    expect(resolveGraphInput({ graph: { nodes: [node('a')], edges } }).notes).toEqual([
      '7 edges left out, naming no node or group: a → x0, a → x1, a → x2, a → x3, a → x4 and 2 more',
    ]);
    const whole = resolveGraphInput({
      graph: { nodes: [node('a'), { id: 'b' }], edges: [{ from: 'a', to: 'b' }] },
    });
    expect(whole.notes).toBeUndefined();
  });

  it('leaves a sequence message and an event-storming note whole', () => {
    for (const style of ['sequence', 'storm'] as const)
      expect(
        resolveGraphInput({
          graph: {
            style,
            nodes: [node('a', LONG), node('b')],
            edges: [{ from: 'a', to: 'b', label: LONG }],
          },
        }).notes,
      ).toBeUndefined();
  });

  it('says the same of a graph given as Mermaid', () => {
    const { notes } = resolveGraphInput({ mermaid: `flowchart TD\n  a[${LONG}] --> b[B]` });
    expect(notes?.[0]).toMatch(/^1 node label shortened/);
  });

  // docs/specs/015-api/mcp-server.md §4.7 "A Mermaid type that is not read".
  it.each([
    ['pie title Share\n  "A" : 1', 'pie-chart'],
    ['mindmap\n  root((x))', 'style "mindmap"'],
    ['gantt\n  title x', '"gantt" template'],
    ['classDiagram\n  class A', 'shape "entity"'],
    ['---\ntitle: Plan\n---\n%% a comment\ntimeline\n  2024 : x', 'timeline-rail'],
    ['xychart-beta\n  x-axis [a]', 'bar-chart'],
    ['sankey-beta\n a,b,1', 'sankeyFlows'],
    ['C4Context\n  Person(a, "A")', 'style "c4"'],
  ])('says what to give instead of %j', (mermaid, form) => {
    const { error } = resolveGraphInput({ mermaid });
    expect(error).toMatch(/^Could not read the Mermaid: Only Mermaid flowcharts/);
    expect(error).toContain(form);
  });

  it('adds nothing for a type with no closer form, or for text that is none', () => {
    expect(resolveGraphInput({ mermaid: 'gitGraph\n  commit' }).error).toMatch(/diagram types\.$/);
    expect(resolveGraphInput({ mermaid: '' }).error).toBeDefined();
  });
});
