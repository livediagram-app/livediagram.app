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
});
