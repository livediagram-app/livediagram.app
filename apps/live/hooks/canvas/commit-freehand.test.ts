import { describe, expect, it, vi } from 'vitest';
import type { Element, FreehandElement, ShapeElement, Tab } from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { makeCommitFreehand } from './commit-freehand';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

const board: Tab = { id: 't', name: 'Board', kind: 'whiteboard', elements: [] } as Tab;

function setup(pendingDraw: PendingDraw) {
  let elements: Element[] = [];
  const setPendingDraw = vi.fn();
  const setSelectedId = vi.fn();
  const commit = makeCommitFreehand({
    editsBlocked: false,
    activeTab: board,
    commit: (fn) => {
      elements = fn(elements);
    },
    pendingDraw,
    setPendingDraw,
    setSelectedId,
    highlighterColor: '#fde047',
    highlighterWidth: 14,
    zoomRef: { current: 1 },
  });
  return {
    commit,
    get elements() {
      return elements;
    },
    setPendingDraw,
    setSelectedId,
  };
}

const pen = (over: Partial<Extract<PendingDraw, { variant: 'whiteboard' }>> = {}): PendingDraw => ({
  type: 'freehand',
  variant: 'whiteboard',
  colour: null,
  width: 4,
  recognise: false,
  ...over,
});

// A wobbly loop that ends where it started: a pencil would close and fill it.
const loop = Array.from({ length: 40 }, (_, i) => {
  const a = (i / 39) * Math.PI * 2;
  return { x: 100 + Math.cos(a) * 50, y: 100 + Math.sin(a) * 50 };
});
const scribble = [
  { x: 0, y: 0 },
  { x: 30, y: 12 },
  { x: 55, y: -8 },
  { x: 90, y: 20 },
];

describe('a whiteboard pen stroke', () => {
  it('records the pen width and no colour for the main pen', () => {
    const s = setup(pen());
    s.commit(scribble, false);
    const stroke = s.elements[0] as FreehandElement;
    expect(stroke.type).toBe('freehand');
    expect(stroke.penWidth).toBe(4);
    expect(stroke.strokeColor).toBeUndefined();
  });

  it('records a named colour by name, so it adapts to each viewer\u2019s board', () => {
    const s = setup(pen({ colour: 'red', width: 8 }));
    s.commit(scribble, false);
    expect(s.elements[0]).toMatchObject({ penColour: 'red', penWidth: 8 });
    expect((s.elements[0] as FreehandElement).strokeColor).toBeUndefined();
  });

  it('records a custom colour as its hex, the same on both boards', () => {
    const s = setup(pen({ colour: '#ff6b00', width: 8 }));
    s.commit(scribble, false);
    expect(s.elements[0]).toMatchObject({ strokeColor: '#ff6b00', penWidth: 8 });
    expect((s.elements[0] as FreehandElement).penColour).toBeUndefined();
  });

  it('stays open even when it ends where it began', () => {
    const s = setup(pen());
    s.commit(loop, false);
    expect((s.elements[0] as FreehandElement).closed).toBe(false);
  });

  it('keeps the pen in hand and selects nothing', () => {
    const s = setup(pen());
    s.commit(scribble, false);
    expect(s.setPendingDraw).not.toHaveBeenCalledWith(null);
    expect(s.setSelectedId).not.toHaveBeenCalled();
  });

  it('keeps the pen in hand after a tap too short to draw', () => {
    const s = setup(pen());
    s.commit([{ x: 1, y: 1 }], false);
    expect(s.elements).toHaveLength(0);
    expect(s.setPendingDraw).not.toHaveBeenCalledWith(null);
  });

  it('turns a recognised stroke into a clean unfilled shape in the pen\u2019s colour and weight', () => {
    const s = setup(pen({ colour: 'blue', width: 8, recognise: true }));
    s.commit(loop, false);
    const shape = s.elements[0] as ShapeElement;
    expect(shape.type).toBe('shape');
    expect(shape).toMatchObject({
      penColour: 'blue',
      strokeWidth: 'extra-thick',
      fillColor: 'transparent',
    });
    expect(s.setPendingDraw).not.toHaveBeenCalledWith(null);
  });

  it('leaves a main-pen shape unpainted so it follows the board', () => {
    const s = setup(pen({ recognise: true }));
    s.commit(loop, false);
    const shape = s.elements[0] as ShapeElement;
    expect(shape.type).toBe('shape');
    expect(shape.strokeColor).toBeUndefined();
  });

  it('lands its raw samples as given, never simplified', () => {
    // Jitter RDP at 1.2 px would flatten to two points: a pen stroke keeps every sample.
    const drawn = Array.from({ length: 12 }, (_, i) => ({ x: i * 10, y: i % 2 === 0 ? 0 : 0.5 }));
    const s = setup(pen());
    s.commit(drawn, false);
    const stroke = s.elements[0] as FreehandElement;
    expect(stroke.points).toHaveLength(drawn.length);
  });

  it('keeps the pen\u2019s pressures and streamline, the ink it drew with', () => {
    const s = setup(pen());
    s.commit(scribble, false, { pressures: [0.1, 0.4, 0.8, 1], streamline: 0.2 });
    expect(s.elements[0]).toMatchObject({ pressures: [0.1, 0.4, 0.8, 1], streamline: 0.2 });
  });

  it('lands the shape the pen locked to and reshaped, not a fresh reading of the stroke', () => {
    const s = setup(pen({ recognise: true }));
    const snapped = {
      kind: 'line' as const,
      bbox: { x: 0, y: 0, width: 300, height: 40 },
      confidence: 1,
      from: { x: 0, y: 0 },
      to: { x: 300, y: 40 },
    };
    s.commit(scribble, false, { streamline: 0.2, snapped });
    expect(s.elements[0]).toMatchObject({
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 300, y: 40 },
    });
    expect('snapped' in s.elements[0]!).toBe(false);
  });

  it('lands a stroke broken out of its shape as ink, even with recognition on', () => {
    const s = setup(pen({ recognise: true }));
    s.commit(loop, false, { streamline: 0.2, keepInk: true });
    expect(s.elements[0]!.type).toBe('freehand');
    expect('keepInk' in s.elements[0]!).toBe(false);
  });

  it('lands a stroke Alt recognised as the shape, even with recognition off', () => {
    const s = setup(pen({ recognise: false }));
    const snapped = {
      kind: 'circle' as const,
      bbox: { x: 50, y: 50, width: 100, height: 100 },
      confidence: 1,
    };
    s.commit(loop, false, { streamline: 0.2, snapped });
    expect(s.elements[0]).toMatchObject({ type: 'shape', x: 50, y: 50, width: 100, height: 100 });
  });

  it('keeps strokes as drawn with recognition off', () => {
    const s = setup(pen({ recognise: false }));
    s.commit(loop, false);
    expect(s.elements[0]!.type).toBe('freehand');
  });
});
