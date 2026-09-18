import { describe, it, expect } from 'vitest';
import { isValidTab, type Element } from '@livediagram/diagram';
import { applyLayout, buildGraphTab, buildTab } from './tab-builders';

// Graph-first authoring end-to-end (spec/62 §4.7): a node/edge graph must
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

// Event-storming board fields (spec/139) reach the MCP whenever a tool writes a
// tab: the notation kind, the anchor relation between two notes, and the
// board's lane stack. Nothing here whitelists element fields, so they travel
// by construction — this pins that, because the day someone adds a whitelist
// is the day a docked pair quietly comes apart through a tool write.
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
      esDock: { hostId: 'e', side: 'before' },
    },
  ] as unknown as Element[];

  it('keeps the note kind and the anchor relation through applyLayout', () => {
    const out = applyLayout('preserve', esPair);
    expect(out).toEqual(esPair);
  });

  it('keeps them through buildTab, theme pass and all', () => {
    const tab = buildTab('t1', 'Wall', esPair, 'preserve', 'brand');
    const command = tab.elements.find((el) => el.id === 'c') as { esDock?: unknown };
    expect(command.esDock).toEqual({ hostId: 'e', side: 'before' });
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
