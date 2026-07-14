import { describe, expect, it } from 'vitest';
import { buildElementsFromExcalidraw } from './excalidraw-import';
import type {
  ArrowElement,
  FreehandElement,
  ShapeElement,
  TextElement,
} from '@livediagram/diagram';

// Minimal scene wrapper — only the fields the importer reads.
const scene = (elements: unknown[], appState?: Record<string, unknown>) =>
  JSON.stringify({ type: 'excalidraw', version: 2, elements, ...(appState ? { appState } : {}) });

const rect = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  type: 'rectangle',
  x: 10,
  y: 20,
  width: 120,
  height: 60,
  strokeColor: '#1e1e1e',
  backgroundColor: '#ffec99',
  strokeWidth: 2,
  strokeStyle: 'solid',
  opacity: 100,
  angle: 0,
  groupIds: [],
  roundness: { type: 3 },
  isDeleted: false,
  ...over,
});

describe('buildElementsFromExcalidraw envelope', () => {
  it('rejects non-JSON', () => {
    const r = buildElementsFromExcalidraw('nope');
    expect(r.ok).toBe(false);
  });

  it('rejects JSON that is not an excalidraw scene', () => {
    const r = buildElementsFromExcalidraw('{"kind":"livediagram.tab"}');
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toMatch(/excalidraw/i);
  });

  it('rejects a scene missing its elements array', () => {
    const r = buildElementsFromExcalidraw('{"type":"excalidraw"}');
    expect(r.ok).toBe(false);
  });

  it('skips isDeleted elements and counts unknown types', () => {
    const r = buildElementsFromExcalidraw(
      scene([rect({ isDeleted: true }), { id: 'e1', type: 'embeddable', x: 0, y: 0 }]),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.elements).toHaveLength(0);
    expect(r.skipped).toBe(1);
  });

  it('carries the scene background colour', () => {
    const r = buildElementsFromExcalidraw(scene([], { viewBackgroundColor: '#f8f9fa' }));
    if (!r.ok) throw new Error(r.error);
    expect(r.backgroundColor).toBe('#f8f9fa');
  });
});

describe('boxed element mapping', () => {
  it('maps rectangle/ellipse/diamond to the matching shapes', () => {
    const r = buildElementsFromExcalidraw(
      scene([
        rect(),
        rect({ id: 'e1', type: 'ellipse', roundness: null }),
        rect({ id: 'd1', type: 'diamond', roundness: null }),
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const shapes = r.elements as ShapeElement[];
    expect(shapes.map((s) => s.shape)).toEqual(['square', 'circle', 'diamond']);
    expect(shapes[0]!.borderRadius).toBe('md');
    expect(shapes[1]!.borderRadius).toBeUndefined();
    expect(shapes[0]!).toMatchObject({
      x: 10,
      y: 20,
      width: 120,
      height: 60,
      fillColor: '#ffec99',
      strokeColor: '#1e1e1e',
      strokeWidth: 'medium',
    });
  });

  it('re-mints ids to fresh UUIDs', () => {
    const r = buildElementsFromExcalidraw(scene([rect()]));
    if (!r.ok) throw new Error(r.error);
    expect(r.elements[0]!.id).not.toBe('r1');
  });

  it('consumes a bound text element as the container label', () => {
    const r = buildElementsFromExcalidraw(
      scene([
        rect(),
        {
          id: 't1',
          type: 'text',
          containerId: 'r1',
          text: 'Hello',
          originalText: 'Hello',
          fontSize: 28,
          strokeColor: '#e03131',
          x: 20,
          y: 40,
          width: 60,
          height: 25,
        },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.elements).toHaveLength(1);
    const shape = r.elements[0] as ShapeElement;
    expect(shape.label).toBe('Hello');
    expect(shape.textColor).toBe('#e03131');
    expect(shape.textSize).toBe('lg');
  });

  it('imports standalone text as a text element with strokeColor as ink', () => {
    const r = buildElementsFromExcalidraw(
      scene([
        {
          id: 't1',
          type: 'text',
          x: 0,
          y: 0,
          width: 100,
          height: 25,
          text: 'Note',
          fontSize: 16,
          fontFamily: 3,
          strokeColor: '#2f9e44',
          textAlign: 'center',
        },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const text = r.elements[0] as TextElement;
    expect(text.type).toBe('text');
    expect(text.label).toBe('Note');
    expect(text.textColor).toBe('#2f9e44');
    expect(text.textSize).toBe('sm');
    expect(text.font).toBe('roboto-mono');
    expect(text.textAlignX).toBe('center');
  });

  it('maps common properties: opacity, angle, group, lock, link, dash', () => {
    const r = buildElementsFromExcalidraw(
      scene([
        rect({
          opacity: 50,
          angle: Math.PI / 2,
          groupIds: ['inner', 'outer'],
          locked: true,
          link: 'https://example.com',
          strokeStyle: 'dashed',
          strokeWidth: 4,
        }),
        rect({ id: 'r2', groupIds: ['inner', 'outer'] }),
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const [a, b] = r.elements as ShapeElement[];
    expect(a!).toMatchObject({
      opacity: 0.5,
      rotation: 90,
      locked: true,
      link: { kind: 'url', url: 'https://example.com' },
      strokeStyle: 'dashed',
      strokeWidth: 'thick',
    });
    // Same outermost excalidraw group -> same minted groupId.
    expect(a!.groupId).toBeDefined();
    expect(a!.groupId).toBe(b!.groupId);
  });

  it('imports frames as frame shapes with their name', () => {
    const r = buildElementsFromExcalidraw(
      scene([rect({ id: 'f1', type: 'frame', name: 'Flow A', roundness: null })]),
    );
    if (!r.ok) throw new Error(r.error);
    const frame = r.elements[0] as ShapeElement;
    expect(frame.shape).toBe('frame');
    expect(frame.label).toBe('Flow A');
  });

  it('imports images as placeholder image elements', () => {
    const r = buildElementsFromExcalidraw(
      scene([rect({ id: 'i1', type: 'image', fileId: 'abc', roundness: null })]),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.elements[0]).toMatchObject({ type: 'image', imageId: null });
  });
});

describe('arrow + line mapping', () => {
  it('binds arrow endpoints to the nearest anchor of the bound elements', () => {
    const r = buildElementsFromExcalidraw(
      scene([
        rect({ id: 'a', x: 0, y: 0, width: 100, height: 100 }),
        rect({ id: 'b', x: 300, y: 0, width: 100, height: 100 }),
        {
          id: 'ar',
          type: 'arrow',
          x: 100,
          y: 50,
          width: 200,
          height: 0,
          points: [
            [0, 0],
            [200, 0],
          ],
          startBinding: { elementId: 'a', focus: 0, gap: 4 },
          endBinding: { elementId: 'b', focus: 0, gap: 4 },
          startArrowhead: null,
          endArrowhead: 'arrow',
        },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const arrow = r.elements.find((e) => e.type === 'arrow') as ArrowElement;
    const [a, b] = r.elements.filter((e) => e.type !== 'arrow');
    expect(arrow.from).toEqual({ kind: 'pinned', elementId: a!.id, anchor: 'e' });
    expect(arrow.to).toEqual({ kind: 'pinned', elementId: b!.id, anchor: 'w' });
    expect(arrow.arrowEnds).toBeUndefined(); // 'to' is the default
    expect(arrow.arrowheadShape).toBe('line'); // excalidraw 'arrow' head = open V
  });

  it('maps unbound multi-point arrows to curved arrows with curvePoints', () => {
    const r = buildElementsFromExcalidraw(
      scene([
        {
          id: 'ar',
          type: 'arrow',
          x: 0,
          y: 0,
          points: [
            [0, 0],
            [50, 80],
            [100, 0],
          ],
          startArrowhead: 'triangle',
          endArrowhead: 'triangle',
        },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const arrow = r.elements[0] as ArrowElement;
    expect(arrow.from).toEqual({ kind: 'free', x: 0, y: 0 });
    expect(arrow.to).toEqual({ kind: 'free', x: 100, y: 0 });
    expect(arrow.arrowStyle).toBe('curved');
    expect(arrow.curvePoints).toEqual([{ dx: 0, dy: 80 }]);
    expect(arrow.arrowEnds).toBe('both');
    // 'triangle' is our default head shape, so the field is omitted.
    expect(arrow.arrowheadShape).toBeUndefined();
  });

  it('maps a 2-point line to a headless arrow', () => {
    const r = buildElementsFromExcalidraw(
      scene([
        {
          id: 'l1',
          type: 'line',
          x: 10,
          y: 10,
          points: [
            [0, 0],
            [90, 40],
          ],
        },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const arrow = r.elements[0] as ArrowElement;
    expect(arrow.type).toBe('arrow');
    expect(arrow.arrowEnds).toBe('none');
    expect(arrow.to).toEqual({ kind: 'free', x: 100, y: 50 });
  });

  it('maps a closed multi-point line to a closed straight-edged freehand', () => {
    const r = buildElementsFromExcalidraw(
      scene([
        {
          id: 'p1',
          type: 'line',
          x: 0,
          y: 0,
          backgroundColor: '#b2f2bb',
          points: [
            [0, 0],
            [100, 0],
            [50, 80],
            [0, 0],
          ],
        },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const poly = r.elements[0] as FreehandElement;
    expect(poly.type).toBe('freehand');
    expect(poly.straightEdges).toBe(true);
    expect(poly.closed).toBe(true);
    expect(poly.points).toHaveLength(3); // closing duplicate dropped
    expect(poly.fillColor).toBe('#b2f2bb');
  });

  it('maps freedraw to a normalised freehand stroke', () => {
    const r = buildElementsFromExcalidraw(
      scene([
        {
          id: 'fd',
          type: 'freedraw',
          x: 10,
          y: 10,
          strokeColor: '#1971c2',
          points: [
            [0, 0],
            [40, 20],
            [80, 0],
          ],
        },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const fh = r.elements[0] as FreehandElement;
    expect(fh.type).toBe('freehand');
    expect(fh.closed).toBe(false);
    expect(fh.straightEdges).toBeUndefined();
    expect(fh).toMatchObject({ x: 10, y: 10, width: 80, height: 20 });
    expect(fh.points[0]).toEqual({ nx: 0, ny: 0 });
    expect(fh.points[1]).toEqual({ nx: 0.5, ny: 1 });
  });

  it('attaches a bound label to an arrow', () => {
    const r = buildElementsFromExcalidraw(
      scene([
        {
          id: 'ar',
          type: 'arrow',
          x: 0,
          y: 0,
          points: [
            [0, 0],
            [100, 0],
          ],
        },
        { id: 't1', type: 'text', containerId: 'ar', text: 'yes', x: 40, y: -10 },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.elements).toHaveLength(1);
    expect((r.elements[0] as ArrowElement).label).toBe('yes');
  });
});
