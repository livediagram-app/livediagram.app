import { describe, expect, it, vi } from 'vitest';
import { createFreehand } from './factories';
import { freehandGeometry } from './freehand-points';
import { catmullRomToBezierPath } from './polyline';
import { migrateLegacyStrokePoints } from './legacy-stroke-points';
import { freehandPenStroke, penStrokePath } from './pen-stroke';
import { r2 } from './svg-render-primitives';
import { svgFreehandShape } from './svg-render-shapes';
import { STROKE_POINT_MAX_ERROR, STROKE_PRESSURE_MAX_ERROR } from './stroke-points';
import type { Element, FreehandElement } from './index';

// Export fidelity (docs/specs/006-document/stroke-points.md "Precision guarantee";
// docs/specs/020-import-export/export-fidelity.md): the SVG export of a packed stroke is the SVG of
// the samples it was drawn from, every number within the packing bound plus the export's own
// rounding to hundredths. PNG and PDF rasterise this same markup, so they inherit it.

type Sample = { x: number; y: number };

// A synthesised board: a long wobbly pen stroke with pressure, a small one, a pencil sketch, a
// closed sketch, a polygon-tool path and a highlight. Deterministic.
const wave = (n: number, x0: number, y0: number, sx: number, sy: number): Sample[] =>
  Array.from({ length: n }, (_, i) => ({
    x: x0 + i * sx + Math.sin(i / 3) * 4,
    y: y0 + Math.cos(i / 5) * sy,
  }));
const board: {
  name: string;
  samples: Sample[];
  pressures?: number[];
  extra: Partial<FreehandElement>;
  closed?: boolean;
}[] = [
  {
    name: 'long pen stroke',
    samples: wave(400, 100, 300, 7.3, 140),
    pressures: Array.from({ length: 400 }, (_, i) => 0.25 + 0.5 * Math.abs(Math.sin(i / 11))),
    extra: { penWidth: 2.5, streamline: 0.2 },
  },
  {
    name: 'small pen stroke',
    samples: wave(12, 40.5, 40.5, 1.1, 3),
    extra: { penWidth: 1.5, streamline: 0.5 },
  },
  { name: 'pencil sketch', samples: wave(60, 500, 900, 9, 60), extra: {} },
  {
    name: 'closed sketch',
    samples: [...wave(30, 900, 900, 6, 40), { x: 903, y: 942 }],
    extra: { fillColor: '#ffd43b' },
    closed: true,
  },
  {
    name: 'polygon path',
    samples: [
      { x: 0, y: 0 },
      { x: 320.25, y: 10.5 },
      { x: 160.75, y: 280.125 },
    ],
    extra: { straightEdges: true },
    closed: true,
  },
  {
    name: 'highlight',
    samples: wave(80, 50, 1500, 12, 8),
    extra: { pen: 'highlighter', penWidth: 20 },
  },
];

function stroke(entry: (typeof board)[number]): FreehandElement {
  return {
    ...createFreehand(entry.samples, entry.closed ?? false, entry.pressures),
    ...entry.extra,
  };
}

// The same markup from the unpacked samples: the pen outline from the raw geometry, the polyline
// through the raw canvas points.
function reference(entry: (typeof board)[number], el: FreehandElement): string {
  if (el.penWidth !== undefined && el.pen !== 'highlighter') {
    const geometry = freehandGeometry(entry.samples);
    const source = {
      ...geometry,
      penWidth: el.penWidth,
      streamline: el.streamline,
      pressures: entry.pressures,
    };
    return svgFreehandShape(el, '#000', 'none').replace(
      /d="[^"]*"/,
      `d="${penStrokePath(freehandPenStroke(source, { x: geometry.x, y: geometry.y }), r2)}"`,
    );
  }
  const d = el.straightEdges
    ? entry.samples.map((p, i) => `${i === 0 ? 'M' : 'L'} ${r2(p.x)} ${r2(p.y)}`).join(' ') +
      (el.closed ? ' Z' : '')
    : catmullRomToBezierPath(entry.samples, el.closed, r2);
  return svgFreehandShape(el, '#000', 'none').replace(/d="[^"]*"/, `d="${d}"`);
}

function expectWithin(actual: string, expected: string, tolerance: number) {
  const tokens = (s: string) => s.split(/[\s"=,]+/).filter(Boolean);
  const a = tokens(actual);
  const b = tokens(expected);
  expect(a).toHaveLength(b.length);
  a.forEach((t, i) => {
    const n = Number(t);
    if (Number.isNaN(n)) expect(t).toBe(b[i]);
    else expect(Math.abs(n - Number(b[i]))).toBeLessThanOrEqual(tolerance);
  });
}

describe('SVG export of packed strokes', () => {
  it.each(board.map((entry) => [entry.name, entry] as const))(
    'draws the %s within the packing bound of its samples',
    (_name, entry) => {
      const el = stroke(entry);
      const side = Math.max(el.width, el.height);
      // Packing (twice the per-axis bound: the outline mixes both axes), the pressure step's
      // effect on the pen's width, and the export's rounding of both renders to hundredths.
      const tolerance =
        2 * side * STROKE_POINT_MAX_ERROR + (el.penWidth ?? 0) * STROKE_PRESSURE_MAX_ERROR + 0.01;
      const markup = svgFreehandShape(el, '#000', 'none');
      expect(markup).toMatch(/^<path d="M /);
      expectWithin(markup, reference(entry, el), tolerance);
    },
  );

  it('exports a migrated stroke as the stroke packed from the same points', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const entry = board[0]!;
    const geometry = freehandGeometry(entry.samples);
    const former = {
      id: 'f',
      type: 'freehand',
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.height,
      points: geometry.points,
      pressures: entry.pressures,
      closed: false,
      ...entry.extra,
    } as unknown as Element;
    const [migrated] = migrateLegacyStrokePoints([former]);
    expect(svgFreehandShape(migrated as FreehandElement, '#000', 'none')).toBe(
      svgFreehandShape({ ...stroke(entry), id: 'f' }, '#000', 'none'),
    );
  });
});
