// The Texture family (docs/specs/011-theme/page-designs.md "The catalogue"): grain, noise, weave, print, drafting and
// stone chips (Risograph's variations are draw-riso.ts).
// The grain and noise are SVG turbulence on static layers only (never a moving one), and the weave and dots are
// patterns. Pure.
import {
  between,
  glowDef,
  grainSvg,
  hexChannels,
  n,
  pageRect,
  unit,
  type Drawer,
} from './draw-kit';

// Paper Grain: a fine fibrous grain over the page, warmed by the accent, a soft darkening toward the edges.
const paperGrain: Drawer = (c) => {
  const vignette = `${c.uid}-vg`;
  return [
    {
      svg:
        `<defs><radialGradient id="${vignette}" r="0.75"><stop offset="0.55" stop-color="${c.p.a}" stop-opacity="0"/>` +
        `<stop offset="1" stop-color="${c.p.a}" stop-opacity="${c.p.dark ? 0.25 : 0.16}"/></radialGradient></defs>` +
        pageRect(c, `fill="url(#${vignette})"`) +
        grainSvg(`${c.uid}-pg`, c.w, c.h, c.p.ink, 0.42, c.t.seed, 0.95) +
        grainSvg(`${c.uid}-pf`, c.w, c.h, c.p.a, 0.22, c.t.seed + 7, 0.045),
    },
  ];
};

// Noise: a coarse film noise in the palette's colours, or in the ink alone.
const noise: Drawer = (c) => {
  const mono = c.t.variant === 'mono';
  const id = `${c.uid}-nz`;
  const [r1, g1, b1] = hexChannels(c.p.a);
  const [r2, g2, b2] = hexChannels(c.p.b);
  const freq = 0.6 / c.t.scale;
  const colour = mono
    ? ''
    : `<feColorMatrix type="matrix" values="${n(r1)} 0 0 0 ${n(r2 * 0.3)} 0 ${n(g1)} 0 0 ${n(g2 * 0.3)} 0 0 ${n(b1)} 0 ${n(b2 * 0.3)} 0 0 0 1.3 -0.35"/>`;
  return [
    {
      svg: mono
        ? grainSvg(id, c.w, c.h, c.p.ink, 0.75, c.t.seed, freq)
        : `<defs><filter id="${id}" x="0" y="0" width="1" height="1"><feTurbulence type="turbulence" baseFrequency="${n(freq)}" numOctaves="2" seed="${c.t.seed % 1000}" stitchTiles="stitch"/>${colour}</filter></defs>` +
          pageRect(c, `filter="url(#${id})"`),
    },
  ];
};

// Linen: a woven grid of fine threads, each row and column a little uneven, over a faint grain.
const linen: Drawer = (c) => {
  const pitch = Math.max(3, unit(c) * 0.6);
  const id = `${c.uid}-ln`;
  const tile =
    `<rect width="${n(pitch)}" height="${n(pitch * 0.42)}" fill="${c.p.ink}" fill-opacity="0.07"/>` +
    `<rect width="${n(pitch * 0.42)}" height="${n(pitch)}" fill="${c.p.ink}" fill-opacity="0.06"/>` +
    `<rect x="${n(pitch * 0.5)}" y="${n(pitch * 0.5)}" width="${n(pitch * 0.5)}" height="${n(pitch * 0.18)}" fill="${c.p.a}" fill-opacity="0.08"/>`;
  return [
    {
      svg:
        `<defs><pattern id="${id}" width="${n(pitch)}" height="${n(pitch)}" patternUnits="userSpaceOnUse">${tile}</pattern></defs>` +
        pageRect(c, `fill="url(#${id})"`) +
        grainSvg(`${c.uid}-lg`, c.w, c.h, c.p.ink, 0.2, c.t.seed, 0.07),
    },
  ];
};

// Risograph: two big shapes printed in dots of two inks, a little out of register, under a print's grain.
const risograph: Drawer = (c) => {
  const pitch = Math.max(4, unit(c) * 0.9);
  const max = Math.max(c.w, c.h) * c.t.scale;
  const blend = c.p.dark ? 'screen' : 'multiply';
  const plate = (id: string, colour: string) =>
    `<pattern id="${id}" width="${n(pitch)}" height="${n(pitch)}" patternUnits="userSpaceOnUse" patternTransform="rotate(${id.endsWith('a') ? 15 : 75})">` +
    `<circle cx="${n(pitch / 2)}" cy="${n(pitch / 2)}" r="${n(pitch * 0.36)}" fill="${colour}"/></pattern>`;
  const x1 = between(c.rnd, 0.6, 0.9) * c.w;
  const y1 = between(c.rnd, 0.05, 0.35) * c.h;
  const x2 = between(c.rnd, 0.05, 0.35) * c.w;
  const y2 = between(c.rnd, 0.65, 0.95) * c.h;
  const off = unit(c) * 0.9;
  return [
    {
      svg:
        `<defs>${plate(`${c.uid}-ra`, c.p.a)}${plate(`${c.uid}-rb`, c.p.b)}</defs>` +
        `<g style="mix-blend-mode:${blend}">` +
        `<circle cx="${n(x1)}" cy="${n(y1)}" r="${n(max * 0.24)}" fill="url(#${c.uid}-ra)" fill-opacity="0.85"/>` +
        `<rect x="${n(x2 - max * 0.2 + off)}" y="${n(y2 - max * 0.14 + off)}" width="${n(max * 0.4)}" height="${n(max * 0.28)}" rx="${n(max * 0.04)}" fill="url(#${c.uid}-rb)" fill-opacity="0.85" transform="rotate(-8 ${n(x2)} ${n(y2)})"/>` +
        `<circle cx="${n(x1 + off * 1.6)}" cy="${n(y1 - off)}" r="${n(max * 0.24)}" fill="none" stroke="${c.p.b}" stroke-opacity="0.55" stroke-width="${n(unit(c) * 0.5)}"/>` +
        `</g>` +
        grainSvg(`${c.uid}-rg`, c.w, c.h, c.p.ink, 0.35, c.t.seed, 0.9),
    },
  ];
};

// Halftone: dots swelling toward a corner, an edge or the middle, as a printed tone does, at the angle.
const halftone: Drawer = (c) => {
  const pitch = Math.max(6, unit(c) * 2.2);
  const [fx, fy] = c.t.focus;
  const v = c.t.variant;
  const reach = Math.hypot(c.w, c.h) * (v === 'centre' ? 0.45 : 0.6);
  const a = (c.t.angle * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const cols = Math.ceil(Math.hypot(c.w, c.h) / pitch);
  let d = '';
  let count = 0;
  for (let gy = -cols; gy <= cols && count < 1400; gy += 1)
    for (let gx = -cols; gx <= cols && count < 1400; gx += 1) {
      const x = c.w / 2 + (gx * cos - gy * sin) * pitch;
      const y = c.h / 2 + (gx * sin + gy * cos) * pitch;
      if (x < -pitch || y < -pitch || x > c.w + pitch || y > c.h + pitch) continue;
      const dist =
        v === 'edge'
          ? Math.abs(y - fy * c.h)
          : Math.hypot(
              x - (v === 'centre' ? c.w / 2 : fx * c.w),
              y - (v === 'centre' ? c.h / 2 : fy * c.h),
            );
      const share = 1 - dist / reach;
      if (share <= 0.06) continue;
      const r = pitch * 0.5 * Math.min(1, share * 1.15);
      d += `M${n(x - r)} ${n(y)}a${n(r)} ${n(r)} 0 1 0 ${n(r * 2)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-r * 2)} 0`;
      count += 1;
    }
  return [{ svg: `<path d="${d}" fill="${c.p.a}" fill-opacity="0.6"/>` }];
};

// Blueprint: a drafting grid, minor and major, with a draughtsman's marks in the corners and a title block.
const blueprint: Drawer = (c) => {
  const minor = unit(c) * 1.8;
  const major = minor * 5;
  const id = `${c.uid}-bp`;
  const ink = c.p.dark ? '#ffffff' : c.p.a;
  const grid =
    `<defs><pattern id="${id}-a" width="${n(minor)}" height="${n(minor)}" patternUnits="userSpaceOnUse"><path d="M${n(minor)} 0H0V${n(minor)}" fill="none" stroke="${ink}" stroke-opacity="0.12" stroke-width="0.8"/></pattern>` +
    `<pattern id="${id}-b" width="${n(major)}" height="${n(major)}" patternUnits="userSpaceOnUse"><path d="M${n(major)} 0H0V${n(major)}" fill="none" stroke="${ink}" stroke-opacity="0.28" stroke-width="1.2"/></pattern></defs>` +
    pageRect(c, `fill="url(#${id}-a)"`) +
    pageRect(c, `fill="url(#${id}-b)"`);
  if (c.t.variant === 'grid') return [{ svg: grid }];
  const u = unit(c);
  const m = u * 4;
  const r = u * 6;
  const marks =
    // A circle with cross hairs in the top right, a dimension line along the bottom, a title block in its corner.
    `<g fill="none" stroke="${ink}" stroke-opacity="0.55" stroke-width="1.2">` +
    `<circle cx="${n(c.w - m - r)}" cy="${n(m + r)}" r="${n(r)}"/><circle cx="${n(c.w - m - r)}" cy="${n(m + r)}" r="${n(r * 0.45)}" stroke-dasharray="4 3"/>` +
    `<path d="M${n(c.w - m - r * 2.4)} ${n(m + r)}H${n(c.w - m + r * 0.4)}M${n(c.w - m - r)} ${n(m - r * 0.4)}V${n(m + r * 2.4)}"/>` +
    `<path d="M${n(m)} ${n(c.h - m * 0.6)}H${n(c.w * 0.45)}M${n(m)} ${n(c.h - m * 0.6 - u)}v${n(u * 2)}M${n(c.w * 0.45)} ${n(c.h - m * 0.6 - u)}v${n(u * 2)}"/>` +
    `<rect x="${n(c.w - m - u * 30)}" y="${n(c.h - m - u * 9)}" width="${n(u * 30)}" height="${n(u * 9)}"/>` +
    `<path d="M${n(c.w - m - u * 30)} ${n(c.h - m - u * 4.5)}H${n(c.w - m)}M${n(c.w - m - u * 12)} ${n(c.h - m - u * 9)}V${n(c.h - m)}"/>` +
    `<path d="M${n(m)} ${n(m)}l${n(u * 5)} 0M${n(m)} ${n(m)}l0 ${n(u * 5)}"/></g>`;
  const glow = `${c.uid}-bpg`;
  return [
    {
      svg:
        `<defs>${glowDef(glow, ink, 0.12, 0.9)}</defs>` +
        `<circle cx="${n(c.w / 2)}" cy="${n(c.h / 2)}" r="${n(Math.max(c.w, c.h) * 0.6)}" fill="url(#${glow})"/>` +
        grid +
        marks,
    },
  ];
};

// The most chips Terrazzo scatters: a small scale makes them smaller and more of them, up to this.
const TERRAZZO_CHIPS_MAX = 420;

// Terrazzo: chips of stone in the palette and the ink scattered over the page, more of them toward the edges, each a
// small irregular polygon; one path per colour, so hundreds of chips are four nodes.
const terrazzo: Drawer = (c) => {
  const u = unit(c);
  const count = Math.min(TERRAZZO_CHIPS_MAX, Math.round(170 / (c.t.scale * c.t.scale)));
  const colours = [c.p.a, c.p.b, c.p.c, c.p.ink];
  const paths = ['', '', '', ''];
  let placed = 0;
  // Rejection sampling: a chip in the middle is kept less often than one at an edge.
  for (let tries = 0; placed < count && tries < count * 4; tries += 1) {
    const x = c.rnd() * c.w;
    const y = c.rnd() * c.h;
    const edge = Math.max(Math.abs(x / c.w - 0.5), Math.abs(y / c.h - 0.5)) * 2;
    if (c.rnd() > 0.25 + edge * 0.75) continue;
    const size = u * between(c.rnd, 0.9, placed % 8 === 0 ? 4.2 : 2.2);
    const corners = 4 + Math.floor(c.rnd() * 3);
    const spin = c.rnd() * Math.PI * 2;
    let d = '';
    for (let k = 0; k < corners; k += 1) {
      const a = spin + (k / corners) * Math.PI * 2;
      const r = size * between(c.rnd, 0.55, 1);
      d += `${k ? 'L' : 'M'}${n(x + Math.cos(a) * r)} ${n(y + Math.sin(a) * r)}`;
    }
    const slot = placed % 7 === 6 ? 3 : placed % 3;
    paths[slot] += `${d}Z`;
    placed += 1;
  }
  const opacity = [0.75, 0.7, 0.7, c.p.dark ? 0.35 : 0.25];
  return [
    {
      svg: paths
        .map((d, i) =>
          d ? `<path d="${d}" fill="${colours[i]}" fill-opacity="${opacity[i]}"/>` : '',
        )
        .join(''),
    },
  ];
};

export const TEXTURE_DRAWERS = {
  'paper-grain': paperGrain,
  noise,
  linen,
  risograph,
  halftone,
  blueprint,
  terrazzo,
} as const;
