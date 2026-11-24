// The Gradients family (docs/specs/011-theme/page-designs.md "The catalogue"): soft washes of the palette's colours.
// Soft edges are radial gradients, never blur filters, so a moving layer never repaints. Pure.
import {
  between,
  glowDef,
  linearDef,
  n,
  sides,
  smoothOpen,
  trio,
  type DesignLayer,
  type Drawer,
} from './draw-kit';

// Soft Mesh: big soft lights of the three colours overlapping, placed along the strip so a flowing deck runs on.
const softMesh: Drawer = (c) => {
  const { max } = sides(c);
  const count = Math.max(4, Math.round((c.span / c.w) * 4));
  const colours = trio(c);
  const lights = Array.from({ length: count }, (_, i) => ({
    x: between(c.rnd, 0, c.span),
    y: between(c.rnd, -0.15, 1.15) * c.h,
    r: between(c.rnd, 0.45, 0.75) * max * c.t.scale,
    colour: colours[i % 3]!,
    layer: i % 2,
  }));
  const layers: DesignLayer[] = [0, 1].map((layer) => {
    const mine = lights.filter(
      (l) => l.layer === layer && l.x + l.r > c.ox && l.x - l.r < c.ox + c.w,
    );
    const defs = mine
      .map((l, i) => glowDef(`${c.uid}-m${layer}-${i}`, l.colour, 0.85, c.t.blur))
      .join('');
    const shapes = mine
      .map(
        (l, i) =>
          `<circle cx="${n(l.x - c.ox)}" cy="${n(l.y)}" r="${n(l.r)}" fill="url(#${c.uid}-m${layer}-${i})"/>`,
      )
      .join('');
    return {
      svg: `<defs>${defs}</defs>${shapes}`,
      motion: {
        kind: 'drift',
        seconds: 26 + layer * 9,
        x: c.w * 0.06,
        y: c.h * (layer ? -0.05 : 0.05),
      },
    };
  });
  return layers;
};

// Aurora: curtains of light, each a band whose top edge waves, fading downward; turned by the angle.
const aurora: Drawer = (c) => {
  const colours = trio(c);
  const turn = `rotate(${n(c.t.angle)} ${n(c.w / 2)} ${n(c.h / 2)})`;
  const bands = 3;
  const wave = c.t.scale * c.w * 0.5;
  return Array.from({ length: bands }, (_, i) => {
    const base = c.h * (0.18 + i * 0.12);
    const depth = c.h * (0.35 + 0.1 * c.t.blur);
    const phase = between(c.rnd, 0, Math.PI * 2);
    const amp = c.h * between(c.rnd, 0.05, 0.11);
    const pts: [number, number][] = [];
    // Wider than the page, so the turn and the drift never show an end.
    for (let x = -c.w * 0.3; x <= c.w * 1.3; x += c.w / 8) {
      const wx = x + c.ox;
      pts.push([
        x,
        base + Math.sin(wx / wave + phase) * amp + Math.sin(wx / (wave * 0.37)) * amp * 0.3,
      ]);
    }
    const top = smoothOpen(pts);
    const id = `${c.uid}-au${i}`;
    const colour = colours[i]!;
    const d = `${top}L${n(c.w * 1.3)} ${n(base + depth)}L${n(-c.w * 0.3)} ${n(base + depth)}Z`;
    return {
      svg:
        `<defs>${linearDef(id, [
          [0, colour, 0],
          [0.12, colour, 0.75],
          [0.45, colour, 0.35],
          [1, colour, 0],
        ])}</defs>` + `<g transform="${turn}"><path d="${d}" fill="url(#${id})"/></g>`,
      motion: {
        kind: 'drift',
        seconds: 18 + i * 7,
        x: c.w * (i % 2 ? -0.07 : 0.07),
        y: c.h * 0.02,
      },
    };
  });
};

// Duotone Sweep: the page washed from one colour to another at the angle, a band of light sweeping across.
const duotoneSweep: Drawer = (c) => {
  const id = `${c.uid}-duo`;
  const sweep = `${c.uid}-sweep`;
  // Across the strip, so a flowing deck runs from the first colour to the second over its pages.
  const x0 = -c.ox;
  const wash =
    `<defs>${linearDef(
      id,
      [
        [0, c.p.a, 0.85],
        [0.55, c.p.b, 0.6],
        [1, c.p.c, 0.8],
      ],
      c.t.angle,
    )}</defs>` + `<rect x="${n(x0)}" width="${n(c.span)}" height="${n(c.h)}" fill="url(#${id})"/>`;
  const light = '#ffffff';
  const bandW = c.w * 0.45;
  const band =
    `<defs>${linearDef(
      sweep,
      [
        [0, light, 0],
        [0.5, light, c.p.dark ? 0.16 : 0.38],
        [1, light, 0],
      ],
      90,
    )}</defs>` +
    `<g transform="rotate(${n(c.t.angle - 90)} ${n(c.w / 2)} ${n(c.h / 2)})">` +
    `<rect x="${n(-bandW)}" y="${n(-c.h)}" width="${n(bandW)}" height="${n(c.h * 3)}" fill="url(#${sweep})"/></g>`;
  return [{ svg: wash }, { svg: band, motion: { kind: 'pan', seconds: 14, x: c.w + bandW * 2 } }];
};

// Radial Glow: one big glow at the focus, answered by a smaller one across the page.
const radialGlow: Drawer = (c) => {
  const { max } = sides(c);
  const [fx, fy] = c.t.focus;
  const r = max * 0.75 * c.t.scale;
  const main = `${c.uid}-g1`;
  const echo = `${c.uid}-g2`;
  return [
    {
      svg:
        `<defs>${glowDef(main, c.p.a, 0.9, c.t.blur)}</defs>` +
        `<circle cx="${n(fx * c.w)}" cy="${n(fy * c.h)}" r="${n(r)}" fill="url(#${main})"/>`,
      motion: { kind: 'breathe', seconds: 16, scale: 1.08, origin: [fx * c.w, fy * c.h] },
    },
    {
      svg:
        `<defs>${glowDef(echo, c.p.b, 0.7, c.t.blur)}</defs>` +
        `<circle cx="${n((1 - fx) * c.w)}" cy="${n((1 - fy) * c.h)}" r="${n(r * 0.6)}" fill="url(#${echo})"/>`,
      motion: {
        kind: 'breathe',
        seconds: 21,
        scale: 1.12,
        origin: [(1 - fx) * c.w, (1 - fy) * c.h],
      },
    },
  ];
};

// Sunset Bands: a low sun on a horizon, bands of colour stepping down beneath it.
const sunsetBands: Drawer = (c) => {
  const [fx, fy] = c.t.focus;
  const horizon = fy * c.h;
  const sunR = Math.min(c.w, c.h) * 0.22 * c.t.scale;
  const sun = `${c.uid}-sun`;
  const sky = `${c.uid}-sky`;
  const colours = trio(c);
  const bands = 5;
  const bandH = (c.h - horizon) / bands;
  const rows = Array.from({ length: bands }, (_, i) => {
    const colour = colours[i % 3]!;
    const y = horizon + i * bandH;
    // Each band a touch thinner than the room, the gaps widening downward as on a retro sun.
    const gap = bandH * (0.08 + i * 0.05);
    return `<rect y="${n(y + gap)}" width="${n(c.w)}" height="${n(Math.max(1, bandH - gap))}" fill="${colour}" fill-opacity="${n(0.32 + i * 0.1)}"/>`;
  }).join('');
  return [
    {
      svg:
        `<defs>${linearDef(sky, [
          [0, c.p.a, 0],
          [1, c.p.b, 0.45],
        ])}${linearDef(sun, [
          [0, c.p.c, 0.95],
          [1, c.p.a, 0.95],
        ])}<clipPath id="${c.uid}-hz"><rect width="${n(c.w)}" height="${n(horizon)}"/></clipPath></defs>` +
        `<rect width="${n(c.w)}" height="${n(horizon)}" fill="url(#${sky})"/>` +
        `<circle cx="${n(fx * c.w)}" cy="${n(horizon)}" r="${n(sunR)}" fill="url(#${sun})" clip-path="url(#${c.uid}-hz)"/>` +
        rows,
    },
  ];
};

export const GRADIENT_DRAWERS = {
  'soft-mesh': softMesh,
  aurora,
  'duotone-sweep': duotoneSweep,
  'radial-glow': radialGlow,
  'sunset-bands': sunsetBands,
} as const;
