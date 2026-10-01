import { describe, expect, it } from 'vitest';
import {
  isValidElement,
  type ArrowElement,
  type FreehandElement,
  type ShapeElement,
  type StickyElement,
  type TextElement,
} from '@livediagram/document';
import { landBoardScene } from './land';
import type { SceneItem } from './scene';
import { boardScene, countingIds, sceneText } from './test-scenes';

// docs/specs/020-import-export/board-scene.md "Profiles": the diagram profile reproduces the
// Excalidraw file importer's mapping (apps/live/lib/excalidraw-import.test.ts), through the scene.
function land(items: SceneItem[]) {
  const r = landBoardScene(boardScene(items), {
    profile: 'diagram',
    placement: { kind: 'origin' },
    mintId: countingIds(),
  });
  if (!r.ok) throw new Error(r.message);
  expect(r.elements.every(isValidElement)).toBe(true);
  return r.elements;
}
const stroke = { colour: { hex: '#1e1e1e' }, widthPx: 2 };
const rect = (over: Partial<SceneItem> = {}): SceneItem =>
  ({
    key: 'r1',
    kind: 'shape',
    shape: 'rectangle',
    x: 10,
    y: 20,
    width: 120,
    height: 60,
    rounded: true,
    stroke,
    fill: { hex: '#ffec99' },
    ...over,
  }) as SceneItem;

describe('the diagram profile', () => {
  it('maps rectangle / ellipse / diamond, colours verbatim', () => {
    const shapes = land([
      rect(),
      rect({ key: 'e', shape: 'ellipse', rounded: false } as Partial<SceneItem>),
      rect({ key: 'd', shape: 'diamond', rounded: false } as Partial<SceneItem>),
    ]) as ShapeElement[];
    expect(shapes.map((s) => s.shape)).toEqual(['square', 'circle', 'diamond']);
    expect(shapes[0]!.borderRadius).toBe('md');
    expect(shapes[1]!.borderRadius).toBeUndefined();
    expect(shapes[0]).toMatchObject({
      x: 10,
      y: 20,
      width: 120,
      height: 60,
      fillColor: '#ffec99',
      strokeColor: '#1e1e1e',
      strokeWidth: 'medium',
    });
    expect(shapes[0]!.penColour).toBeUndefined();
  });

  it('keeps an unfilled shape transparent and a label in the diagram sizes', () => {
    const [s] = land([
      rect({
        fill: undefined,
        label: sceneText('Hello', { fontPx: 28, colour: { hex: '#e03131' }, family: 'sans' }),
      } as Partial<SceneItem>),
    ]) as ShapeElement[];
    expect(s).toMatchObject({
      fillColor: 'transparent',
      label: 'Hello',
      textColor: '#e03131',
      textSize: 'lg',
    });
  });

  it('maps standalone text with its colour, size bucket, font and alignment', () => {
    const [t] = land([
      {
        key: 't',
        kind: 'text',
        x: 0,
        y: 0,
        width: 100,
        height: 25,
        autoWidth: true,
        text: sceneText('Note', {
          fontPx: 16,
          family: 'mono',
          colour: { hex: '#2f9e44' },
          alignX: 'center',
        }),
      },
    ]) as TextElement[];
    expect(t).toMatchObject({
      type: 'text',
      label: 'Note',
      textColor: '#2f9e44',
      textSize: 'sm',
      font: 'roboto-mono',
      textAlignX: 'center',
    });
    expect(t!.textScale).toBeUndefined();
    expect(t!.autoWidth).toBeUndefined();
  });

  it('maps opacity, rotation, lock, link, dash and width buckets', () => {
    const [a] = land([
      rect({
        rotationDeg: 90,
        locked: true,
        link: 'https://example.com',
        stroke: { colour: { hex: '#1e1e1e', alpha: 0.5 }, widthPx: 4, dash: 'dashed' },
      } as Partial<SceneItem>),
    ]) as ShapeElement[];
    expect(a).toMatchObject({
      opacity: 0.5,
      rotation: 90,
      locked: true,
      link: { kind: 'url', url: 'https://example.com' },
      strokeStyle: 'dashed',
      strokeWidth: 'thick',
    });
  });

  it('maps a two-point line to a headless arrow, width verbatim', () => {
    const [a] = land([
      {
        key: 'l',
        kind: 'polyline',
        points: [
          { x: 10, y: 10 },
          { x: 100, y: 50 },
        ],
        stroke,
      },
    ]) as ArrowElement[];
    expect(a).toMatchObject({
      type: 'arrow',
      arrowEnds: 'none',
      to: { kind: 'free', x: 100, y: 50 },
      strokeWidth: 2,
      strokeColor: '#1e1e1e',
    });
  });

  it('maps a closed multi-point line to a closed straight-edged freehand', () => {
    const [p] = land([
      {
        key: 'p',
        kind: 'polyline',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 80 },
          { x: 0, y: 0 },
        ],
        stroke,
        closed: true,
        fill: { hex: '#b2f2bb' },
      },
    ]) as FreehandElement[];
    expect(p).toMatchObject({
      type: 'freehand',
      straightEdges: true,
      closed: true,
      fillColor: '#b2f2bb',
    });
    expect(p!.points).toHaveLength(3);
  });

  it('maps ink to a normalised pencil freehand, closed when its ends meet', () => {
    const [f, g] = land([
      {
        key: 'f',
        kind: 'ink',
        points: [
          { x: 10, y: 10 },
          { x: 50, y: 30 },
          { x: 90, y: 10 },
        ],
        stroke: { colour: { hex: '#1971c2' }, widthPx: 2 },
      },
      {
        key: 'g',
        kind: 'ink',
        points: [
          { x: 0, y: 0 },
          { x: 40, y: 30 },
          { x: 80, y: 0 },
          { x: 0, y: 0 },
        ],
        stroke,
        fill: { hex: '#ffd43b' },
      },
    ]) as FreehandElement[];
    expect(f).toMatchObject({
      closed: false,
      x: 10,
      y: 10,
      width: 80,
      height: 20,
      strokeColor: '#1971c2',
    });
    expect(f!.straightEdges).toBeUndefined();
    expect(f!.penWidth).toBeUndefined();
    expect(f!.points[1]).toEqual({ nx: 0.5, ny: 1 });
    expect(g).toMatchObject({ closed: true, fillColor: '#ffd43b' });
    expect(g!.points).toHaveLength(3);
  });

  it('pins arrows and carries their label', () => {
    const els = land([
      rect(),
      {
        key: 'a',
        kind: 'connector',
        points: [
          { x: 130, y: 50 },
          { x: 300, y: 50 },
        ],
        stroke,
        heads: { end: 'triangle' },
        from: 'r1',
        label: sceneText('yes'),
      },
    ]);
    const a = els[1] as ArrowElement;
    expect(a.from).toMatchObject({ kind: 'pinned', elementId: els[0]!.id });
    expect(a.label).toBe('yes');
    expect(a.arrowheadShape).toBeUndefined();
  });

  it('keeps a sticky note’s fill verbatim', () => {
    const [n] = land([
      {
        key: 'n',
        kind: 'sticky',
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        fill: { hex: '#ffdf6b' },
        text: sceneText('Idea'),
      },
    ]) as StickyElement[];
    expect(n).toMatchObject({ type: 'sticky', fillColor: '#ffdf6b', label: 'Idea' });
  });
});
