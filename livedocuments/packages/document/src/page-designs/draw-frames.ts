// The Frames family (docs/specs/011-theme/page-designs.md "The catalogue"): decoration held to the page's edges and
// corners, leaving its whole middle to the content. Pure.
import { mixHex } from '@liveworkspace/model-core/color-wash';
import { between, n, unit, type Drawer } from './draw-kit';

// Corner Accents: brackets, arcs or triangles in two opposite corners.
const cornerAccents: Drawer = (c) => {
  const u = unit(c);
  const m = u * 4;
  const len = u * 14;
  const v = c.t.variant;
  const draw = (x: number, y: number, sx: 1 | -1, sy: 1 | -1, colour: string) => {
    if (v === 'arcs') {
      const out = [1, 1.35, 1.7]
        .map(
          (k, i) =>
            `<path d="M${n(x)} ${n(y + sy * len * k)}A${n(len * k)} ${n(len * k)} 0 0 ${sx * sy > 0 ? 1 : 0} ${n(x + sx * len * k)} ${n(y)}" fill="none" stroke="${colour}" stroke-opacity="${n(0.8 - i * 0.22)}" stroke-width="${n(u * (1.2 - i * 0.3))}"/>`,
        )
        .join('');
      return out;
    }
    if (v === 'triangles')
      return (
        `<path d="M${n(x - sx * m)} ${n(y - sy * m)}h${n(sx * (len * 1.6 + m))}L${n(x - sx * m)} ${n(y + sy * (len * 1.6))}Z" fill="${colour}" fill-opacity="0.85"/>` +
        `<path d="M${n(x + sx * len * 0.9)} ${n(y + sy * u)}l${n(sx * len * 0.5)} 0L${n(x + sx * len * 0.9)} ${n(y + sy * (u + len * 0.5))}Z" fill="${colour}" fill-opacity="0.4"/>`
      );
    return `<path d="M${n(x)} ${n(y + sy * len)}V${n(y)}H${n(x + sx * len)}" fill="none" stroke="${colour}" stroke-width="${n(u * 1.1)}" stroke-linecap="square"/><path d="M${n(x + sx * u * 2.6)} ${n(y + sy * len * 0.6)}V${n(y + sy * u * 2.6)}H${n(x + sx * len * 0.6)}" fill="none" stroke="${colour}" stroke-opacity="0.5" stroke-width="${n(u * 0.5)}"/>`;
  };
  return [
    {
      svg: draw(m, m, 1, 1, c.p.a) + draw(c.w - m, c.h - m, -1, -1, c.p.b),
    },
  ];
};

// Edge Bands: bold bands along the top and bottom, a band down the left, or a slanted band across a corner.
const edgeBands: Drawer = (c) => {
  const u = unit(c);
  const v = c.t.variant;
  if (v === 'left')
    return [
      {
        svg:
          `<rect width="${n(u * 7)}" height="${n(c.h)}" fill="${c.p.a}" fill-opacity="0.9"/>` +
          `<rect x="${n(u * 7)}" width="${n(u * 1.4)}" height="${n(c.h)}" fill="${c.p.b}" fill-opacity="0.75"/>` +
          `<rect x="${n(u * 9.6)}" width="${n(u * 0.4)}" height="${n(c.h)}" fill="${c.p.c}" fill-opacity="0.6"/>`,
      },
    ];
  if (v === 'corner') {
    const turn = c.t.angle;
    const band = u * 9;
    return [
      {
        svg:
          `<g transform="rotate(${n(-turn)} ${n(c.w)} 0)"><rect x="${n(c.w - band * 6)}" y="${n(-band * 0.2)}" width="${n(band * 12)}" height="${n(band)}" fill="${c.p.a}" fill-opacity="0.9"/>` +
          `<rect x="${n(c.w - band * 6)}" y="${n(band * 1.1)}" width="${n(band * 12)}" height="${n(band * 0.25)}" fill="${c.p.b}" fill-opacity="0.8"/></g>` +
          `<g transform="rotate(${n(-turn)} 0 ${n(c.h)})"><rect x="${n(-band * 6)}" y="${n(c.h - band * 0.8)}" width="${n(band * 12)}" height="${n(band)}" fill="${c.p.b}" fill-opacity="0.85"/></g>`,
      },
    ];
  }
  return [
    {
      svg:
        `<rect width="${n(c.w)}" height="${n(u * 5)}" fill="${c.p.a}" fill-opacity="0.9"/>` +
        `<rect y="${n(u * 5)}" width="${n(c.w * 0.38)}" height="${n(u * 1.2)}" fill="${c.p.b}" fill-opacity="0.85"/>` +
        `<rect y="${n(c.h - u * 2.4)}" width="${n(c.w)}" height="${n(u * 2.4)}" fill="${c.p.b}" fill-opacity="0.85"/>` +
        `<rect x="${n(c.w * 0.7)}" y="${n(c.h - u * 3.4)}" width="${n(c.w * 0.3)}" height="${n(u)}" fill="${c.p.c}" fill-opacity="0.8"/>`,
    },
  ];
};

// Side Rail: a slim rail down one side, a fine line beside it and markers along it.
const sideRail: Drawer = (c) => {
  const u = unit(c);
  const right = c.t.variant === 'right';
  const railW = u * 4.5;
  const x = right ? c.w - railW : 0;
  const lineX = right ? c.w - railW - u * 2 : railW + u * 2;
  const marks = Array.from({ length: 5 }, (_, i) => {
    const y = c.h * (0.18 + i * 0.16) + between(c.rnd, -u, u);
    return `<circle cx="${n(lineX)}" cy="${n(y)}" r="${n(u * (i === 0 ? 1 : 0.55))}" fill="${i === 0 ? c.p.b : c.p.ink}" fill-opacity="${i === 0 ? 0.95 : 0.4}"/>`;
  }).join('');
  return [
    {
      svg:
        `<rect x="${n(x)}" width="${n(railW)}" height="${n(c.h)}" fill="${c.p.a}" fill-opacity="0.9"/>` +
        `<rect x="${n(x)}" y="${n(c.h * 0.12)}" width="${n(railW)}" height="${n(c.h * 0.1)}" fill="${c.p.b}" fill-opacity="0.9"/>` +
        `<path d="M${n(lineX)} 0V${n(c.h)}" stroke="${c.p.ink}" stroke-opacity="0.2" stroke-width="1"/>` +
        marks,
    },
  ];
};

// A torn strip: the band from the page's top (or bottom) edge to a jagged tear at `y`, as one closed path.
function tornStrip(c: Parameters<Drawer>[0], y: number, depth: number, top: boolean): string {
  const step = unit(c) * 1.6;
  let d = `M0 ${n(top ? 0 : c.h)}H${n(c.w)}`;
  for (let x = c.w; x > -step; x -= step)
    d += `L${n(Math.max(0, x))} ${n(y + between(c.rnd, -depth, depth))}`;
  return `${d}Z`;
}

// Torn Paper: a strip of colour torn along its edge at the top, the bottom or both, a paler layer showing under it.
const tornPaper: Drawer = (c) => {
  const u = unit(c);
  const v = c.t.variant;
  const band = u * 10;
  const depth = u * 0.9;
  const parts: string[] = [];
  const strip = (top: boolean) => {
    const y = top ? band : c.h - band;
    const colour = top ? c.p.a : c.p.b;
    // The paler under-layer reaches a little further, as torn paper shows its fibres.
    parts.push(
      `<path d="${tornStrip(c, y + (top ? 1 : -1) * u * 1.2, depth, top)}" fill="${mixHex(colour, c.p.base, 0.3)}" fill-opacity="0.9"/>`,
      `<path d="${tornStrip(c, y, depth, top)}" fill="${colour}" fill-opacity="0.9"/>`,
    );
  };
  if (v !== 'bottom') strip(true);
  if (v !== 'top') strip(false);
  return [{ svg: parts.join('') }];
};

// Offset Border: a border inset from the edge, a second one offset from it in another colour (or its corners only).
const offsetBorder: Drawer = (c) => {
  const u = unit(c);
  const inset = u * 3.2;
  const off = u * 1.1;
  const v = c.t.variant;
  const box = (k: number, colour: string, op: number, width: number) =>
    `<rect x="${n(k)}" y="${n(k)}" width="${n(c.w - k * 2)}" height="${n(c.h - k * 2)}" fill="none" stroke="${colour}" stroke-opacity="${n(op)}" stroke-width="${n(width)}"/>`;
  if (v === 'corners') {
    const len = u * 9;
    const corner = (x: number, y: number, sx: number, sy: number) =>
      `M${n(x)} ${n(y + sy * len)}V${n(y)}H${n(x + sx * len)}`;
    const d =
      corner(inset, inset, 1, 1) +
      corner(c.w - inset, inset, -1, 1) +
      corner(inset, c.h - inset, 1, -1) +
      corner(c.w - inset, c.h - inset, -1, -1);
    return [
      {
        svg: `<path d="${d}" fill="none" stroke="${c.p.a}" stroke-width="${n(u * 0.6)}"/>${box(inset + off, c.p.ink, 0.15, 1)}`,
      },
    ];
  }
  return [
    {
      svg:
        box(inset, c.p.a, 0.9, Math.max(1.5, u * 0.35)) +
        (v === 'double'
          ? `<rect x="${n(inset + off)}" y="${n(inset + off)}" width="${n(c.w - inset * 2)}" height="${n(c.h - inset * 2)}" fill="none" stroke="${c.p.b}" stroke-opacity="0.6" stroke-width="${n(Math.max(1, u * 0.2))}"/>`
          : ''),
    },
  ];
};

export const FRAME_DRAWERS = {
  'corner-accents': cornerAccents,
  'edge-bands': edgeBands,
  'side-rail': sideRail,
  'torn-paper': tornPaper,
  'offset-border': offsetBorder,
} as const;
