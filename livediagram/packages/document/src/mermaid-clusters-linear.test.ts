import { cpuUsage } from 'node:process';
import { describe, expect, it } from 'vitest';
import { parseMermaid } from './mermaid';

// Subgraphs and composite states are kept by id and their members filtered once, so a text of many of them costs
// its length. Each shape below took seconds of CPU (20 s for the composite states) while a pass over every cluster
// ran for each one; the layout caps refuse the graph only after the parse, so the parse itself must stay linear.
const COUNT = 20_000;
const BUDGET_MS = 1_000;

const cpuMs = (run: () => void): number => {
  const started = cpuUsage();
  run();
  const used = cpuUsage(started);
  return (used.user + used.system) / 1000;
};
const many = (line: (i: number) => string, count = COUNT) =>
  Array.from({ length: count }, (_, i) => line(i)).join('\n');

describe('reading many Mermaid clusters in linear time', () => {
  it.each([
    ['empty subgraphs', `graph TD\n${many((i) => `subgraph s${i}\nend`, 2 * COUNT)}`],
    [
      'subgraphs beside a node of their id',
      `graph TD\n${many((i) => `s${i}[n]\nsubgraph s${i}\nx${i}\nend`)}`,
    ],
    [
      'composite states each named by a transition',
      `stateDiagram-v2\n${many((i) => `state s${i} {\nx${i}\n}\ns${i} --> y`)}`,
    ],
    [
      'nested composite states each named by a transition',
      `stateDiagram-v2\n${many((i) => `state o${i} {\nx${i}\nstate f${i} {\n}\n}\nf${i} --> y`)}`,
    ],
  ])('%s', (_name, text) => {
    let ok = true;
    expect(cpuMs(() => (ok = parseMermaid(text).ok))).toBeLessThan(BUDGET_MS);
    expect(ok).toBe(false);
  });

  it('still points a transition at its composite state’s frame', () => {
    const r = parseMermaid('stateDiagram-v2\nstate Busy {\n  Working\n}\nIdle --> Busy');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.nodes.map((n) => n.id).sort()).toEqual(['Idle', 'Working']);
    expect(r.graph.clusters).toEqual([{ id: 'Busy', label: 'Busy', members: ['Working'] }]);
    expect(r.graph.edges).toEqual([{ from: 'Idle', to: 'Busy' }]);
  });
});
