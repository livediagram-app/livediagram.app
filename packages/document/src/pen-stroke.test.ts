import { describe, expect, it } from 'vitest';
import {
  PEN_STREAMLINE,
  STROKE_POINT_MAX_ERROR,
  STROKE_PRESSURE_MAX_ERROR,
  createFreehand,
  freehandGeometry,
  freehandPenStroke,
  isPenStroke,
  penPointerKind,
  penPressureWidth,
  penStrokeCentreline,
  penStrokeOutline,
  penStrokePath,
  penStrokeSize,
  penStrokeSvg,
  type PenStroke,
} from './index';

// The whiteboard pen's ink (docs/specs/023-draw-mode/draw-mode.md "Pens"): perfect-freehand with
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

  // docs/specs/023-draw-mode/draw-mode.md "Pens": a tap with a pen leaves a dot.
  for (const pressures of [undefined, [0.5]]) {
    it(`draws a lone point as a round dot the pen's width, centred on it (pressures ${pressures ? 'yes' : 'no'})`, () => {
      const dot = penStrokeOutline({
        points: [{ x: 10, y: 20 }],
        pressures,
        width: 2.5,
        streamline: 0.5,
      });
      const xs = dot.map((p) => p.x);
      const ys = dot.map((p) => p.y);
      const across = Math.max(...xs) - Math.min(...xs);
      const down = Math.max(...ys) - Math.min(...ys);
      expect(across).toBeCloseTo(2.5, 1);
      expect(down).toBeCloseTo(2.5, 1);
      expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(10, 1);
      expect((Math.max(...ys) + Math.min(...ys)) / 2).toBeCloseTo(20, 1);
    });
  }

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

// Ink the smoothing has settled never moves while drawing (docs/specs/023-draw-mode/draw-mode.md
// "Pens"): the tip is the stretch from the last streamlined point to the pointer, with its end cap;
// every outline point farther from it than the stroke's widest radius is exactly where it was.
describe('settled ink', () => {
  const distToSegment = (p: Point, a: Point, b: Point) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  };
  // A slightly wobbly diagonal at `step` px per sample, down-right or up-left.
  const wobbly = (step: number, dir: 1 | -1): Point[] =>
    Array.from({ length: 40 }, (_, i) => ({
      x: 100 + dir * i * step + 1.1 * Math.cos(i * 1.3),
      y: 100 + dir * i * step * 0.75 + 1.3 * Math.sin(i * 0.9),
    }));
  const pressures = Array.from({ length: 40 }, (_, i) => 0.1 + 0.45 * (1 + Math.sin(i * 0.23)));
  const cases = [0.5, 3, 12].flatMap((step) =>
    ([1, -1] as const).flatMap((dir) =>
      [PEN_STREAMLINE.mouse, PEN_STREAMLINE.pen].flatMap((streamline) =>
        [false, true].map((pressure) => ({ step, dir, streamline, pressure })),
      ),
    ),
  );

  it.each(cases)(
    'keeps every settled outline point as a sample arrives (step $step, dir $dir, streamline $streamline, pressure $pressure)',
    ({ step, dir, streamline, pressure }) => {
      const points = wobbly(step, dir);
      const width = 1.5;
      const widest = penPressureWidth(width, 1) / 2;
      const at = (n: number): PenStroke => ({
        points: points.slice(0, n),
        pressures: pressure ? pressures.slice(0, n) : undefined,
        width,
        streamline,
      });
      const moved: string[] = [];
      // From three samples on: with two, the whole stroke is still the tip.
      for (let n = 3; n < points.length; n++) {
        const next = new Set(penStrokeOutline(at(n + 1)).map((p) => `${p.x},${p.y}`));
        const centre = penStrokeCentreline(at(n));
        const settledEnd = centre[centre.length - 2]!;
        const pointer = centre[centre.length - 1]!;
        for (const p of penStrokeOutline(at(n))) {
          if (distToSegment(p, settledEnd, pointer) <= widest) continue;
          if (!next.has(`${p.x},${p.y}`)) moved.push(`n=${n} (${p.x}, ${p.y})`);
        }
      }
      expect(moved).toEqual([]);
    },
  );

  it('keeps the settled ink on the canvas through the growing box, as the live ink draws it', () => {
    const points = wobbly(3, -1);
    // The live ink lays its raw samples out unpacked (freehandGeometry), never re-quantised.
    const onCanvas = (n: number) => {
      const el = freehandGeometry(points.slice(0, n));
      return penStrokeOutline(
        freehandPenStroke({ ...el, penWidth: 1.5, streamline: 0.5 }, { x: el.x, y: el.y }),
      );
    };
    for (let n = 10; n < points.length; n++) {
      const before = onCanvas(n);
      const after = onCanvas(n + 1);
      // The start cap and the first stretch of the left side are long settled.
      for (let i = 0; i < 8; i++) {
        expect(after[i]!.x).toBeCloseTo(before[i]!.x, 9);
        expect(after[i]!.y).toBeCloseTo(before[i]!.y, 9);
      }
      const tail = (o: Point[]) => o.slice(-8);
      tail(after).forEach((p, i) => {
        expect(p.x).toBeCloseTo(tail(before)[i]!.x, 9);
        expect(p.y).toBeCloseTo(tail(before)[i]!.y, 9);
      });
    }
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
    ...createFreehand(raw, false, [0.2, 0.5, 0.9]),
    penWidth: 2.5,
    streamline: 0.2,
  };

  it('reads a pen stroke in its own box, or on the canvas from an origin', () => {
    // Within the packed points' precision guarantee of the samples drawn.
    const bound = Math.max(el.width, el.height) * STROKE_POINT_MAX_ERROR;
    const local = freehandPenStroke(el);
    expect(Math.abs(local.points[0]!.x - (raw[0]!.x - el.x))).toBeLessThanOrEqual(bound);
    const onCanvas = freehandPenStroke(el, { x: el.x, y: el.y });
    onCanvas.points.forEach((p, i) => {
      expect(Math.abs(p.x - raw[i]!.x)).toBeLessThanOrEqual(bound);
      expect(Math.abs(p.y - raw[i]!.y)).toBeLessThanOrEqual(bound);
    });
    expect(local).toMatchObject({ width: 2.5, streamline: 0.2 });
    [0.2, 0.5, 0.9].forEach((p, i) =>
      expect(Math.abs(local.pressures![i]! - p)).toBeLessThanOrEqual(STROKE_PRESSURE_MAX_ERROR),
    );
  });

  it('draws in canvas coordinates: a viewBox on its own box, the outline where it is on the board', () => {
    const moved = { ...el, x: 7, y: -3 };
    const svg = penStrokeSvg(moved);
    expect(svg.viewBox).toBe(`7 -3 ${el.width} ${el.height}`);
    expect(svg.d).toBe(penStrokePath(freehandPenStroke(moved, { x: 7, y: -3 })));
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
