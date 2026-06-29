import { describe, it, expect } from 'vitest';
import { serializeTab } from './serialize';
import { parseTab } from './parse';
import { isValidTab } from '../validate';
import type { Element, Tab } from '../index';

// A fixture exercising every element kind and every endpoint kind, with explicit
// geometry + anchors so no auto-layout / auto-anchor pass runs — the round-trip
// must then be exact (ids, shapes, labels, pinned endpoints, styling, settings).
function fixture(): Tab {
  const elements: Element[] = [
    {
      id: 'n1',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 120,
      height: 120,
      label: 'Start',
      textSize: 'lg',
      fillColor: '#eeeeee',
      strokeColor: '#111111',
    },
    {
      id: 'n2',
      type: 'shape',
      shape: 'cylinder',
      x: 400,
      y: 0,
      width: 100,
      height: 140,
      label: 'DB',
    },
    { id: 't1', type: 'text', x: 0, y: 300, width: 220, height: 64, label: 'Caption' },
    { id: 's1', type: 'sticky', x: 300, y: 300, width: 200, height: 200, label: 'Note' },
    {
      id: 'tb1',
      type: 'table',
      x: 0,
      y: 500,
      width: 360,
      height: 150,
      cells: [
        ['A', 'B'],
        ['1', '2'],
      ],
      headerRow: true,
    },
    {
      id: 'im1',
      type: 'image',
      x: 600,
      y: 500,
      width: 200,
      height: 150,
      imageId: 'img-123',
      objectFit: 'cover',
    },
    {
      id: 'fh1',
      type: 'freehand',
      x: 600,
      y: 0,
      width: 200,
      height: 150,
      closed: false,
      points: [
        { nx: 0, ny: 0 },
        { nx: 1, ny: 1 },
      ],
      strokeColor: '#333333',
    },
    { id: 'an1', type: 'annotation', x: 900, y: 0, width: 56, height: 56, note: 'hello there' },
    {
      id: 'lc1',
      type: 'link-card',
      x: 900,
      y: 300,
      width: 280,
      height: 120,
      link: { kind: 'url', url: 'https://example.com' },
    },
    // pinned -> pinned, with a manual anchor on the `to` end + rich styling
    {
      id: 'a1',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'n1', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'n2', anchor: 'w', manual: true },
      label: 'submit',
      arrowStyle: 'curved',
      arrowEnds: 'both',
      strokeColor: '#0ea5e9',
    },
    // pinned -> free
    {
      id: 'a2',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'n2', anchor: 's' },
      to: { kind: 'free', x: 640, y: 400 },
      strokeWidth: 2,
    },
    // on-arrow -> pinned (a message hung off arrow a1, spec/50)
    {
      id: 'a3',
      type: 'arrow',
      from: { kind: 'on-arrow', arrowId: 'a1', t: 0.5 },
      to: { kind: 'pinned', elementId: 's1', anchor: 'nw' },
      label: 'msg',
    },
  ];
  return {
    id: 'tab-fixture',
    name: 'Round trip',
    elements,
    theme: 'ocean',
    font: 'inter',
    backgroundPattern: 'grid',
    backgroundColor: '#ffffff',
    backgroundOpacity: 0.9,
    defaultTextSize: 'sm',
  };
}

describe('text DSL round-trip', () => {
  it('reproduces every element + endpoint kind exactly', () => {
    const tab = fixture();
    const text = serializeTab(tab);
    const { tab: back, warnings } = parseTab(text);
    expect(warnings).toEqual([]);
    // Same tab but for the freshly-minted id.
    expect({ ...back, id: 'X' }).toEqual({ ...tab, id: 'X' });
  });

  it('is text-stable (serialize -> parse -> serialize is a fixed point)', () => {
    const text = serializeTab(fixture());
    const reserialized = serializeTab(parseTab(text).tab);
    expect(reserialized).toBe(text);
  });

  it('produces a structurally valid tab', () => {
    const { tab } = parseTab(serializeTab(fixture()));
    expect(isValidTab(tab)).toBe(true);
  });
});

describe('text DSL parsing (hand-authored)', () => {
  it('lays out a position-less graph and pins arrows to nodes', () => {
    const src = `diagram "Flow" {
      a square "A"
      b square "B"
      c square "C"
      a -> b "next"
      b -> c
    }`;
    const { tab } = parseTab(src);
    const shapes = tab.elements.filter((e) => e.type === 'shape');
    const arrows = tab.elements.filter((e) => e.type === 'arrow');
    expect(shapes).toHaveLength(3);
    expect(arrows).toHaveLength(2);
    // Auto-layout gave the nodes a real arrangement (not all stacked at 0,0).
    const xs = new Set(shapes.map((s) => (s as { x: number }).x));
    const ys = new Set(shapes.map((s) => (s as { y: number }).y));
    expect(xs.size + ys.size).toBeGreaterThan(2);
    // Bare arrows pinned to their nodes with a real anchor.
    for (const arrow of arrows) {
      const a = arrow as { from: { kind: string; anchor?: string }; to: { kind: string } };
      expect(a.from.kind).toBe('pinned');
      expect(a.to.kind).toBe('pinned');
      expect(['n', 'e', 's', 'w']).toContain(a.from.anchor);
    }
    expect(isValidTab(tab)).toBe(true);
  });

  it('tolerates comments, blank lines, and forward references', () => {
    const src = `diagram "Tolerant" {
      # a leading comment
      first -> second   # edge before its nodes are declared

      first square "First"
      second circle "Second"  # trailing comment
    }`;
    const { tab, warnings } = parseTab(src);
    expect(warnings).toEqual([]);
    expect(tab.elements.filter((e) => e.type === 'shape')).toHaveLength(2);
    expect(tab.elements.filter((e) => e.type === 'arrow')).toHaveLength(1);
  });

  it('keeps unknown attribute keys instead of rejecting them', () => {
    const src = `diagram "Unknown" {
      n1 square "N" @0,0 120x120 { somethingNew: 42, futureFlag: true }
    }`;
    const { tab } = parseTab(src);
    const n1 = tab.elements[0] as unknown as Record<string, unknown>;
    expect(n1.somethingNew).toBe(42);
    expect(n1.futureFlag).toBe(true);
  });

  it('does not mistake a node whose label contains "->" for an edge', () => {
    const tab: Tab = {
      id: 't',
      name: 'Arrowy label',
      elements: [
        {
          id: 'n1',
          type: 'shape',
          shape: 'square',
          x: 0,
          y: 0,
          width: 120,
          height: 120,
          label: 'A -> B',
        },
      ],
    };
    const { tab: back } = parseTab(serializeTab(tab));
    expect(back.elements).toHaveLength(1);
    expect(back.elements[0]!.type).toBe('shape');
    expect((back.elements[0] as { label?: string }).label).toBe('A -> B');
  });

  it('round-trips a label ending in a backslash and a name containing a brace', () => {
    const tab: Tab = {
      id: 't',
      name: 'a{b}c',
      elements: [
        {
          id: 'n1',
          type: 'shape',
          shape: 'square',
          x: 0,
          y: 0,
          width: 120,
          height: 120,
          label: 'C:\\',
        },
      ],
    };
    const { tab: back } = parseTab(serializeTab(tab));
    expect(back.name).toBe('a{b}c');
    expect((back.elements[0] as { label?: string }).label).toBe('C:\\');
  });

  it('accepts the documented `: "label"` edge form', () => {
    const src = `diagram "Colon" {
      a square "A" @0,0 120x120
      b square "B" @300,0 120x120
      a.e -> b.w : "submit"
    }`;
    const { tab } = parseTab(src);
    const arrow = tab.elements.find((e) => e.type === 'arrow') as { label?: string };
    expect(arrow.label).toBe('submit');
  });

  it('preserves explicit positions even when nodes sit close together', () => {
    const tab: Tab = {
      id: 't',
      name: 'Compact',
      elements: [
        { id: 'a', type: 'shape', shape: 'square', x: 100, y: 100, width: 120, height: 120 },
        { id: 'b', type: 'shape', shape: 'square', x: 110, y: 110, width: 120, height: 120 },
        {
          id: 'e1',
          type: 'arrow',
          from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
          to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
        },
      ],
    };
    const { tab: back } = parseTab(serializeTab(tab));
    const a = back.elements.find((e) => e.id === 'a') as { x: number; y: number };
    expect(a).toMatchObject({ x: 100, y: 100 });
  });

  it('keeps an extreme numeric attribute as a number, not a string', () => {
    const tab: Tab = {
      id: 't',
      name: 'Tiny',
      elements: [
        {
          id: 'n1',
          type: 'shape',
          shape: 'square',
          x: 0,
          y: 0,
          width: 120,
          height: 120,
          opacity: 1e-7,
        },
      ],
    };
    const { tab: back } = parseTab(serializeTab(tab));
    expect((back.elements[0] as { opacity?: number }).opacity).toBe(1e-7);
  });

  it('throws a clear error when there is no diagram block', () => {
    expect(() => parseTab('not a diagram')).toThrow(/diagram/);
  });
});
