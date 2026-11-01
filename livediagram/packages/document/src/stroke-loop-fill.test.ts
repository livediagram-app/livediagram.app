import { describe, expect, it } from 'vitest';
import { createFreehand } from './factories';
import { freehandCanvasPoints, freehandStrokePoints } from './freehand-points';
import {
  fillStrokeLoop,
  isFilledPenLoop,
  isOpenMarkerLoop,
  isVisibleFill,
  penLoopFillPath,
} from './stroke-loop-fill';
import { svgFreehandShape } from './svg-render-shapes';
import { eraseStrokePart, strokeTouchesBrush } from './whiteboard-stroke';
import type { FreehandElement } from './element-types';

// A marker stroke round (100, 100), radius 50, stopping `gapDeg` short of a full turn.
function marker(gapDeg: number, over: Partial<FreehandElement> = {}): FreehandElement {
  const n = 40;
  const sweep = ((360 - gapDeg) * Math.PI) / 180;
  const pts = Array.from({ length: n }, (_, i) => ({
    x: 100 + 50 * Math.cos((sweep * i) / (n - 1)),
    y: 100 + 50 * Math.sin((sweep * i) / (n - 1)),
  }));
  return {
    ...createFreehand(
      pts,
      false,
      pts.map((_, i) => 0.3 + i / 100),
    ),
    penWidth: 2.5,
    streamline: 0.5,
    penColour: 'blue',
    commentThread: [] as never,
    ...over,
  };
}

describe('which strokes are loops', () => {
  it('reads an open marker whose ends meet as a loop, and nothing else', () => {
    expect(isOpenMarkerLoop(marker(10))).toBe(true);
    expect(isOpenMarkerLoop(marker(120))).toBe(false);
    // A pencil sketch (no pen width) and a highlight are not markers.
    expect(isOpenMarkerLoop(marker(10, { penWidth: undefined }))).toBe(false);
    expect(isOpenMarkerLoop(marker(10, { pen: 'highlighter' }))).toBe(false);
    // Already closed: it is a closed element now.
    expect(isOpenMarkerLoop(marker(10, { closed: true }))).toBe(false);
  });

  it('knows a visible fill', () => {
    expect(isVisibleFill('#fff')).toBe(true);
    expect(isVisibleFill('transparent')).toBe(false);
    expect(isVisibleFill('none')).toBe(false);
    expect(isVisibleFill('')).toBe(false);
    expect(isVisibleFill(undefined)).toBe(false);
  });
});

describe('closing a loop', () => {
  it('keeps the element and its ink, closes it, fills it and bridges the gap', () => {
    const open = marker(10);
    const filled = fillStrokeLoop(open, '#bfdbfe');
    expect(filled.id).toBe(open.id);
    expect(filled.penColour).toBe('blue');
    expect(filled.penWidth).toBe(2.5);
    expect(filled.streamline).toBe(0.5);
    expect(filled.closed).toBe(true);
    expect(filled.fillColor).toBe('#bfdbfe');
    expect(isFilledPenLoop(filled)).toBe(true);
    const before = freehandCanvasPoints(open);
    const after = freehandCanvasPoints(filled);
    expect(after).toHaveLength(before.length + 1);
    expect(after[after.length - 1]!.x).toBeCloseTo(before[0]!.x, 1);
    expect(after[after.length - 1]!.y).toBeCloseTo(before[0]!.y, 1);
    // Pressures travel, the closing point at the last one's.
    const p = freehandStrokePoints(filled).pressures!;
    expect(p[p.length - 1]).toBeCloseTo(p[p.length - 2]!, 2);
    // The box stays where it was, give or take the pixel its rounding adds.
    expect(Math.abs(filled.x - open.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(filled.width - open.width)).toBeLessThanOrEqual(1);
  });

  it('a closed loop with no visible fill draws no fill', () => {
    expect(isFilledPenLoop(fillStrokeLoop(marker(10), 'transparent'))).toBe(false);
  });
});

describe('a filled loop on the board', () => {
  const filled = fillStrokeLoop(marker(10), '#bfdbfe');

  it('exports its fill under its ink', () => {
    const svg = svgFreehandShape(filled, '#2563eb', '#bfdbfe');
    expect(svg.startsWith(`<path d="${penLoopFillPath(filled, (n) => Math.round(n * 100) / 100)}`)).toBe(
      true,
    );
    expect(svg.indexOf('fill="#bfdbfe"')).toBeLessThan(svg.indexOf('fill="#2563eb"'));
    // An open stroke exports its ink alone.
    expect(svgFreehandShape(marker(10), '#2563eb', '#bfdbfe')).not.toContain('#bfdbfe');
  });

  it('the eraser touches its fill, and an open loop only its ink', () => {
    const centre = { x: 100, y: 100 };
    expect(strokeTouchesBrush(filled, centre, centre, 4)).toBe(true);
    expect(strokeTouchesBrush(marker(10), centre, centre, 4)).toBe(false);
  });

  it('a Partial erase cuts it open again', () => {
    const pieces = eraseStrokePart(filled, { x: 150, y: 100 }, { x: 150, y: 100 }, 8, () => 'p');
    expect(pieces && pieces.length).toBeGreaterThan(0);
    for (const piece of pieces!) expect(isFilledPenLoop(piece)).toBe(false);
  });

  it('draws nothing for a stroke too short to fill', () => {
    const dot = { ...createFreehand([{ x: 0, y: 0 }], true), penWidth: 2, fillColor: '#fff' };
    expect(penLoopFillPath(dot)).toBe('');
  });
});
