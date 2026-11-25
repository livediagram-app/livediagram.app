// The Bold family's poster designs (docs/specs/011-theme/page-designs.md "The twelve added on 2026-11-25"): a band
// of Bauhaus tiles, painterly brush strokes and a retro sunburst. Flat shapes and gradients only, no filters. Pure.
import {
  between,
  n,
  pick,
  smoothOpen,
  trio,
  unit,
  type DesignLayer,
  type Drawer,
} from './draw-kit';

// One Bauhaus tile at (x, y) of side s: a ground and a shape on it, each a colour of the palette or the page.
function bauhausTile(
  rnd: () => number,
  x: number,
  y: number,
  s: number,
  colours: readonly string[],
): string {
  const ground = pick(rnd, colours);
  let shape = pick(rnd, colours);
  if (shape === ground) shape = colours[(colours.indexOf(ground) + 1) % colours.length]!;
  const groundOp = rnd() < 0.3 ? 0 : 0.85;
  const kind = Math.floor(rnd() * 5);
  const corner = Math.floor(rnd() * 4);
  // The corner a quarter circle grows from, or the side a half circle stands on.
  const corners: readonly [number, number][] = [
    [x, y],
    [x + s, y],
    [x + s, y + s],
    [x, y + s],
  ];
  const [cx, cy] = corners[corner]!;
  const body =
    kind === 0
      ? `<path d="M${n(cx)} ${n(cy)}L${n(cx === x ? x + s : x)} ${n(cy)}A${n(s)} ${n(s)} 0 0 ${corner % 2 ? 0 : 1} ${n(cx)} ${n(cy === y ? y + s : y)}Z"/>`
      : kind === 1
        ? `<path d="M${n(x)} ${n(y + s)}A${n(s / 2)} ${n(s / 2)} 0 0 1 ${n(x + s)} ${n(y + s)}Z" transform="rotate(${corner * 90} ${n(x + s / 2)} ${n(y + s / 2)})"/>`
        : kind === 2
          ? `<circle cx="${n(x + s / 2)}" cy="${n(y + s / 2)}" r="${n(s * 0.36)}"/>`
          : kind === 3
            ? `<path d="M${n(x)} ${n(y + s)}L${n(x + s / 2)} ${n(y)}L${n(x + s)} ${n(y + s)}Z" transform="rotate(${corner * 90} ${n(x + s / 2)} ${n(y + s / 2)})"/>`
            : `<rect x="${n(x + s * 0.25)}" y="${n(y + s * 0.25)}" width="${n(s * 0.5)}" height="${n(s * 0.5)}"/>`;
  return (
    (groundOp
      ? `<rect x="${n(x)}" y="${n(y)}" width="${n(s)}" height="${n(s)}" fill="${ground}" fill-opacity="${groundOp}"/>`
      : '') + `<g fill="${shape}" fill-opacity="0.95">${body}</g>`
  );
}

// Bauhaus: a band of square tiles along the bottom (or down the left, or round the bottom right corner), each a
// quarter circle, a half circle, a disc, a triangle or a square on a ground of another colour. The band hangs off the
// page's edge, so only a margin's worth shows and it never reaches a layout's words (verifier, 2026-11-25: a full band
// ran under author lines); each tile is a plate, so the guard sees it under any text that still meets it.
const bauhaus: Drawer = (c) => {
  const s = unit(c) * 9;
  // How much of a tile hangs off the page.
  const hang = s * 0.45;
  const colours = [...trio(c), c.p.ink];
  const v = c.t.variant;
  const cells: [number, number][] = [];
  if (v === 'left') for (let y = 0; y < c.h; y += s) cells.push([-hang, y]);
  else if (v === 'corner') {
    for (let i = 0; i < 4; i += 1) cells.push([c.w - s * (i + 1) + hang, c.h - s + hang]);
    for (let j = 1; j < 4; j += 1) cells.push([c.w - s + hang, c.h - s * (j + 1) + hang]);
  } else for (let x = 0; x < c.w; x += s) cells.push([x, c.h - s + hang]);
  return [
    {
      svg: cells.map(([x, y]) => bauhausTile(c.rnd, x, y, s, colours)).join(''),
      plates: cells.map(([x, y]) => ({ x, y, w: s, h: s, colours, opacity: 0.95 })),
    },
  ];
};

// One brush stroke: a tapered body along a gently bending line from (x, y) at `angle` for `length`, with the dry
// brush's streaks along it.
function brushStroke(
  rnd: () => number,
  x: number,
  y: number,
  angle: number,
  length: number,
  thick: number,
  colour: string,
  streak: string,
): string {
  const dir = (angle * Math.PI) / 180;
  const ux = Math.cos(dir);
  const uy = Math.sin(dir);
  const bend = thick * between(rnd, 0.4, 1.1);
  const phase = between(rnd, 0, Math.PI);
  const steps = 14;
  const top: [number, number][] = [];
  const bottom: [number, number][] = [];
  const line: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const sway = Math.sin(t * Math.PI + phase) * bend;
    const px = x + ux * length * t - uy * sway;
    const py = y + uy * length * t + ux * sway;
    // Full width through the middle, tapering to a point at the start and a ragged end.
    const half =
      (thick / 2) * Math.min(1, Math.sin(Math.PI * t) ** 0.45 * 1.25) * (0.9 + 0.1 * rnd());
    line.push([px, py]);
    top.push([px - uy * half, py + ux * half]);
    bottom.push([px + uy * half, py - ux * half]);
  }
  const back = [...bottom].reverse();
  const body = `${smoothOpen(top)}L${n(back[0]![0])} ${n(back[0]![1])}${smoothOpen(back).replace(/^M[^C]*/, '')}Z`;
  let streaks = '';
  for (let k = 0; k < 7; k += 1) {
    const offset = (k / 6 - 0.5) * thick * 0.7;
    const from = Math.floor(between(rnd, 1, 4));
    const to = steps - Math.floor(between(rnd, 1, 5));
    streaks += smoothOpen(
      line.slice(from, to + 1).map(([px, py]) => [px - uy * offset, py + ux * offset]),
    );
  }
  return (
    `<path d="${body}" fill="${colour}" fill-opacity="0.78"/>` +
    `<path d="${streaks}" fill="none" stroke="${streak}" stroke-opacity="0.3" stroke-width="${n(Math.max(1, thick * 0.035))}" stroke-dasharray="${n(thick * 1.6)} ${n(thick * 0.35)}" stroke-linecap="round"/>`
  );
}

// Brush Strokes: a few wide painterly swipes across the top left and bottom right corners and the foot, at the angle.
const brushStrokes: Drawer = (c) => {
  const [a, b, col] = trio(c);
  const max = Math.max(c.w, c.h) * c.t.scale;
  const angle = c.t.angle;
  const thick = max * 0.09;
  const streak = c.p.dark ? '#0f172a' : '#ffffff';
  return [
    {
      svg:
        brushStroke(
          c.rnd,
          -thick,
          c.h * between(c.rnd, 0.18, 0.24),
          angle,
          c.w * 0.5,
          thick,
          a,
          streak,
        ) +
        brushStroke(
          c.rnd,
          c.w + thick,
          c.h * between(c.rnd, 0.74, 0.8),
          angle + 180,
          c.w * 0.46,
          thick * 0.9,
          b,
          streak,
        ) +
        brushStroke(
          c.rnd,
          c.w * between(c.rnd, 0.05, 0.15),
          c.h * 0.95,
          angle - 4,
          c.w * 0.3,
          thick * 0.55,
          col,
          streak,
        ),
    },
  ];
};

// How many wedge pairs Sunburst draws round its centre: a turn of one pair is its seamless loop.
const SUNBURST_PAIRS = 14;

// Sunburst: rays fanning out from the focus (the bottom edge's middle by default), alternate wedges in the accent
// fading away from the centre (or thin rays in the three colours), a sun at the centre; it turns when it moves.
const sunburst: Drawer = (c) => {
  const [fx, fy] = c.t.focus;
  const sx = fx * c.w;
  const sy = fy * c.h;
  const reach = Math.hypot(Math.max(sx, c.w - sx), Math.max(sy, c.h - sy)) * 1.05;
  const pairs = SUNBURST_PAIRS;
  const slice = Math.PI / pairs;
  const start = between(c.rnd, 0, slice);
  const rays = c.t.variant === 'rays';
  const width = rays ? slice * 0.28 : slice;
  const colours = trio(c);
  const paths = ['', '', ''];
  for (let i = 0; i < pairs; i += 1) {
    const a0 = start + i * slice * 2;
    const a1 = a0 + width;
    const slot = rays ? i % 3 : 0;
    paths[slot] +=
      `M${n(sx)} ${n(sy)}L${n(sx + Math.cos(a0) * reach)} ${n(sy + Math.sin(a0) * reach)}` +
      `L${n(sx + Math.cos(a1) * reach)} ${n(sy + Math.sin(a1) * reach)}Z`;
  }
  const fades = colours.map((col, i) => {
    const id = `${c.uid}-sb${i}`;
    return {
      id,
      def:
        `<radialGradient id="${id}" cx="${n(sx)}" cy="${n(sy)}" r="${n(reach)}" gradientUnits="userSpaceOnUse">` +
        `<stop offset="0" stop-color="${col}" stop-opacity="${rays ? 0.75 : 0.55}"/>` +
        `<stop offset="0.7" stop-color="${col}" stop-opacity="${rays ? 0.3 : 0.18}"/>` +
        `<stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`,
    };
  });
  const sun = unit(c) * 11;
  const turning: DesignLayer = {
    svg:
      `<defs>${fades.map((f) => f.def).join('')}</defs>` +
      paths.map((d, i) => (d ? `<path d="${d}" fill="url(#${fades[i]!.id})"/>` : '')).join(''),
    motion: { kind: 'spin', seconds: 40, turn: 360 / pairs, origin: [sx, sy] },
  };
  return [
    turning,
    {
      svg:
        `<circle cx="${n(sx)}" cy="${n(sy)}" r="${n(sun * 1.5)}" fill="${colours[1]}" fill-opacity="0.35"/>` +
        `<circle cx="${n(sx)}" cy="${n(sy)}" r="${n(sun)}" fill="${colours[2]}" fill-opacity="0.85"/>`,
    },
  ];
};

export const POSTER_DRAWERS = {
  bauhaus,
  'brush-strokes': brushStrokes,
  sunburst,
} as const;
