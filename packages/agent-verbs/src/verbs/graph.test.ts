import { describe, expect, it } from 'vitest';
import { graphLint, graphLintVerb, graphOfSource } from './graph';

const arch = JSON.stringify({
  nodes: [
    { id: 'web', label: 'Web' },
    { id: 'api', label: 'API' },
    { id: 'db', label: 'DB' },
  ],
  edges: [
    { from: 'web', to: 'api' },
    { from: 'api', to: 'db' },
  ],
  direction: 'right',
});

describe('graphOfSource', () => {
  it('reads graph JSON, a replace holding one, and Mermaid', () => {
    expect(graphOfSource(arch, 'a.json').nodes).toHaveLength(3);
    expect(
      graphOfSource(JSON.stringify({ replace: { graph: JSON.parse(arch) } }), 'r.json').edges,
    ).toHaveLength(2);
    expect(graphOfSource('flowchart LR\n  a --> b', 'f.mmd').nodes.map((n) => n.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('refuses edit operations, a malformed graph and unsupported Mermaid, naming the file', () => {
    expect(() => graphOfSource('rm n1', 'ops.txt')).toThrow('ops.txt holds no graph or Mermaid');
    expect(() => graphOfSource('{"name":"x"}', 'x.json')).toThrow(
      'x.json holds no graph or Mermaid',
    );
    expect(() => graphOfSource('{"nodes":[{"id":"a"}]}', 'g.json')).toThrow(
      'g.json: graph.edges: expected',
    );
    expect(() => graphOfSource('sequenceDiagram\nA->>B: hi', 's.mmd')).toThrow(
      's.mmd holds no graph or Mermaid',
    );
    expect(() => graphOfSource('graph TD', 'e.mmd')).toThrow(
      'e.mmd: No nodes found in the flowchart.',
    );
  });
});

describe('graphLint', () => {
  it('lints the laid-out graph, counting its errors, its own lines kept out of the output', () => {
    const logs: string[] = [];
    const out = graphLint(arch, 'a.json', undefined, (line) => void logs.push(line));
    expect(out.text).toMatch(/^0 crossings · 0 behind · 0 overlaps · \d+×\d+ → /);
    expect(out.errors).toBe(0);
    expect(logs[0]).toMatch(/^\[lint\] run \{/);
    expect(graphLintVerb.exitCode!(out)).toBe(0);
    expect(graphLintVerb.exitCode!({ ...out, errors: 2 })).toBe(1);
    expect(graphLintVerb.text!(out)).toEqual([out.text]);
  });

  it('compares layout variants, and refuses a dimension it does not know', () => {
    const out = graphLint(arch, 'a.json', 'direction', () => {});
    expect(out.text.split('\n')[0]).toMatch(/^variant/);
    expect(
      out.text
        .split('\n')
        .slice(1)
        .map((line) => line.split(/\s+/)[0]),
    ).toEqual(['down', 'right']);
    expect(() => graphLint(arch, 'a.json', 'colour', () => {})).toThrow(
      'unknown dimension "colour"',
    );
  });
});
