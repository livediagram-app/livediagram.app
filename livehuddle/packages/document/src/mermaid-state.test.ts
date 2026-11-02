import { describe, it, expect } from 'vitest';
import { parseMermaid } from './mermaid';
import { layoutClusteredGraph } from './auto-layout-clusters';
import { isValidTab } from './validate';
import { layoutGraph } from './graph-input';
import { shapeGeometry } from './shape-geometry';

// Tested through parseMermaid so the dispatch is covered too.
describe('parseMermaid: state diagrams', () => {
  it('parses transitions, labels, and [*] start/end pseudo-states', () => {
    const r = parseMermaid(`stateDiagram-v2
  [*] --> Idle
  Idle --> Running : start
  Running --> [*]`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const byId = Object.fromEntries(r.graph.nodes.map((n) => [n.id, n]));
    expect(byId.Idle).toMatchObject({ label: 'Idle', shape: 'stadium' });
    expect(byId.__start__).toMatchObject({ label: '', shape: 'circle' });
    // The end a bullseye, as UML draws it.
    expect(byId.__end__).toMatchObject({ label: '', shape: 'final-state' });
    expect(r.graph.edges).toEqual([
      { from: '__start__', to: 'Idle' },
      { from: 'Idle', to: 'Running', label: 'start' },
      { from: 'Running', to: '__end__' },
    ]);
  });

  it('accepts the v1 header and a top-level direction', () => {
    const r = parseMermaid('stateDiagram\n  direction LR\n  A --> B');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.direction).toBe('LR');
  });

  it('reads state descriptions (`state "…" as id` and `id : …`)', () => {
    const r = parseMermaid(`stateDiagram-v2
  state "Waiting for input" as w
  r : Actively running
  w --> r`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const byId = Object.fromEntries(r.graph.nodes.map((n) => [n.id, n]));
    expect(byId.w!.label).toBe('Waiting for input');
    expect(byId.r!.label).toBe('Actively running');
  });

  it('maps <<choice>> to a diamond and <<fork>>/<<join>> to squares', () => {
    const r = parseMermaid(`stateDiagram-v2
  state c <<choice>>
  state f <<fork>>
  A --> c
  c --> f`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const byId = Object.fromEntries(r.graph.nodes.map((n) => [n.id, n]));
    expect(byId.c!.shape).toBe('diamond');
    expect(byId.f!.shape).toBe('square');
  });

  it('turns composite states into clusters, with their own [*] pair', () => {
    const r = parseMermaid(`stateDiagram-v2
  state Active {
    [*] --> Working
    Working --> Done
  }
  [*] --> Active
  Active --> [*]`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.clusters).toEqual([
      { id: 'Active', label: 'Active', members: ['Active.__start__', 'Working', 'Done'] },
    ]);
    // The transitions to/from the composite pin to the frame: no `Active`
    // node exists.
    expect(r.graph.nodes.some((n) => n.id === 'Active')).toBe(false);
    expect(r.graph.edges).toContainEqual({ from: '__start__', to: 'Active' });
  });

  it('keeps transitions to an EMPTY composite (its node survives, no frame)', () => {
    const r = parseMermaid(`stateDiagram-v2
  state Empty {
  }
  A --> Empty`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // No members means no frame; the auto node must survive so the
    // transition keeps a target instead of silently vanishing.
    expect(r.graph.clusters ?? []).toEqual([]);
    expect(r.graph.nodes.some((n) => n.id === 'Empty')).toBe(true);
    expect(r.graph.edges).toContainEqual({ from: 'A', to: 'Empty' });
  });

  it('folds nested composites and titles quoted composites', () => {
    const r = parseMermaid(`stateDiagram-v2
  state "Outer title" as outer {
    A
    state inner {
      B
    }
  }
  A --> B`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The nested composite's container folds away; its contents remain.
    expect(r.graph.clusters).toEqual([{ id: 'outer', label: 'Outer title', members: ['A', 'B'] }]);
  });

  // docs/specs/020-import-export/mermaid.md: a transition to a folded composite points at the frame it folded into.
  it('points a transition to a folded nested composite at its outer frame', () => {
    const r = parseMermaid(`stateDiagram-v2
  state outer {
    A
    state inner {
      B
    }
    A --> inner
  }
  X --> inner
  inner --> Y`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.nodes.map((n) => n.id).sort()).toEqual(['A', 'B', 'X', 'Y']);
    expect(r.graph.edges).toEqual([
      { from: 'A', to: 'outer' },
      { from: 'X', to: 'outer' },
      { from: 'outer', to: 'Y' },
    ]);
    expect(r.graph.clusters).toEqual([{ id: 'outer', label: 'outer', members: ['A', 'B'] }]);
  });

  it('keeps a state written out under a folded composite id', () => {
    const r = parseMermaid(`stateDiagram-v2
  state outer {
    state inner {
      B
    }
  }
  inner : Inner state
  inner --> B`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.nodes.find((n) => n.id === 'inner')?.label).toBe('Inner state');
    expect(r.graph.edges).toEqual([{ from: 'inner', to: 'B' }]);
  });

  it('keeps the box when the outer composite holds nothing else, so the transition keeps a target', () => {
    const r = parseMermaid(`stateDiagram-v2
  state outer {
    state inner {
    }
  }
  X --> inner`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.edges).toEqual([{ from: 'X', to: 'inner' }]);
    expect(r.graph.nodes.map((n) => n.id).sort()).toEqual(['X', 'inner']);
  });

  it('skips notes (block and one-line) and concurrency separators', () => {
    const r = parseMermaid(`stateDiagram-v2
  A --> B
  note right of A
    a long note
    B --> C
  end note
  note left of B : short note
  --`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The transition inside the note block must NOT parse.
    expect(r.graph.edges).toEqual([{ from: 'A', to: 'B' }]);
  });

  it('lays out into a valid tab via the cluster layout', () => {
    const r = parseMermaid(`stateDiagram-v2
  state Active {
    [*] --> Working
  }
  [*] --> Active`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const els = layoutClusteredGraph(r.graph, { direction: r.direction });
    expect(isValidTab({ id: 't', name: 'T', elements: els })).toBe(true);
    expect(els.some((e) => e.type === 'shape' && 'shape' in e && e.shape === 'frame')).toBe(true);
  });

  it('errors on an empty state diagram', () => {
    const r = parseMermaid('stateDiagram-v2');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/states/i);
  });
});

describe('the end as a bullseye', () => {
  it('draws an unlabelled final-state node as one 34 px bullseye in the accent, a geometry of ring and dot', () => {
    const els = layoutGraph({
      nodes: [
        { id: 's', shape: 'circle' },
        { id: 'a', label: 'Open' },
        { id: 'e', shape: 'final-state' },
      ],
      edges: [
        { from: 's', to: 'a' },
        { from: 'a', to: 'e' },
      ],
    });
    expect(els.find((el) => el.id === 'e')).toMatchObject({
      shape: 'final-state',
      width: 34,
      height: 34,
      colorPreset: 'solid',
    });
    expect(els.find((el) => el.id === 's')).toMatchObject({ width: 28 });
    expect(shapeGeometry('final-state')!.parts.map((p) => p.role)).toEqual(['limb', 'head']);
  });
});
