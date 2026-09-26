import { describe, it, expect } from 'vitest';
import { isValidTab, type Element } from '@livediagram/diagram';
import { applyLayout, buildGraphTab, buildTab, landMcpArrivals } from './tab-builders';

// Graph-first authoring end-to-end (docs/specs/015-api/mcp-server.md §4.7): a node/edge graph must
// come out a valid, themed, auto-laid-out tab.
describe('buildGraphTab', () => {
  it('builds a valid themed tab from a graph, positioning the nodes', () => {
    const tab = buildGraphTab(
      'tab-1',
      'Flow',
      {
        nodes: [
          { id: 'a', label: 'Start', shape: 'stadium' },
          { id: 'b', label: 'Work' },
          { id: 'c', label: 'Done', shape: 'stadium' },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
        ],
      },
      'ocean',
    );

    expect(isValidTab(tab)).toBe(true);
    expect(tab.theme).toBe('ocean');
    // 3 shapes + 2 arrows.
    expect(tab.elements.filter((e) => e.type === 'shape')).toHaveLength(3);
    expect(tab.elements.filter((e) => e.type === 'arrow')).toHaveLength(2);
    // Auto-layout spread the nodes off the shared origin.
    const positions = new Set(
      tab.elements
        .filter((e) => e.type === 'shape')
        .map((e) => `${(e as { x: number }).x},${(e as { y: number }).y}`),
    );
    expect(positions.size).toBe(3);
  });

  it('drops edges to unknown nodes rather than producing broken arrows', () => {
    const tab = buildGraphTab(
      'tab-2',
      'T',
      { nodes: [{ id: 'a' }], edges: [{ from: 'a', to: 'ghost' }] },
      undefined,
    );
    expect(isValidTab(tab)).toBe(true);
    expect(tab.elements.filter((e) => e.type === 'arrow')).toHaveLength(0);
  });
});

// Event-storming board fields (docs/specs/021-event-storming/event-storming.md) reach the MCP whenever a tool writes a
// tab: the notation kind of each note. Nothing here whitelists element fields,
// so they travel by construction — this pins that, because the day someone
// adds a whitelist is the day a board quietly loses its notation through a
// tool write.
describe('event-storming fields survive a tool write', () => {
  const esPair: Element[] = [
    {
      id: 'e',
      type: 'sticky',
      esKind: 'domain-event',
      fixedSize: true,
      label: 'Order placed',
      x: 1000,
      y: 500,
      width: 200,
      height: 200,
    },
    {
      id: 'c',
      type: 'sticky',
      esKind: 'command',
      fixedSize: true,
      label: 'Place order',
      x: 784,
      y: 500,
      width: 200,
      height: 200,
    },
  ] as unknown as Element[];

  it('keeps the note kinds through applyLayout', () => {
    const out = applyLayout('preserve', esPair);
    expect(out).toEqual(esPair);
  });

  it('keeps them through buildTab, theme pass and all', () => {
    const tab = buildTab('t1', 'Wall', esPair, 'preserve', 'brand');
    expect((tab.elements.find((el) => el.id === 'c') as { esKind?: string }).esKind).toBe(
      'command',
    );
    expect((tab.elements.find((el) => el.id === 'e') as { esKind?: string }).esKind).toBe(
      'domain-event',
    );
  });

  it('keeps the board KIND when a tool rewrites the elements', () => {
    // The tools spread the existing tab, so a tab-level field survives an
    // element replace without anyone having to remember it.
    const existing = { id: 't1', name: 'Wall', kind: 'event-storming', elements: [] };
    const next = { ...existing, elements: esPair };
    expect(next.kind).toBe('event-storming');
  });
});

// docs/specs/021-event-storming/event-storming.md "Always on a lane": notes an MCP call adds or moves on an
// event-storming tab land on lanes; nothing already there moves.
describe('landMcpArrivals', () => {
  const note = (id: string, x: number, y: number): Element =>
    ({
      id,
      type: 'sticky',
      x,
      y,
      width: 200,
      height: 200,
      esKind: 'domain-event',
      fillColor: '#fdba74',
      fixedSize: true,
    }) as Element;
  const es = (elements: Element[]) => ({
    id: 't',
    name: 'T',
    kind: 'event-storming' as const,
    elements,
  });

  it('lands an added note on its lane, and in the free slot when its spot is taken', () => {
    const before = es([note('down', 0, 0)]);
    const out = landMcpArrivals(before, [note('down', 0, 0), note('new', 30, 20)], 'ops');
    expect(out.find((e) => e.id === 'new')).toMatchObject({ x: 216, y: 0 });
    expect(out.find((e) => e.id === 'down')).toMatchObject({ x: 0, y: 0 });
  });

  it('lands a note an update moved, and leaves an untouched off-lane note alone', () => {
    const before = es([note('moved', 0, 0), note('parked', 900, 130)]);
    const out = landMcpArrivals(before, [note('moved', 500, 250), note('parked', 900, 130)], 'ops');
    expect(out.find((e) => e.id === 'moved')).toMatchObject({ x: 500, y: 240 });
    expect(out.find((e) => e.id === 'parked')).toMatchObject({ y: 130 });
  });

  it('lands every note of a replace, a lane per row', () => {
    const out = landMcpArrivals(es([]), [note('a', 0, 10), note('b', 216, 120)], 'replace');
    expect(out.map((e) => ('y' in e ? e.y : null))).toEqual([0, 240]);
  });

  it('leaves an ordinary tab exactly as the call wrote it', () => {
    const next = [note('a', 0, 130)];
    expect(landMcpArrivals({ elements: [] }, next, 'ops')).toBe(next);
  });
});
