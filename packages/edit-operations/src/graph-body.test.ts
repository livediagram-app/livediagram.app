import { describe, expect, it } from 'vitest';
import { MAX_ELEMENTS_PER_TAB } from '@livediagram/document';
import { graphBodyIssue } from './graph-body';

const nodes = [{ id: 'a', label: 'A' }, { id: 'b' }];
const edges = [{ from: 'a', to: 'b', label: 'next' }];

describe('graphBodyIssue', () => {
  it('accepts a graph the MCP would take', () => {
    expect(
      graphBodyIssue({
        nodes: [...nodes, { id: 'c', shape: 'entity', fields: [{ name: 'id', type: 'uuid' }] }],
        edges: [{ ...edges[0], line: 'dashed', ends: 'both', head: 'circle' }],
        groups: [{ id: 'g', label: 'Group', members: ['a'] }],
        direction: 'right',
        style: 'tree',
        lines: 'angled',
      }),
    ).toBeNull();
  });

  it('names the first member that is wrong', () => {
    expect(graphBodyIssue('a -> b')).toBe('graph: expected an object with nodes and edges');
    expect(graphBodyIssue({ nodes: [{ id: 1 }], edges })).toBe(
      'graph.nodes: expected an array of { id, label?, shape?, note?, group? }',
    );
    expect(graphBodyIssue({ nodes: [{ id: 'a', fields: 'x' }], edges: [] })).toMatch(
      /^graph.nodes/,
    );
    expect(graphBodyIssue({ nodes, edges: [{ from: 'a' }] })).toBe(
      'graph.edges: expected an array of { from, to, label? }',
    );
    expect(graphBodyIssue({ nodes, edges, groups: [{ id: 'g', members: [1] }] })).toBe(
      'graph.groups: expected an array of { id, members }',
    );
    expect(graphBodyIssue({ nodes, edges, direction: 'up' })).toBe(
      'graph.direction: expected down or right',
    );
    expect(graphBodyIssue({ nodes, edges, style: 'radial' })).toBe(
      'graph.style: expected flow, tree or mindmap',
    );
    expect(graphBodyIssue({ nodes, edges, lines: 'wavy' })).toBe(
      'graph.lines: expected straight, angled or curved',
    );
  });

  it('caps the nodes and edges at the element cap', () => {
    const many = Array.from({ length: MAX_ELEMENTS_PER_TAB + 1 }, (_, i) => ({ id: `n${i}` }));
    expect(graphBodyIssue({ nodes: many, edges: [] })).toBe(
      `graph: at most ${MAX_ELEMENTS_PER_TAB} nodes and edges`,
    );
  });
});
