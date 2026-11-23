import { describe, expect, it } from 'vitest';
import {
  DIAGRAM_SEND_EDGES_MAX,
  DIAGRAM_SEND_GROUPS_MAX,
  DIAGRAM_SEND_LABEL_MAX,
  DIAGRAM_SEND_NODES_MAX,
  isDiagramSendKind,
  readDiagramFromGraphInput,
  readDiagramSendAsk,
  readDiagramSendGraph,
} from './diagram-sends';

const graph = {
  title: '  Onboarding  ',
  style: 'flow',
  direction: 'down',
  nodes: [
    { id: 'a', label: 'Start', shape: 'circle' },
    { id: 'b', label: 'Check   the\nform', shape: 'diamond', note: 'Done by HR', group: 'g' },
    { id: 'c', label: 'Welcome', shape: 'square', role: 'Manager' },
  ],
  edges: [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c', label: 'Yes', line: 'dashed' },
  ],
  groups: [{ id: 'g', label: 'HR' }],
};

describe('readDiagramSendGraph', () => {
  it('keeps a good graph, folding white space and dropping a plain shape', () => {
    expect(readDiagramSendGraph(graph)).toEqual({
      title: 'Onboarding',
      style: 'flow',
      direction: 'down',
      nodes: [
        { id: 'a', label: 'Start', shape: 'circle' },
        { id: 'b', label: 'Check the form', shape: 'diamond', note: 'Done by HR', group: 'g' },
        { id: 'c', label: 'Welcome', role: 'Manager' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c', label: 'Yes', line: 'dashed' },
      ],
      groups: [{ id: 'g', label: 'HR' }],
    });
  });

  it('refuses what holds no box', () => {
    expect(readDiagramSendGraph(null)).toBeNull();
    expect(readDiagramSendGraph([])).toBeNull();
    expect(readDiagramSendGraph({ nodes: 'x' })).toBeNull();
    expect(readDiagramSendGraph({ nodes: [{ id: 'a', label: '   ' }, 5] })).toBeNull();
  });

  it('drops loose parts: unknown shapes, repeats, edges to nowhere, unused or bad groups, bad style', () => {
    const read = readDiagramSendGraph({
      style: 'spiral',
      direction: 'up',
      title: 5,
      nodes: [
        { id: 'a', label: 'A', shape: 'star', group: 'nope' },
        { id: 'a', label: 'Again' },
        { id: 'g', label: 'Clashes with a group' },
        { id: '', label: 'No id' },
        { id: 'x'.repeat(65), label: 'Long id' },
        { id: 'b', label: 'B' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'b' },
        { from: 'a', to: 'a' },
        { from: 'a', to: 'z' },
        'nope',
        { from: 'b', to: 'a', label: '  ' },
      ],
      groups: [
        { id: 'g', label: 'G' },
        { id: 'g', label: 'Twice' },
        { id: 'h' },
        'x',
        { label: 'no id' },
      ],
    });
    expect(read).toEqual({
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
    });
  });

  it('keeps a group named only by its id, and drops edges given as no list', () => {
    expect(
      readDiagramSendGraph({
        nodes: [{ id: 'a', label: 'A', group: 'h' }],
        edges: 'x',
        groups: [{ id: 'h' }],
      }),
    ).toEqual({
      nodes: [{ id: 'a', label: 'A', group: 'h' }],
      edges: [],
      groups: [{ id: 'h', label: 'h' }],
    });
  });

  it('holds to the caps', () => {
    const many = Array.from({ length: DIAGRAM_SEND_NODES_MAX + 10 }, (_, i) => ({
      id: `n${i}`,
      label: `N${i}`,
    }));
    const edges = many
      .slice(0, 20)
      .flatMap((a) => many.slice(0, 20).map((b) => ({ from: a.id, to: b.id })));
    const groups = Array.from({ length: DIAGRAM_SEND_GROUPS_MAX + 3 }, (_, i) => ({
      id: `g${i}`,
      label: 'G',
    }));
    const read = readDiagramSendGraph({
      nodes: [{ id: 'n0', label: 'x'.repeat(500), group: 'g0' }, ...many.slice(1)],
      edges,
      groups,
    })!;
    expect(read.nodes).toHaveLength(DIAGRAM_SEND_NODES_MAX);
    expect(read.nodes[0]!.label).toHaveLength(DIAGRAM_SEND_LABEL_MAX);
    expect(read.edges).toHaveLength(DIAGRAM_SEND_EDGES_MAX);
    expect(read.groups).toEqual([{ id: 'g0', label: 'G' }]);
  });
});

describe('readDiagramSendAsk', () => {
  const source = {
    app: 'liveknowledge',
    itemId: 'doc-1',
    tabId: 't1',
    elementId: null,
    label: 'Onboarding',
  };
  it('reads an ask', () => {
    expect(readDiagramSendAsk({ name: ' Flow ', graph, source })).toMatchObject({
      name: 'Flow',
      source: {
        app: 'liveknowledge',
        itemId: 'doc-1',
        tabId: 't1',
        elementId: null,
        label: 'Onboarding',
      },
    });
    expect(
      readDiagramSendAsk({ name: 'Flow', graph, source: { ...source, tabId: undefined, label: 4 } })
        ?.source,
    ).toEqual({ app: 'liveknowledge', itemId: 'doc-1', tabId: null, elementId: null, label: '' });
  });
  it('refuses a bad ask', () => {
    expect(readDiagramSendAsk(null)).toBeNull();
    expect(readDiagramSendAsk({ name: '', graph, source })).toBeNull();
    expect(readDiagramSendAsk({ name: 'x', graph: {}, source })).toBeNull();
    expect(readDiagramSendAsk({ name: 'x', graph, source: { ...source, app: 'nope' } })).toBeNull();
    expect(readDiagramSendAsk({ name: 'x', graph, source: { ...source, itemId: '' } })).toBeNull();
    expect(readDiagramSendAsk({ name: 'x', graph, source: { ...source, tabId: 5 } })).toBeNull();
    expect(readDiagramSendAsk({ name: 'x', graph, source: 'x' })).toBeNull();
  });
});

describe('readDiagramFromGraphInput', () => {
  const input = {
    owner: 'user_1',
    name: 'Flow',
    graph,
    caption: 'From KB',
    link: 'https://x.test/a',
  };
  it('reads the door body', () => {
    expect(readDiagramFromGraphInput(input)).toMatchObject({ owner: 'user_1', caption: 'From KB' });
  });
  it('refuses a bad body', () => {
    expect(readDiagramFromGraphInput(null)).toBeNull();
    expect(readDiagramFromGraphInput({ ...input, owner: '' })).toBeNull();
    expect(readDiagramFromGraphInput({ ...input, link: 'javascript:alert(1)' })).toBeNull();
    expect(readDiagramFromGraphInput({ ...input, caption: '' })).toBeNull();
  });
});

it('isDiagramSendKind', () => {
  expect(isDiagramSendKind('mindmap')).toBe(true);
  expect(isDiagramSendKind('pie')).toBe(false);
  expect(isDiagramSendKind(3)).toBe(false);
});
