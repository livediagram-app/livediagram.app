import { describe, expect, it } from 'vitest';
import {
  PEN_STREAMLINE,
  createFreehand,
  freehandPenStroke,
  isPenStroke,
  penPointerKind,
  penPressureWidth,
  penStrokeCentreline,
  penStrokeOutline,
  penStrokePath,
  penStrokeSize,
  type PenStroke,
} from './index';

// The whiteboard pen's ink (docs/specs/023-whiteboard/whiteboard.md "Pens"): perfect-freehand with
// pressure, the way Excalidraw draws freedraw. One pure function draws the stroke being drawn and
// the stroke that lands, on the canvas and in the export.

type Point = { x: number; y: number };
const line = (n = 60, step = 3): Point[] =>
  Array.from({ length: n }, (_, i) => ({ x: 10 + i * step, y: 40 }));

/** The outline's thickness across y = 40, measured in the middle of a horizontal line. */
function thickness(stroke: PenStroke): number {
  const xs = stroke.points.map((p) => p.x);
  const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  const near = penStrokeOutline(stroke).filter((p) => Math.abs(p.x - mid) < 20);
  return Math.max(...near.map((p) => p.y)) - Math.min(...near.map((p) => p.y));
}

describe('pen pointer kinds and streamline', () => {
  it('streamlines a mouse at 0.5 and a pen or finger at 0.2, as Excalidraw does', () => {
    expect(PEN_STREAMLINE).toEqual({ mouse: 0.5, pen: 0.2, touch: 0.2 });
    expect(penPointerKind('pen')).toBe('pen');
    expect(penPointerKind('touch')).toBe('touch');
    expect(penPointerKind(undefined)).toBe('mouse');
  });
});

describe('penStrokeOutline width', () => {
  for (const width of [1, 1.5, 2.5]) {
    it(`draws a ${width} px pen exactly ${width} px wide at medium pressure`, () => {
      const pressures = line().map(() => 0.5);
      expect(thickness({ points: line(), pressures, width, streamline: 0.2 })).toBeCloseTo(
        width,
        6,
      );
    });

    it(`draws a ${width} px stroke without pressures (a mouse) at the same constant width`, () => {
      expect(thickness({ points: line(), width, streamline: 0.5 })).toBeCloseTo(width, 6);
    });
  }

  it('sizes perfect-freehand so pressure 0.5 is the preset width', () => {
    expect(penStrokeSize(1.5)).toBeCloseTo(1.5 / Math.SQRT2, 12);
  });

  it('says how wide a pen draws at a pressure: the preset at the middle', () => {
    expect(penPressureWidth(1.5, 0.5)).toBeCloseTo(1.5, 12);
    const full = thickness({
      points: line(),
      pressures: line().map(() => 1),
      width: 2,
      streamline: 0.2,
    });
    expect(full).toBeCloseTo(penPressureWidth(2, 1), 6);
  });

  it('widens with pressure and thins without it', () => {
    const at = (p: number) =>
      thickness({ points: line(), pressures: line().map(() => p), width: 2, streamline: 0.2 });
    expect(at(1)).toBeGreaterThan(at(0.5));
    expect(at(0.5)).toBeGreaterThan(at(0.1));
    // thinning 0.6 under a sine easing: full pressure is sin(0.8 pi / 2) / sin(pi / 4) as wide.
    expect(at(1) / at(0.5)).toBeCloseTo(Math.sin(0.4 * Math.PI) / Math.sin(Math.PI / 4), 3);
  });
});

describe('penStrokePath', () => {
  const stroke: PenStroke = {
    points: Array.from({ length: 40 }, (_, i) => ({ x: i * 4, y: Math.sin(i / 5) * 20 })),
    pressures: Array.from({ length: 40 }, (_, i) => 0.3 + (i % 7) / 10),
    width: 1.5,
    streamline: 0.2,
  };

  it('fills the outline with quadratic curves through the midpoints, closed', () => {
    const d = penStrokePath(stroke);
    expect(d.startsWith('M ')).toBe(true);
    expect(d).toContain(' Q ');
    expect(d.endsWith(' Z')).toBe(true);
  });

  it('draws nothing for no points', () => {
    expect(penStrokePath({ points: [], width: 1.5, streamline: 0.2 })).toBe('');
  });

  it('is the same stroke wherever it is drawn: a shift moves every number by the shift', () => {
    const moved = {
      ...stroke,
      points: stroke.points.map((p) => ({ x: p.x + 123.25, y: p.y - 7.5 })),
    };
    const a = penStrokePath(stroke)
      .match(/-?[\d.]+(?:e-?\d+)?/g)!
      .map(Number);
    const b = penStrokePath(moved)
      .match(/-?[\d.]+(?:e-?\d+)?/g)!
      .map(Number);
    expect(b).toHaveLength(a.length);
    b.forEach((n, i) => expect(n).toBeCloseTo(a[i]! + (i % 2 === 0 ? 123.25 : -7.5), 9));
  });

  it('shapes every number with fmt (the export rounds)', () => {
    const d = penStrokePath(stroke, (n) => Math.round(n));
    expect(d.match(/-?[\d.]+/g)!.every((s) => !s.includes('.'))).toBe(true);
  });

  it('draws a finished stroke as it was drawn: the last point is its end, every time', () => {
    expect(penStrokePath(stroke)).toBe(penStrokePath({ ...stroke }));
    const centre = penStrokeCentreline(stroke);
    expect(centre[centre.length - 1]).toEqual(stroke.points[stroke.points.length - 1]);
  });
});

describe('penStrokeCentreline', () => {
  it('is the streamlined centre: smoother than the input, from its first point', () => {
    const zig = Array.from({ length: 30 }, (_, i) => ({ x: i * 3, y: i % 2 ? 1 : -1 }));
    const centre = penStrokeCentreline({ points: zig, width: 1.5, streamline: 0.5 });
    expect(centre[0]).toEqual(zig[0]);
    const wobble = (ps: Point[]) => Math.max(...ps.slice(3, -3).map((p) => Math.abs(p.y)));
    expect(wobble(centre)).toBeLessThan(wobble(zig));
  });
});

describe('freehandPenStroke', () => {
  const raw = [
    { x: 10, y: 20 },
    { x: 30, y: 25 },
    { x: 50, y: 60 },
  ];
  const el = {
    ...createFreehand(raw, false),
    penWidth: 2.5,
    pressures: [0.2, 0.5, 0.9],
    streamline: 0.2,
  };

  it('reads a pen stroke in its own box, or on the canvas from an origin', () => {
    const local = freehandPenStroke(el);
    expect(local.points[0]!.x).toBeCloseTo(raw[0]!.x - el.x, 9);
    const onCanvas = freehandPenStroke(el, { x: el.x, y: el.y });
    onCanvas.points.forEach((p, i) => {
      expect(p.x).toBeCloseTo(raw[i]!.x, 9);
      expect(p.y).toBeCloseTo(raw[i]!.y, 9);
    });
    expect(local).toMatchObject({ width: 2.5, pressures: [0.2, 0.5, 0.9], streamline: 0.2 });
  });

  it('draws an older pen stroke, without pressures or streamline, as it stored it: no streamline', () => {
    const older = { ...createFreehand(raw, false), penWidth: 1.5 };
    expect(freehandPenStroke(older)).toMatchObject({ streamline: 0, pressures: undefined });
  });

  it('knows a pen stroke from a highlight or a pencil sketch', () => {
    expect(isPenStroke(el)).toBe(true);
    expect(isPenStroke({ ...el, pen: 'highlighter' })).toBe(false);
    expect(isPenStroke(createFreehand(raw, false))).toBe(false);
  });
});
