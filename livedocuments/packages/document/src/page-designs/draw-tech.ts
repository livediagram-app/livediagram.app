// The Tech and Space family (docs/specs/011-theme/page-designs.md "The catalogue"): circuit traces, stars,
// constellations, a data grid and scanlines. Pure.
import {
  between,
  glowDef,
  linearDef,
  n,
  pageRect,
  trio,
  unit,
  type DesignLayer,
  type Drawer,
} from './draw-kit';

// Circuit: traces running in right angles and forty-fives from the page's edges, each ending in a pad; a few lit.
const circuit: Drawer = (c) => {
  const u = unit(c);
  const step = u * 4;
  const traces: string[] = [];
  const lit: string[] = [];
  const pads: string[] = [];
  for (let i = 0; i < 18; i += 1) {
    const side = i % 4;
    let x =
      side === 1
        ? c.w
        : side === 3
          ? 0
          : Math.round(between(c.rnd, 0.05, 0.95) * (c.w / step)) * step;
    let y =
      side === 0
        ? 0
        : side === 2
          ? c.h
          : Math.round(between(c.rnd, 0.05, 0.95) * (c.h / step)) * step;
    const dir = [
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 0],
    ][side]!;
    let d = `M${n(x)} ${n(y)}`;
    const legs = Math.round(between(c.rnd, 2, 4));
    let [dx, dy] = dir as [number, number];
    for (let k = 0; k < legs; k += 1) {
      const len = step * Math.round(between(c.rnd, 1.5, 5));
      x += dx * len;
      y += dy * len;
      d += `L${n(x)} ${n(y)}`;
      // Turn by forty-five degrees one way or the other, then straighten.
      const turn = c.rnd() < 0.5 ? 1 : -1;
      if (dx === 0) dx = turn;
      else if (dy === 0) dy = turn;
      else if (c.rnd() < 0.5) dy = 0;
      else dx = 0;
    }
    (i % 5 === 0 ? lit : traces).push(d);
    pads.push(
      `<circle cx="${n(x)}" cy="${n(y)}" r="${n(u * 0.8)}" fill="${c.p.base}" stroke="${i % 5 === 0 ? c.p.b : c.p.a}" stroke-width="${n(u * 0.35)}"/>`,
    );
  }
  const glow = `${c.uid}-cg`;
  return [
    {
      svg:
        `<path d="${traces.join('')}" fill="none" stroke="${c.p.a}" stroke-opacity="0.5" stroke-width="${n(u * 0.35)}" stroke-linejoin="round"/>` +
        pads.join(''),
    },
    {
      svg:
        `<defs>${glowDef(glow, c.p.b, 0.45, 0.8)}</defs>` +
        `<path d="${lit.join('')}" fill="none" stroke="${c.p.b}" stroke-opacity="0.9" stroke-width="${n(u * 0.45)}" stroke-linejoin="round"/>`,
      motion: { kind: 'twinkle', seconds: 4 },
    },
  ];
};

// Starfield: three sizes of stars (each one path), a faint nebula of the palette; the small stars twinkle.
const starfield: Drawer = (c) => {
  const area = (c.w * c.h) / 10000;
  const sizes = [
    { count: Math.round(area * 1.6), r: 0.6 },
    { count: Math.round(area * 0.5), r: 1.1 },
    { count: Math.round(area * 0.12), r: 1.8 },
  ];
  const ink = c.p.dark ? '#ffffff' : c.p.ink;
  const paths = sizes.map(({ count, r }) => {
    let d = '';
    for (let i = 0; i < Math.min(count, 900); i += 1) {
      const x = between(c.rnd, 0, c.w);
      const y = between(c.rnd, 0, c.h);
      const rr = r * c.t.scale;
      d += `M${n(x - rr)} ${n(y)}a${n(rr)} ${n(rr)} 0 1 0 ${n(rr * 2)} 0a${n(rr)} ${n(rr)} 0 1 0 ${n(-rr * 2)} 0`;
    }
    return d;
  });
  const n1 = `${c.uid}-n1`;
  const n2 = `${c.uid}-n2`;
  const max = Math.max(c.w, c.h);
  return [
    {
      svg:
        `<defs>${glowDef(n1, c.p.a, 0.4, 0.9)}${glowDef(n2, c.p.b, 0.3, 0.9)}</defs>` +
        `<ellipse cx="${n(c.w * 0.7 - c.ox * 0.2)}" cy="${n(c.h * 0.35)}" rx="${n(max * 0.5)}" ry="${n(max * 0.3)}" fill="url(#${n1})"/>` +
        `<ellipse cx="${n(c.w * 0.25)}" cy="${n(c.h * 0.75)}" rx="${n(max * 0.4)}" ry="${n(max * 0.22)}" fill="url(#${n2})"/>` +
        `<path d="${paths[1]}" fill="${ink}" fill-opacity="0.7"/><path d="${paths[2]}" fill="${ink}" fill-opacity="0.9"/>`,
      motion: { kind: 'drift', seconds: 60, x: -c.w * 0.02, y: 0 },
    },
    {
      svg: `<path d="${paths[0]}" fill="${ink}" fill-opacity="0.6"/>`,
      motion: { kind: 'twinkle', seconds: 5 },
    },
  ];
};

// Constellations: stars joined in a few figures by fine lines, each star with a small glow.
const constellations: Drawer = (c) => {
  const u = unit(c);
  const ink = c.p.dark ? '#ffffff' : c.p.ink;
  const lines: string[] = [];
  const stars: string[] = [];
  const figures = 4;
  for (let f = 0; f < figures; f += 1) {
    const cx = ((f + between(c.rnd, 0.2, 0.8)) / figures) * c.w;
    const cy = between(c.rnd, 0.15, 0.85) * c.h;
    const pts: [number, number][] = Array.from({ length: Math.round(between(c.rnd, 4, 7)) }, () => [
      cx + between(c.rnd, -1, 1) * u * 14 * c.t.scale,
      cy + between(c.rnd, -1, 1) * u * 12 * c.t.scale,
    ]);
    pts.sort((p, q) => p[0] - q[0]);
    lines.push(pts.map((p, i) => `${i ? 'L' : 'M'}${n(p[0])} ${n(p[1])}`).join(''));
    pts.forEach((p, i) =>
      stars.push(
        `<circle cx="${n(p[0])}" cy="${n(p[1])}" r="${n(u * (i % 3 === 0 ? 0.9 : 0.55))}" fill="${i % 3 === 0 ? c.p.b : ink}"/>`,
      ),
    );
  }
  let dust = '';
  for (let i = 0; i < 120; i += 1) {
    const x = between(c.rnd, 0, c.w);
    const y = between(c.rnd, 0, c.h);
    dust += `M${n(x)} ${n(y)}h0.01`;
  }
  return [
    {
      svg:
        `<path d="${dust}" stroke="${ink}" stroke-opacity="0.45" stroke-width="${n(u * 0.35)}" stroke-linecap="round"/>` +
        `<path d="${lines.join('')}" fill="none" stroke="${c.p.a}" stroke-opacity="0.55" stroke-width="1"/>`,
    },
    { svg: stars.join(''), motion: { kind: 'twinkle', seconds: 6 } },
  ];
};

// Data Grid: a perspective grid sinking to a horizon (or a flat matrix of cells lit at random), a glow along its line.
const dataGrid: Drawer = (c) => {
  const u = unit(c);
  if (c.t.variant === 'matrix') {
    const cell = u * 3;
    const id = `${c.uid}-dm`;
    const colours = trio(c);
    let lit = '';
    for (let i = 0; i < 60; i += 1) {
      const x = Math.floor(between(c.rnd, 0, c.w / cell)) * cell;
      const y = Math.floor(between(c.rnd, 0, c.h / cell)) * cell;
      lit += `<rect x="${n(x + 1)}" y="${n(y + 1)}" width="${n(cell - 2)}" height="${n(cell - 2)}" fill="${colours[i % 3]}" fill-opacity="${n(between(c.rnd, 0.2, 0.7))}"/>`;
    }
    return [
      {
        svg:
          `<defs><pattern id="${id}" width="${n(cell)}" height="${n(cell)}" patternUnits="userSpaceOnUse"><path d="M${n(cell)} 0H0V${n(cell)}" fill="none" stroke="${c.p.ink}" stroke-opacity="0.1"/></pattern></defs>` +
          pageRect(c, `fill="url(#${id})"`) +
          lit,
      },
    ];
  }
  const horizon = c.t.focus[1] * c.h;
  const vx = c.t.focus[0] * c.w;
  let d = '';
  const spokes = 22;
  for (let i = -spokes; i <= spokes; i += 1) {
    const bx = vx + (i / spokes) * c.w * 2.2;
    d += `M${n(vx)} ${n(horizon)}L${n(bx)} ${n(c.h)}`;
  }
  for (let k = 1; k <= 12; k += 1) {
    const t = (k / 12) ** 2;
    const y = horizon + (c.h - horizon) * t;
    d += `M0 ${n(y)}H${n(c.w)}`;
  }
  const fade = `${c.uid}-df`;
  const glow = `${c.uid}-dg`;
  return [
    {
      svg:
        `<defs>${linearDef(fade, [
          [0, '#ffffff', 0],
          [1, '#ffffff', 1],
        ])}<mask id="${fade}-m"><rect y="${n(horizon)}" width="${n(c.w)}" height="${n(c.h - horizon)}" fill="url(#${fade})"/></mask>` +
        `${glowDef(glow, c.p.b, 0.55, 0.9)}</defs>` +
        `<ellipse cx="${n(vx)}" cy="${n(horizon)}" rx="${n(c.w * 0.6)}" ry="${n(c.h * 0.12)}" fill="url(#${glow})"/>` +
        `<path d="${d}" fill="none" stroke="${c.p.a}" stroke-opacity="0.65" stroke-width="1" mask="url(#${fade}-m)"/>` +
        `<path d="M0 ${n(horizon)}H${n(c.w)}" stroke="${c.p.b}" stroke-opacity="0.8" stroke-width="${n(u * 0.3)}"/>`,
    },
  ];
};

// Scanlines: a CRT's fine lines over a soft glow, a brighter band rolling down the page when it moves.
const scanlines: Drawer = (c) => {
  const soft = c.t.variant === 'soft';
  const pitch = Math.max(2, unit(c) * (soft ? 1.2 : 0.6));
  const id = `${c.uid}-sl`;
  const glow = `${c.uid}-slg`;
  const band = `${c.uid}-slb`;
  const bandH = c.h * 0.18;
  const layers: DesignLayer[] = [
    {
      svg:
        `<defs>${glowDef(glow, c.p.a, 0.35, 0.9)}<pattern id="${id}" width="4" height="${n(pitch)}" patternUnits="userSpaceOnUse">` +
        `<rect width="4" height="${n(pitch / 2)}" fill="${c.p.ink}" fill-opacity="${soft ? 0.06 : 0.12}"/></pattern></defs>` +
        `<ellipse cx="${n(c.w / 2)}" cy="${n(c.h / 2)}" rx="${n(c.w * 0.7)}" ry="${n(c.h * 0.7)}" fill="url(#${glow})"/>` +
        pageRect(c, `fill="url(#${id})"`),
    },
    {
      svg: `<defs>${linearDef(band, [
        [0, c.p.b, 0],
        [0.5, c.p.b, 0.18],
        [1, c.p.b, 0],
      ])}</defs><rect y="${n(-bandH)}" width="${n(c.w)}" height="${n(bandH)}" fill="url(#${band})"/>`,
      motion: { kind: 'pan', seconds: 9, y: c.h + bandH },
    },
  ];
  return layers;
};

export const TECH_DRAWERS = {
  circuit,
  starfield,
  constellations,
  'data-grid': dataGrid,
  scanlines,
} as const;
