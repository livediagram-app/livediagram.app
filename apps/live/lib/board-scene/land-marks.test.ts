import { describe, expect, it } from 'vitest';
import {
  MAX_FREEHAND_POINTS,
  STROKE_POINT_MAX_ERROR,
  STROKE_PRESSURE_MAX_ERROR,
  freehandCanvasPoints,
  freehandNormalisedPoints,
  freehandPressures,
  isValidElement,
  pathAnchors,
  penColourHex,
  type PathElement,
} from '@livediagram/document';
import { createLandContext, LANDING_RULES } from './context';
import { landInk, landLine, landPath } from './land-marks';
import type { SceneInk, ScenePolyline } from './scene';

// docs/specs/020-import-export/board-scene.md "Kinds": ink, lines and paths on a whiteboard.
const ink = (over: Partial<SceneInk> = {}): SceneInk => ({
  key: 'i',
  kind: 'ink',
  points: [
    { x: 10, y: 10 },
    { x: 20, y: 30 },
    { x: 40, y: 20 },
  ],
  stroke: { colour: 'ink', widthPx: 1.5 },
  ...over,
});
const line = (over: Partial<ScenePolyline> = {}): ScenePolyline => ({
  key: 'l',
  kind: 'polyline',
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
  ],
  stroke: { colour: { hex: '#1971c2' }, widthPx: 2 },
  ...over,
});

describe('landInk', () => {
  it('lands a marker stroke in the ink at the nearest width, valid', () => {
    const el = landInk(
      ink({ stroke: { colour: { hex: '#1e1e1e' }, widthPx: 1.1 } }),
      'id',
      createLandContext(),
    );
    expect(isValidElement(el)).toBe(true);
    expect(el).toMatchObject({ type: 'freehand', closed: false, penWidth: 1 });
    // No streamline written: absent is none, the renderer's own default.
    expect('streamline' in el).toBe(false);
    expect(el.strokeColor).toBeUndefined();
    expect(el.penColour).toBeUndefined();
    expect(freehandPressures(el)).toBeUndefined();
    // The codec's box (docs/specs/006-document/stroke-points.md): the points' bounds padded a
    // pixel and grown to whole px.
    expect({ x: el.x, y: el.y, width: el.width, height: el.height }).toEqual({
      x: 9,
      y: 9,
      width: 32,
      height: 22,
    });
  });

  it('keeps pressures when every point has one, and the streamline', () => {
    const el = landInk(
      ink({
        streamline: 0.5,
        points: [
          { x: 0, y: 0, p: 0.2 },
          { x: 5, y: 5, p: 1.4 },
        ],
      }),
      'id',
      createLandContext(),
    );
    const pressures = freehandPressures(el)!;
    expect(pressures[0]).toBeCloseTo(0.2, 2);
    expect(pressures[1]).toBe(1);
    expect(el.streamline).toBe(0.5);
    const partial = landInk(
      ink({
        points: [
          { x: 0, y: 0, p: 0.2 },
          { x: 5, y: 5 },
        ],
      }),
      'id',
      createLandContext(),
    );
    expect(freehandPressures(partial)).toBeUndefined();
  });

  it('lands a stock colour by name and a custom one as its hex', () => {
    expect(
      landInk(ink({ stroke: { colour: { hex: '#e03131' }, widthPx: 2 } }), 'i', createLandContext())
        .penColour,
    ).toBe('red');
    expect(
      landInk(ink({ stroke: { colour: { hex: '#868e96' }, widthPx: 2 } }), 'i', createLandContext())
        .strokeColor,
    ).toBe('#868e96');
  });

  it('returns a closed stroke to its start, once', () => {
    const el = landInk(ink({ closed: true }), 'i', createLandContext());
    const pts = freehandNormalisedPoints(el);
    expect(pts).toHaveLength(4);
    expect(pts[3]).toEqual(pts[0]);
    const already = landInk(
      ink({
        closed: true,
        points: [
          { x: 0, y: 0 },
          { x: 9, y: 0 },
          { x: 9, y: 9 },
          { x: 0.5, y: 0 },
        ],
      }),
      'i',
      createLandContext(),
    );
    expect(freehandNormalisedPoints(already)).toHaveLength(4);
  });

  it('draws multicolour ink in its first stop, says so, and multiplies opacity', () => {
    const ctx = createLandContext();
    const el = landInk(
      ink({
        stroke: {
          colour: 'ink',
          widthPx: 2,
          opacity: 0.5,
          stops: [{ hex: '#2f9e44', alpha: 0.5 }, { hex: '#e03131' }],
        },
      }),
      'i',
      ctx,
    );
    expect(el.penColour).toBe('green');
    expect(el.opacity).toBe(0.25);
    expect(ctx.notes()).toEqual([
      { rule: LANDING_RULES.multicolourInk, count: 1, kind: 'degraded' },
    ]);
  });

  it('lands multicolour ink in the colour its parser picked, saying nothing more', () => {
    const ctx = createLandContext();
    const el = landInk(
      ink({
        stroke: {
          colour: { hex: '#c2255c' },
          widthPx: 2,
          stops: [{ hex: '#e03131' }, { hex: '#2f9e44' }],
        },
      }),
      'i',
      ctx,
    );
    expect(el.penColour).toBe('pink');
    expect(ctx.notes()).toEqual([]);
  });

  it('drops a fill and a dash, saying so', () => {
    const ctx = createLandContext();
    landInk(
      ink({ fill: { hex: '#ffdf6b' }, stroke: { colour: 'ink', widthPx: 2, dash: 'dashed' } }),
      'i',
      ctx,
    );
    expect(ctx.notes().map((n) => n.rule)).toEqual([
      LANDING_RULES.filledInk,
      LANDING_RULES.dashedInk,
    ]);
  });

  it('lands highlighter ink as a highlighter mark at its own width', () => {
    const el = landInk(
      ink({ highlighter: true, stroke: { colour: { hex: '#f08c00' }, widthPx: 14 } }),
      'i',
      createLandContext(),
    );
    expect(el).toMatchObject({
      pen: 'highlighter',
      penWidth: 14,
      strokeColor: penColourHex('orange', 'light'),
    });
    expect(isValidElement(el)).toBe(true);
  });

  it('samples a stroke longer than the freehand limit', () => {
    const points = Array.from({ length: MAX_FREEHAND_POINTS + 50 }, (_, i) => ({ x: i, y: i % 7 }));
    const ctx = createLandContext();
    const el = landInk(ink({ points }), 'i', ctx);
    expect(freehandNormalisedPoints(el).length).toBeLessThanOrEqual(MAX_FREEHAND_POINTS);
    expect(isValidElement(el)).toBe(true);
    expect(ctx.notes()).toEqual([{ rule: LANDING_RULES.longStroke, count: 1, kind: 'degraded' }]);
  });
});

// docs/specs/006-document/stroke-points.md: the landing writes a stroke through the codec, so its
// precision is the codec's: every point within STROKE_POINT_MAX_ERROR of its box, every pressure
// within STROKE_PRESSURE_MAX_ERROR.
describe('landed ink precision', () => {
  it('lands every point and pressure within the codec’s guarantee', () => {
    const points = Array.from({ length: 200 }, (_, i) => ({
      x: 1234.5678 + i * 7.123,
      y: 987.654 + Math.sin(i / 9) * 321.987,
      p: 0.3 + 0.4 * Math.abs(Math.sin(i / 4)),
    }));
    const el = landInk(ink({ points }), 'i', createLandContext());
    const drawn = freehandCanvasPoints(el);
    const pressures = freehandPressures(el)!;
    points.forEach((p, i) => {
      expect(Math.abs(drawn[i]!.x - p.x)).toBeLessThanOrEqual(
        STROKE_POINT_MAX_ERROR * el.width + 1e-9,
      );
      expect(Math.abs(drawn[i]!.y - p.y)).toBeLessThanOrEqual(
        STROKE_POINT_MAX_ERROR * el.height + 1e-9,
      );
      expect(Math.abs(pressures[i]! - p.p)).toBeLessThanOrEqual(STROKE_PRESSURE_MAX_ERROR + 1e-9);
    });
  });
});

describe('landLine', () => {
  it('lands a two-point line as a headless arrow', () => {
    const el = landLine(
      line({
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        stroke: { colour: { hex: '#1971c2' }, widthPx: 4, dash: 'dashed' },
      }),
      'id',
      createLandContext(),
    );
    expect(el).toMatchObject({
      type: 'arrow',
      arrowEnds: 'none',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 10, y: 0 },
      strokeWidth: 4,
      strokeStyle: 'dashed',
      penColour: 'blue',
    });
    expect(isValidElement(el)).toBe(true);
  });

  it('turns its ends by its rotation', () => {
    const el = landLine(
      line({
        rotationDeg: 90,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
      }),
      'id',
      createLandContext(),
    );
    expect(el.from).toMatchObject({ x: expect.closeTo(5, 6), y: expect.closeTo(-5, 6) });
    expect(el.to).toMatchObject({ x: expect.closeTo(5, 6), y: expect.closeTo(5, 6) });
    expect((el as { rotation?: number }).rotation).toBeUndefined();
  });
});

describe('landPath', () => {
  it('keeps corners as corners', () => {
    const el = landPath(line(), 'id', createLandContext());
    expect(isValidElement(el)).toBe(true);
    expect(el.nodes.every((n) => n.mode === 'corner' && !n.handleIn && !n.handleOut)).toBe(true);
    const anchors = pathAnchors(el);
    expect(anchors.map((a) => [a.x, a.y])).toEqual([
      [0, 0],
      [100, 0],
      [100, 50],
    ]);
    expect(el.penColour).toBe('blue');
    expect(el.strokeWidth).toBeUndefined();
  });

  it('smooths a curved line through its points', () => {
    const el = landPath(line({ curved: true }), 'id', createLandContext());
    expect(el.nodes[1]!.mode).toBe('mirrored');
    expect(el.nodes[1]!.handleIn).toBeDefined();
    expect(el.nodes[0]!.handleIn).toBeUndefined();
    expect(el.nodes[0]!.handleOut).toBeDefined();
    expect(el.nodes[2]!.handleOut).toBeUndefined();
    const anchors = pathAnchors(el);
    expect(anchors[1]!.x).toBeCloseTo(100);
    expect(anchors[1]!.y).toBeCloseTo(0);
  });

  it('closes with its fill, dropping a repeated closing point', () => {
    const el: PathElement = landPath(
      line({
        closed: true,
        fill: { hex: '#ffc9c9' },
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 0 },
        ],
      }),
      'id',
      createLandContext(),
    );
    expect(el.closed).toBe(true);
    expect(el.nodes).toHaveLength(3);
    expect(el.fillColor).toBe('#ffc9c9');
    expect(isValidElement(el)).toBe(true);
  });

  it('leaves an open line unfilled', () => {
    expect(
      landPath(line({ fill: { hex: '#ffc9c9' } }), 'id', createLandContext()).fillColor,
    ).toBeUndefined();
  });
});
