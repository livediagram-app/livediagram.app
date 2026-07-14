import { describe, expect, it } from 'vitest';
import { tabToExcalidrawText } from './excalidraw-export';
import type { Element, Tab } from '@livediagram/diagram';

const tab = (elements: Element[], over: Partial<Tab> = {}): Tab => ({
  id: 'tab-1',
  name: 'Test tab',
  elements,
  ...over,
});

// The slice of the emitted excalidraw elements the assertions poke at.
type Out = {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  points?: [number, number][];
  boundElements?: { id: string; type: string }[] | null;
  strokeColor?: string;
  backgroundColor?: string;
  startBinding?: unknown;
  endBinding?: unknown;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
} & Record<string, unknown>;

const parse = (text: string) =>
  JSON.parse(text) as {
    type: string;
    version: number;
    source: string;
    elements: Out[];
    appState: { viewBackgroundColor: string };
    files: Record<string, never>;
  };

describe('tabToExcalidrawText envelope', () => {
  it('emits a valid excalidraw scene envelope', () => {
    const scene = parse(tabToExcalidrawText(tab([], { backgroundColor: '#0f172a' })));
    expect(scene.type).toBe('excalidraw');
    expect(scene.version).toBe(2);
    expect(scene.source).toBe('https://livediagram.app');
    expect(scene.elements).toEqual([]);
    expect(scene.appState.viewBackgroundColor).toBe('#0f172a');
    expect(scene.files).toEqual({});
  });
});

describe('boxed element degradation', () => {
  it('maps square/circle/diamond to rectangle/ellipse/diamond', () => {
    const scene = parse(
      tabToExcalidrawText(
        tab([
          {
            id: 's1',
            type: 'shape',
            shape: 'square',
            x: 0,
            y: 0,
            width: 100,
            height: 60,
            fillColor: '#ffec99',
            strokeColor: '#1e1e1e',
          },
          { id: 's2', type: 'shape', shape: 'circle', x: 0, y: 100, width: 80, height: 80 },
          { id: 's3', type: 'shape', shape: 'diamond', x: 0, y: 200, width: 80, height: 80 },
        ]),
      ),
    );
    expect(scene.elements.map((e) => e.type)).toEqual(['rectangle', 'ellipse', 'diamond']);
    expect(scene.elements[0]).toMatchObject({
      id: 's1',
      x: 0,
      y: 0,
      width: 100,
      height: 60,
      backgroundColor: '#ffec99',
      strokeColor: '#1e1e1e',
      isDeleted: false,
    });
  });

  it('degrades an exotic shape kind to a rectangle with a bound label', () => {
    const scene = parse(
      tabToExcalidrawText(
        tab([
          {
            id: 'c1',
            type: 'shape',
            shape: 'cylinder',
            x: 10,
            y: 10,
            width: 120,
            height: 80,
            label: 'DB',
          },
        ]),
      ),
    );
    expect(scene.elements).toHaveLength(2);
    const [box, label] = scene.elements;
    expect(box!.type).toBe('rectangle');
    expect(box!.boundElements).toEqual([{ id: 'c1-label', type: 'text' }]);
    expect(label!).toMatchObject({
      type: 'text',
      containerId: 'c1',
      text: 'DB',
      originalText: 'DB',
    });
  });

  it('exports text elements as excalidraw text with the ink in strokeColor', () => {
    const scene = parse(
      tabToExcalidrawText(
        tab([
          {
            id: 't1',
            type: 'text',
            x: 5,
            y: 5,
            width: 200,
            height: 30,
            label: 'Title',
            textColor: '#e03131',
            textSize: 'lg',
            textAlignX: 'center',
          },
        ]),
      ),
    );
    expect(scene.elements[0]).toMatchObject({
      type: 'text',
      text: 'Title',
      strokeColor: '#e03131',
      fontSize: 28,
      textAlign: 'center',
      backgroundColor: 'transparent',
      containerId: null,
    });
  });

  it('maps rotation, opacity, group, lock and url links', () => {
    const scene = parse(
      tabToExcalidrawText(
        tab([
          {
            id: 's1',
            type: 'shape',
            shape: 'square',
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            rotation: 90,
            opacity: 0.5,
            groupId: 'g1',
            locked: true,
            link: { kind: 'url', url: 'https://example.com' },
          },
        ]),
      ),
    );
    expect(scene.elements[0]).toMatchObject({
      angle: Math.PI / 2,
      opacity: 50,
      groupIds: ['g1'],
      locked: true,
      link: 'https://example.com',
    });
  });

  it('reverse-maps stroke width and dash presets', () => {
    const scene = parse(
      tabToExcalidrawText(
        tab([
          {
            id: 's1',
            type: 'shape',
            shape: 'square',
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            strokeWidth: 'thick',
            strokeStyle: 'dash-dot',
          },
          {
            id: 's2',
            type: 'shape',
            shape: 'square',
            x: 0,
            y: 20,
            width: 10,
            height: 10,
            strokeWidth: 'none',
          },
        ]),
      ),
    );
    expect(scene.elements[0]).toMatchObject({ strokeWidth: 4, strokeStyle: 'dashed' });
    expect(scene.elements[1]!.strokeColor).toBe('transparent');
  });

  it('exports freehand strokes as freedraw and polygons as closed lines', () => {
    const scene = parse(
      tabToExcalidrawText(
        tab([
          {
            id: 'f1',
            type: 'freehand',
            x: 0,
            y: 0,
            width: 100,
            height: 50,
            closed: false,
            points: [
              { nx: 0, ny: 0 },
              { nx: 0.5, ny: 1 },
              { nx: 1, ny: 0 },
            ],
          },
          {
            id: 'p1',
            type: 'freehand',
            x: 0,
            y: 100,
            width: 100,
            height: 100,
            closed: true,
            straightEdges: true,
            fillColor: '#b2f2bb',
            points: [
              { nx: 0, ny: 0 },
              { nx: 1, ny: 0 },
              { nx: 0.5, ny: 1 },
            ],
          },
        ]),
      ),
    );
    const [draw, poly] = scene.elements;
    expect(draw!.type).toBe('freedraw');
    expect(draw!.points).toEqual([
      [0, 0],
      [50, 50],
      [100, 0],
    ]);
    expect(poly!.type).toBe('line');
    expect(poly!.points).toHaveLength(4); // re-appends the first point to close
    expect(poly!.points![3]).toEqual([0, 0]);
    expect(poly!.backgroundColor).toBe('#b2f2bb');
  });
});

describe('arrow export', () => {
  const boxes: Element[] = [
    { id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 100 },
    { id: 'b', type: 'shape', shape: 'square', x: 300, y: 0, width: 100, height: 100 },
  ];

  it('emits bindings + mirrored boundElements for pinned ends', () => {
    const scene = parse(
      tabToExcalidrawText(
        tab([
          ...boxes,
          {
            id: 'ar',
            type: 'arrow',
            from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
            to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
          },
        ]),
      ),
    );
    const arrow = scene.elements.find((e) => e.type === 'arrow')!;
    expect(arrow.startBinding).toMatchObject({ elementId: 'a' });
    expect(arrow.endBinding).toMatchObject({ elementId: 'b' });
    expect(arrow.x).toBe(100);
    expect(arrow.y).toBe(50);
    expect(arrow.points![arrow.points!.length - 1]).toEqual([200, 0]);
    // Default ends ('to') + default head (filled triangle).
    expect(arrow.startArrowhead).toBeNull();
    expect(arrow.endArrowhead).toBe('triangle');
    // The bound boxes record the arrow so excalidraw keeps rebinding.
    const a = scene.elements.find((e) => e.id === 'a')!;
    expect(a.boundElements).toEqual([{ id: 'ar', type: 'arrow' }]);
  });

  it('flattens curve control points into the point list', () => {
    const scene = parse(
      tabToExcalidrawText(
        tab([
          {
            id: 'ar',
            type: 'arrow',
            from: { kind: 'free', x: 0, y: 0 },
            to: { kind: 'free', x: 100, y: 0 },
            arrowStyle: 'curved',
            curvePoints: [{ dx: 0, dy: 80 }],
            arrowEnds: 'none',
          },
        ]),
      ),
    );
    const arrow = scene.elements[0]!;
    expect(arrow.points).toEqual([
      [0, 0],
      [50, 80],
      [100, 0],
    ]);
    expect(arrow.startArrowhead).toBeNull();
    expect(arrow.endArrowhead).toBeNull();
  });

  it('exports the arrow label as bound text and reverse-maps head shapes', () => {
    const scene = parse(
      tabToExcalidrawText(
        tab([
          {
            id: 'ar',
            type: 'arrow',
            from: { kind: 'free', x: 0, y: 0 },
            to: { kind: 'free', x: 100, y: 0 },
            label: 'yes',
            arrowEnds: 'both',
            arrowheadShape: 'diamond-hollow',
          },
        ]),
      ),
    );
    const [arrow, label] = scene.elements;
    expect(arrow!.boundElements).toEqual([{ id: 'ar-label', type: 'text' }]);
    expect(arrow!.startArrowhead).toBe('diamond_outline');
    expect(arrow!.endArrowhead).toBe('diamond_outline');
    expect(label!).toMatchObject({ type: 'text', containerId: 'ar', text: 'yes' });
  });
});
