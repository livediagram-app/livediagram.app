import { describe, expect, it } from 'vitest';
import { BLOCKED_BY, PLAN_TYPES } from './test-plan-types';
import type { Item } from './item';
import { presetSetup } from './presets';
import {
  criticalPathLabels,
  criticalPathOf,
  planDiagramGraph,
  planGraphHash,
  PLAN_GRAPH_LABEL_MAX,
  PLAN_GRAPH_LINKS_MAX,
} from './plan-diagram-graph';
import { item } from './test-items';

// docs/specs/026-plan/view-as-diagram.md "What is drawn": cards as boxes in their columns' lanes, Blocked By links as
// arrows, the critical path the heaviest chain of open cards by their days.

const card = (
  title: string,
  status: string,
  blockers: string[] = [],
  extra: Record<string, unknown> = {},
) => item({ title, status, ...(blockers.length ? { [BLOCKED_BY.id]: blockers } : {}), ...extra });
const map = (items: Item[]) => new Map(items.map((i) => [i.id, i]));
const link = (id: string) => `https://lp.test/project/p#item=${id}`;
const graphOf = (items: Item[], over: Partial<Parameters<typeof planDiagramGraph>[0]> = {}) =>
  planDiagramGraph({
    setup: presetSetup('kanban'),
    items: map(items),
    types: PLAN_TYPES,
    link,
    ...over,
  });

describe('criticalPathOf', () => {
  it('is the heaviest chain, by weight, not by length', () => {
    const w: Record<string, number> = { a: 1, b: 1, c: 1, d: 10 };
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'a', to: 'd' },
    ];
    expect(criticalPathOf(['a', 'b', 'c', 'd'], edges, (id) => w[id]!)).toEqual(['a', 'd']);
    expect(criticalPathOf(['a', 'b', 'c', 'd'], edges, () => 1)).toEqual(['a', 'b', 'c']);
  });

  it('is none without links, and never reaches into a loop', () => {
    expect(criticalPathOf(['a'], [], () => 1)).toEqual([]);
    const loop = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
      { from: 'x', to: 'q' },
    ];
    expect(criticalPathOf(['a', 'b'], loop, () => 1)).toEqual([]);
  });
});

describe('planDiagramGraph', () => {
  it('draws cards in their lanes, links as arrows, done cards quiet and off the path', () => {
    const design = card('Design', 'todo', [], { start: '2026-12-01', due: '2026-12-10' });
    const build = card('Build', 'doing', [design.id]);
    const ship = card('Ship', 'todo', [build.id]);
    const old = card('Old', 'done');
    const after = card('After old', 'todo', [old.id]);
    const g = graphOf([design, build, ship, old, after]);
    expect(g.title).toBe(presetSetup('kanban').title.trim() || 'Board');
    expect(g.lanes.map((l) => l.label)).toEqual(['To Do', 'In Progress', 'Done']);
    expect(g.nodes.find((n) => n.card === design.id)).toMatchObject({
      lane: g.lanes[0]!.id,
      done: false,
      critical: true,
      link: link(design.id),
    });
    expect(g.nodes.find((n) => n.card === old.id)).toMatchObject({ done: true, critical: false });
    expect(g.edges).toHaveLength(3);
    expect(
      g.edges
        .filter((e) => e.critical)
        .map((e) => `${e.from}>${e.to}`)
        .sort(),
    ).toEqual([`${design.id}>${build.id}`, `${build.id}>${ship.id}`].sort());
    expect(criticalPathLabels(g)).toEqual(
      [design, build, ship].map((c) => g.nodes.find((n) => n.card === c.id)!.label),
    );
    expect(g.total).toBe(5);
  });

  it('cuts at max, counting every card, keeping links only between drawn cards', () => {
    const a = card('A', 'todo');
    const b = card('B', 'todo', [a.id]);
    const c = card('C', 'todo', [b.id]);
    const g = graphOf([a, b, c], { max: 2 });
    expect(g.nodes).toHaveLength(2);
    expect(g.total).toBe(3);
    expect(g.edges).toHaveLength(1);
  });

  it('draws what the filter shows', () => {
    const a = card('Alpha', 'todo');
    const b = card('Beta', 'todo');
    const g = graphOf([a, b], { quick: { text: 'alpha' } });
    expect(g.nodes.map((n) => n.card)).toEqual([a.id]);
  });

  it('cuts long labels and names an untitled lane', () => {
    const long = card('x'.repeat(300), 'todo');
    const setup = presetSetup('kanban');
    setup.columns[1]!.name = '';
    const g = graphOf([long], { setup });
    expect(g.nodes[0]!.label.length).toBeLessThanOrEqual(PLAN_GRAPH_LABEL_MAX);
    expect(g.lanes[0]!.label).toBe('Untitled');
    expect(criticalPathLabels(g)).toEqual([]);
  });

  it('holds at most PLAN_GRAPH_LINKS_MAX links', () => {
    const roots = Array.from({ length: 20 }, (_, i) => card(`R${i}`, 'todo'));
    const rootIds = roots.map((r) => r.id);
    const leaves = Array.from({ length: 60 }, (_, i) => card(`L${i}`, 'todo', rootIds));
    const g = graphOf([...roots, ...leaves]);
    expect(g.edges.length).toBe(PLAN_GRAPH_LINKS_MAX);
  });
});

describe('planGraphHash', () => {
  it('changes when anything drawn changes, and only then', () => {
    const a = card('A', 'todo');
    const one = planGraphHash(graphOf([a]));
    expect(planGraphHash(graphOf([a]))).toBe(one);
    expect(planGraphHash(graphOf([{ ...a, fields: { ...a.fields, title: 'B' } }]))).not.toBe(one);
  });
});
