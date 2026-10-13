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
      'graph.nodes: expected an array of { id, label?, shape?, note?, group?, icon?, tone? (strong, soft, muted or plain) }',
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
      'graph.style: expected flow, tree, mindmap, lanes, cycle, storm or sequence',
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

describe('graphBodyIssue, the graph look', () => {
  const edges = [{ from: 'a', to: 'b' }];
  const nodes = [{ id: 'a' }, { id: 'b' }];
  it('takes a title, a subtitle, a key, tones, icons and the lanes and cycle styles', () => {
    expect(
      graphBodyIssue({
        title: 'T',
        subtitle: 'S',
        key: true,
        style: 'lanes',
        nodes: [{ id: 'a', tone: 'muted', icon: 'database' }, { id: 'b' }],
        edges,
      }),
    ).toBeNull();
    expect(graphBodyIssue({ style: 'cycle', nodes, edges })).toBeNull();
  });
  it('refuses a tone off the list and an icon that names none', () => {
    expect(graphBodyIssue({ nodes: [{ id: 'a', tone: 'loud' }], edges })).toMatch(/^graph.nodes/);
    expect(graphBodyIssue({ nodes: [{ id: 'a', icon: 'zzqx' }, { id: 'b' }], edges })).toBe(
      'graph.nodes: node "a" icon "zzqx" is not an icon; search_icons finds one by what it shows',
    );
  });
});

describe('graphBodyIssue, a sequence', () => {
  const sequence = {
    participants: [
      { id: 'u', label: 'User', actor: true },
      { id: 's', label: 'Server', icon: 'server' },
    ],
    items: [
      { kind: 'message', from: 'u', to: 's', label: 'GET', style: 'call', activate: true },
      { kind: 'message', from: 's', to: 'u', label: '200', style: 'reply', deactivate: true },
      { kind: 'note', placement: 'over', who: ['u', 's'], text: 'cached' },
      { kind: 'activate', who: 's' },
      { kind: 'deactivate', who: 's' },
      { kind: 'fragment', op: 'alt', label: 'ok' },
      { kind: 'else', label: 'error' },
      { kind: 'end' },
    ],
    title: 'Fetch',
    autonumber: true,
  };

  it('takes every kind of item, and a key of meanings', () => {
    expect(
      graphBodyIssue({
        nodes: [],
        edges: [],
        style: 'sequence',
        sequence,
        key: { square: 'Step' },
      }),
    ).toBeNull();
    expect(graphBodyIssue({ nodes: [], edges: [], key: true })).toBeNull();
  });

  it('refuses a malformed item, participant or key', () => {
    const bad = [
      { ...sequence, items: [{ kind: 'message', from: 'u', to: 's', label: 'x', style: 'shout' }] },
      { ...sequence, items: [{ kind: 'note', placement: 'over', who: [], text: 'x' }] },
      { ...sequence, items: [{ kind: 'wobble' }] },
      { ...sequence, items: ['end'] },
      { ...sequence, participants: [{ id: 'u' }] },
      { ...sequence, autonumber: 'yes' },
      'u -> s',
    ];
    for (const q of bad)
      expect(graphBodyIssue({ nodes: [], edges: [], sequence: q }), JSON.stringify(q)).toMatch(
        /^graph\.sequence: expected a sequence/,
      );
    expect(graphBodyIssue({ nodes: [], edges: [], key: { square: 1 } })).toMatch(/^graph\.key/);
  });
});

describe('graphBodyIssue, icons', () => {
  it('suggests icons like an unknown one, or points at search_icons when none are', () => {
    expect(graphBodyIssue({ nodes: [{ id: 'a', icon: 'usr' }], edges: [] })).toMatch(
      /icons like it: /,
    );
    expect(graphBodyIssue({ nodes: [{ id: 'a', icon: 'qqqqzzzz' }], edges: [] })).toMatch(
      /search_icons finds one/,
    );
  });
});
