// The Geometric family (docs/specs/011-theme/page-designs.md "The catalogue"): lattices, tilings and rings. Repeating
// parts are SVG patterns (one node however large the page), so a big page costs what a small one does. Pure.
import { mixHex } from '@liveworkspace/model-core/color-wash';
import { between, n, pageRect, pick, trio, unit, type DesignLayer, type Drawer } from './draw-kit';

const SQRT3 = Math.sqrt(3);

// Grid: fine lines in the ink, every fourth in the accent, a few cells lit in the palette; turned by the angle.
const grid: Drawer = (c) => {
  const pitch = unit(c) * 4.4;
  const major = pitch * 4;
  const id = `${c.uid}-grid`;
  const turn = `rotate(${n(c.t.angle)} ${n(c.w / 2)} ${n(c.h / 2)})`;
  const dash =
    c.t.variant === 'dashed' ? ` stroke-dasharray="${n(pitch / 6)} ${n(pitch / 6)}"` : '';
  const minorTile =
    c.t.variant === 'crosses'
      ? `<path d="M${n(-pitch * 0.12)} 0H${n(pitch * 0.12)}M0 ${n(-pitch * 0.12)}V${n(pitch * 0.12)}" transform="translate(${n(pitch / 2)} ${n(pitch / 2)})" stroke="${c.p.ink}" stroke-opacity="0.35" stroke-width="1.2"/>`
      : `<path d="M${n(pitch)} 0H0V${n(pitch)}" fill="none" stroke="${c.p.ink}" stroke-opacity="0.13" stroke-width="1"${dash}/>`;
  const majorTile = `<path d="M${n(major)} 0H0V${n(major)}" fill="none" stroke="${c.p.a}" stroke-opacity="0.38" stroke-width="1.4"/>`;
  const span = Math.hypot(c.w, c.h);
  const off = (span - Math.min(c.w, c.h)) / 2 + span;
  const cells = Array.from({ length: 7 }, (_, i) => {
    const x = Math.floor(between(c.rnd, 0, c.w / pitch)) * pitch;
    const y = Math.floor(between(c.rnd, 0, c.h / pitch)) * pitch;
    return `<rect x="${n(x)}" y="${n(y)}" width="${n(pitch)}" height="${n(pitch)}" fill="${trio(c)[i % 3]}" fill-opacity="${n(between(c.rnd, 0.14, 0.32))}"/>`;
  }).join('');
  return [
    {
      svg:
        `<defs><pattern id="${id}-a" width="${n(pitch)}" height="${n(pitch)}" patternUnits="userSpaceOnUse">${minorTile}</pattern>` +
        `<pattern id="${id}-b" width="${n(major)}" height="${n(major)}" patternUnits="userSpaceOnUse">${majorTile}</pattern></defs>` +
        `<g transform="${turn}"><rect x="${n(-off)}" y="${n(-off)}" width="${n(c.w + off * 2)}" height="${n(c.h + off * 2)}" fill="url(#${id}-a)"/>` +
        `<rect x="${n(-off)}" y="${n(-off)}" width="${n(c.w + off * 2)}" height="${n(c.h + off * 2)}" fill="url(#${id}-b)"/>${cells}</g>`,
    },
  ];
};

// Dots: a fading field of dots from the focus, an even grid, or a scatter of the palette's colours.
const dots: Drawer = (c) => {
  const pitch = unit(c) * 3.2;
  const id = `${c.uid}-dots`;
  const [fx, fy] = c.t.focus;
  if (c.t.variant === 'scatter') {
    const colours = trio(c);
    const shapes = Array.from({ length: 90 }, (_, i) => {
      const r = pick(c.rnd, [1, 1, 1.6, 2.6]) * unit(c) * 0.55;
      return `<circle cx="${n(between(c.rnd, 0, c.w))}" cy="${n(between(c.rnd, 0, c.h))}" r="${n(r)}" fill="${colours[i % 3]}" fill-opacity="${n(between(c.rnd, 0.35, 0.85))}"/>`;
    }).join('');
    return [{ svg: shapes }];
  }
  const fade = c.t.variant === 'fade';
  const tile = `<circle cx="${n(pitch / 2)}" cy="${n(pitch / 2)}" r="${n(pitch * (fade ? 0.2 : 0.12))}" fill="${fade ? c.p.a : c.p.ink}" fill-opacity="${fade ? 0.9 : 0.3}"/>`;
  const defs =
    `<pattern id="${id}" width="${n(pitch)}" height="${n(pitch)}" patternUnits="userSpaceOnUse" patternTransform="rotate(${n(c.t.angle)})">${tile}</pattern>` +
    (fade
      ? `<radialGradient id="${id}-f" cx="${n(fx)}" cy="${n(fy)}" r="0.85"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
        `<mask id="${id}-m"><rect width="${n(c.w)}" height="${n(c.h)}" fill="url(#${id}-f)"/></mask>`
      : '');
  return [
    {
      svg: `<defs>${defs}</defs>${pageRect(c, `fill="url(#${id})"${fade ? ` mask="url(#${id}-m)"` : ''}`)}`,
    },
  ];
};

// Isometric: an isometric lattice in the ink, a little cluster of cubes in the palette at the focus.
const isometric: Drawer = (c) => {
  const s = unit(c) * 6;
  const h = s / SQRT3;
  const id = `${c.uid}-iso`;
  const tile = `<path d="M0 0L${n(s)} ${n(h)}M0 ${n(h)}L${n(s)} 0M0 0V${n(h)}" fill="none" stroke="${c.p.ink}" stroke-opacity="0.12" stroke-width="1"/>`;
  const e = s * 1.15;
  const cx = Math.cos(Math.PI / 6) * e;
  const [fx, fy] = c.t.focus;
  const cubes = Array.from({ length: 7 }, () => {
    const gx = Math.round(between(c.rnd, -2.5, 2.5));
    const gy = Math.round(between(c.rnd, -2, 2));
    return { x: fx * c.w + gx * cx * 2 + (gy % 2 ? cx : 0), y: fy * c.h + gy * e * 1.5 };
  })
    .sort((p, q) => p.y - q.y)
    .map(({ x, y }) => {
      const top = `M${n(x)} ${n(y)}L${n(x + cx)} ${n(y - e / 2)}L${n(x)} ${n(y - e)}L${n(x - cx)} ${n(y - e / 2)}Z`;
      const left = `M${n(x)} ${n(y)}L${n(x - cx)} ${n(y - e / 2)}L${n(x - cx)} ${n(y + e / 2)}L${n(x)} ${n(y + e)}Z`;
      const right = `M${n(x)} ${n(y)}L${n(x + cx)} ${n(y - e / 2)}L${n(x + cx)} ${n(y + e / 2)}L${n(x)} ${n(y + e)}Z`;
      return `<path d="${top}" fill="${c.p.c}" fill-opacity="0.75"/><path d="${left}" fill="${c.p.a}" fill-opacity="0.8"/><path d="${right}" fill="${c.p.b}" fill-opacity="0.8"/>`;
    })
    .join('');
  return [
    {
      svg:
        `<defs><pattern id="${id}" width="${n(s)}" height="${n(h)}" patternUnits="userSpaceOnUse">${tile}</pattern></defs>` +
        pageRect(c, `fill="url(#${id})"`) +
        cubes,
    },
  ];
};

function hexPath(x: number, y: number, r: number): string {
  let d = '';
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    d += `${i ? 'L' : 'M'}${n(x + Math.cos(a) * r)} ${n(y + Math.sin(a) * r)}`;
  }
  return `${d}Z`;
}

// Hexagons: a honeycomb lattice, with a cluster of filled cells at the focus or a few lit through it.
const hexagons: Drawer = (c) => {
  const r = unit(c) * 4.2;
  const w = SQRT3 * r;
  const id = `${c.uid}-hex`;
  const tile =
    `<path d="${hexPath(w / 2, r, r)}${hexPath(0, r * 2.5, r)}${hexPath(w, r * 2.5, r)}" fill="none" stroke="${c.p.ink}" ` +
    `stroke-opacity="${c.t.variant === 'outline' ? 0.22 : 0.1}" stroke-width="1.1"/>`;
  const cell = (col: number, row: number) => ({
    x: col * w + (row % 2 ? w / 2 : 0) + w / 2,
    y: row * r * 1.5 + r,
  });
  const colours = trio(c);
  const [fx, fy] = c.t.focus;
  const fc = Math.round((fx * c.w) / w);
  const fr = Math.round((fy * c.h) / (r * 1.5));
  const fills: string[] = [];
  if (c.t.variant === 'cluster') {
    for (let row = fr - 4; row <= fr + 4; row += 1)
      for (let col = fc - 4; col <= fc + 4; col += 1) {
        const p = cell(col, row);
        const dist = Math.hypot(p.x - fx * c.w, p.y - fy * c.h) / (r * 6);
        if (c.rnd() > 1.15 - dist && dist < 1)
          fills.push(
            `<path d="${hexPath(p.x, p.y, r * 0.92)}" fill="${colours[(col + row + 30) % 3]}" fill-opacity="${n(0.75 - dist * 0.55)}"/>`,
          );
      }
  } else {
    const count = c.t.variant === 'honeycomb' ? 14 : 6;
    for (let i = 0; i < count; i += 1) {
      const p = cell(
        Math.floor(between(c.rnd, 0, c.w / w)),
        Math.floor(between(c.rnd, 0, c.h / (r * 1.5))),
      );
      fills.push(
        `<path d="${hexPath(p.x, p.y, r * 0.92)}" fill="${colours[i % 3]}" fill-opacity="${n(between(c.rnd, 0.18, 0.4))}"/>`,
      );
    }
  }
  return [
    {
      svg:
        `<defs><pattern id="${id}" width="${n(w)}" height="${n(r * 3)}" patternUnits="userSpaceOnUse">${tile}</pattern></defs>` +
        pageRect(c, `fill="url(#${id})"`) +
        fills.join(''),
    },
  ];
};

// Triangles: a low-poly field of the palette, each facet shaded on its own, or its outlines alone.
const triangles: Drawer = (c) => {
  const cell = unit(c) * 12;
  const cols = Math.ceil(c.w / cell) + 1;
  const rows = Math.ceil(c.h / cell) + 1;
  const pts: [number, number][][] = [];
  for (let y = 0; y <= rows; y += 1) {
    const row: [number, number][] = [];
    for (let x = 0; x <= cols; x += 1) {
      const edgeX = x === 0 || x === cols;
      const edgeY = y === 0 || y === rows;
      row.push([
        x * cell + (edgeX ? 0 : between(c.rnd, -0.35, 0.35) * cell),
        y * cell + (edgeY ? 0 : between(c.rnd, -0.35, 0.35) * cell),
      ]);
    }
    pts.push(row);
  }
  const outline = c.t.variant === 'outline';
  const parts: string[] = [];
  for (let y = 0; y < rows; y += 1)
    for (let x = 0; x < cols; x += 1) {
      const p = pts[y]![x]!;
      const q = pts[y]![x + 1]!;
      const r = pts[y + 1]![x]!;
      const s = pts[y + 1]![x + 1]!;
      for (const tri of [
        [p, q, s],
        [p, s, r],
      ] as const) {
        const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3 / c.w;
        const my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3 / c.h;
        const d = `M${n(tri[0][0])} ${n(tri[0][1])}L${n(tri[1][0])} ${n(tri[1][1])}L${n(tri[2][0])} ${n(tri[2][1])}Z`;
        if (outline) {
          parts.push(d);
          continue;
        }
        const colour = mixHex(mixHex(c.p.a, c.p.b, 1 - mx), c.p.c, 1 - my * 0.6);
        parts.push(
          `<path d="${d}" fill="${colour}" fill-opacity="${n(between(c.rnd, 0.35, 0.85))}"/>`,
        );
      }
    }
  return [
    {
      svg: outline
        ? `<path d="${parts.join('')}" fill="none" stroke="${c.p.a}" stroke-opacity="0.45" stroke-width="1.2" stroke-linejoin="round"/>`
        : parts.join(''),
    },
  ];
};

// Concentric Rings: rings spreading from the focus, alternating the accent and the ink, fading outward.
const concentricRings: Drawer = (c) => {
  const step = unit(c) * 3.6;
  const [fx, fy] = c.t.focus;
  const x = fx * c.w;
  const y = fy * c.h;
  const far = Math.max(
    Math.hypot(x, y),
    Math.hypot(c.w - x, y),
    Math.hypot(x, c.h - y),
    Math.hypot(c.w - x, c.h - y),
  );
  const count = Math.min(90, Math.ceil(far / step));
  const rings = Array.from({ length: count }, (_, i) => {
    const accent = i % 3 === 0;
    const fade = 1 - i / count;
    return `<circle cx="${n(x)}" cy="${n(y)}" r="${n((i + 1) * step)}" fill="none" stroke="${accent ? c.p.a : c.p.ink}" stroke-opacity="${n((accent ? 0.55 : 0.16) * (0.35 + fade * 0.65))}" stroke-width="${accent ? 2 : 1}"/>`;
  }).join('');
  return [{ svg: rings }];
};

// Diagonal Stripes: stripes at the angle, fine, bold or candy (two colours); aligned to the strip, so they run on.
const diagonalStripes: Drawer = (c) => {
  const u = unit(c);
  const v = c.t.variant;
  const pitch = v === 'fine' ? u * 1.6 : u * 4;
  const stripe = v === 'fine' ? Math.max(1, u * 0.22) : pitch / 2;
  const id = `${c.uid}-stripes`;
  const tile =
    v === 'candy'
      ? `<rect width="${n(stripe)}" height="${n(pitch)}" fill="${c.p.a}" fill-opacity="0.55"/><rect x="${n(stripe)}" width="${n(stripe)}" height="${n(pitch)}" fill="${c.p.b}" fill-opacity="0.35"/>`
      : `<rect width="${n(stripe)}" height="${n(pitch)}" fill="${v === 'fine' ? c.p.ink : c.p.a}" fill-opacity="${v === 'fine' ? 0.18 : 0.4}"/>`;
  return [
    {
      svg:
        `<defs><pattern id="${id}" width="${n(pitch)}" height="${n(pitch)}" patternUnits="userSpaceOnUse" ` +
        `patternTransform="translate(${n(-c.ox)} 0) rotate(${n(c.t.angle)})">${tile}</pattern></defs>` +
        pageRect(c, `fill="url(#${id})"`),
    } satisfies DesignLayer,
  ];
};

// Moiré: two sets of fine rings, one from the focus and one from a point a little off it, laid over each other so
// their interference draws broad shimmering bands of its own; each set is one path.
const moire: Drawer = (c) => {
  const [fx, fy] = c.t.focus;
  const ax = fx * c.w;
  const ay = fy * c.h;
  const step = Math.max(5, unit(c) * 2);
  const shift = step * between(c.rnd, 5, 9);
  const turn = between(c.rnd, 0, Math.PI * 2);
  const bx = ax + Math.cos(turn) * shift;
  const by = ay + Math.sin(turn) * shift;
  // The rings reach the far corner, so every part of the page shows the pattern before the calm mask quiets it.
  const reach = Math.max(
    Math.hypot(ax, ay),
    Math.hypot(c.w - ax, ay),
    Math.hypot(ax, c.h - ay),
    Math.hypot(c.w - ax, c.h - ay),
  );
  const rings = (x: number, y: number) => {
    let d = '';
    for (let r = step; r <= reach + step; r += step)
      d += `M${n(x - r)} ${n(y)}a${n(r)} ${n(r)} 0 1 0 ${n(r * 2)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-r * 2)} 0`;
    return d;
  };
  const width = n(step * 0.42);
  return [
    {
      svg:
        `<path d="${rings(ax, ay)}" fill="none" stroke="${c.p.ink}" stroke-opacity="${c.p.dark ? 0.3 : 0.24}" stroke-width="${width}"/>` +
        `<path d="${rings(bx, by)}" fill="none" stroke="${c.p.a}" stroke-opacity="0.55" stroke-width="${width}"/>`,
    },
  ];
};

export const GEOMETRIC_DRAWERS = {
  grid,
  dots,
  isometric,
  hexagons,
  triangles,
  'concentric-rings': concentricRings,
  'diagonal-stripes': diagonalStripes,
  moire,
} as const;
