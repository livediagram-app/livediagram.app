// Risograph's variations in the Texture family (docs/specs/011-theme/page-designs.md "The twelve added on
// 2026-11-25"): flat overprinted inks, a dot screen fading across the page, and line screens. Each is printed out of
// register and under a print's grain, as Risograph is; the grain is a turbulence filter on a still layer only, drawn
// once into the cached markup. Pure.
import { between, grainSvg, n, unit, type DrawCtx, type Drawer } from './draw-kit';

// Inks multiply on paper and glow on a dark page, as two plates of ink would.
const blendOf = (c: DrawCtx) => (c.p.dark ? 'screen' : 'multiply');

// Riso Overprint: three flat inks (no screen) printed over each other: a cluster of three discs off the top right
// corner, overlapping so each pair makes a colour of its own, and a bar crossed by a disc at the bottom left; each
// plate a little out of register, with a key ring printed off its mark.
const risoOverprint: Drawer = (c) => {
  const max = Math.max(c.w, c.h) * c.t.scale;
  const off = unit(c) * 1.1;
  const op = 0.8;
  const r = max * between(c.rnd, 0.15, 0.18);
  const ox = c.w - r * 0.7;
  const oy = r * 0.55;
  const spin = between(c.rnd, 0, Math.PI * 2);
  const discs = [c.p.a, c.p.b, c.p.c]
    .map((colour, i) => {
      const a = spin + (i / 3) * Math.PI * 2;
      const x = ox + Math.cos(a) * r * 0.55 + (i - 1) * off;
      const y = oy + Math.sin(a) * r * 0.55 - (i - 1) * off * 0.6;
      return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${colour}" fill-opacity="${op}"/>`;
    })
    .join('');
  // A thick bar across the bottom left corner, turned, and a disc in the third ink over its end.
  const bx = between(c.rnd, 0.02, 0.12) * c.w;
  const by = c.h - max * 0.1;
  const bw = max * between(c.rnd, 0.4, 0.48);
  const bh = max * 0.09;
  const turn = between(c.rnd, -14, -6);
  const bar = `<rect x="${n(bx - bw * 0.3 + off)}" y="${n(by + off)}" width="${n(bw)}" height="${n(bh)}" fill="${c.p.b}" fill-opacity="${op}" transform="rotate(${n(turn)} ${n(bx)} ${n(by)})"/>`;
  const dr = max * between(c.rnd, 0.08, 0.1);
  const disc = `<circle cx="${n(bx + bw * 0.42 - off)}" cy="${n(c.h - dr * 0.45)}" r="${n(dr)}" fill="${c.p.a}" fill-opacity="${op}"/>`;
  const key = `<circle cx="${n(ox + off * 2)}" cy="${n(oy + off * 2)}" r="${n(r * 1.55)}" fill="none" stroke="${c.p.c}" stroke-opacity="0.7" stroke-width="${n(unit(c) * 0.45)}"/>`;
  return [
    {
      svg:
        `<g style="mix-blend-mode:${blendOf(c)}">${discs}${bar}${disc}${key}</g>` +
        grainSvg(`${c.uid}-rog`, c.w, c.h, c.p.ink, 0.38, c.t.seed, 0.9),
    },
  ];
};

// The most dots a plate of Riso Fade draws: its pitch widens on a big page or at a small scale to stay under it.
const FADE_DOTS_MAX = 1100;

// One plate of Riso Fade: dots on a screen turned by `screen` degrees, swelling toward one side of the page along the
// angle (`side` 1 or -1) and gone by the middle.
function fadePlate(c: DrawCtx, colour: string, screen: number, side: 1 | -1, pitch: number) {
  const fade = (c.t.angle * Math.PI) / 180;
  const fx = Math.cos(fade);
  const fy = Math.sin(fade);
  const half = (Math.abs(fx) * c.w + Math.abs(fy) * c.h) / 2;
  const s = (screen * Math.PI) / 180;
  const cos = Math.cos(s);
  const sin = Math.sin(s);
  const reach = Math.ceil(Math.hypot(c.w, c.h) / pitch / 2) + 1;
  let d = '';
  let count = 0;
  for (let gy = -reach; gy <= reach && count < FADE_DOTS_MAX; gy += 1)
    for (let gx = -reach; gx <= reach && count < FADE_DOTS_MAX; gx += 1) {
      const x = c.w / 2 + (gx * cos - gy * sin) * pitch;
      const y = c.h / 2 + (gx * sin + gy * cos) * pitch;
      if (x < -pitch || y < -pitch || x > c.w + pitch || y > c.h + pitch) continue;
      // -1 at the far side, 1 at this plate's side.
      const along = (side * ((x - c.w / 2) * fx + (y - c.h / 2) * fy)) / half;
      // Clear of the middle third, where an article's copy runs.
      const share = (along - 0.3) / 0.7;
      if (share <= 0.05) continue;
      const r = pitch * 0.48 * Math.min(1, share * 1.2);
      d += `M${n(x - r)} ${n(y)}a${n(r)} ${n(r)} 0 1 0 ${n(r * 2)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-r * 2)} 0`;
      count += 1;
    }
  return `<path d="${d}" fill="${colour}" fill-opacity="0.78"/>`;
}

// Riso Fade: two inks in a coarse dot screen at the two screen angles riso prints use, each fading in from its own
// side of the page, a hair out of register.
const risoFade: Drawer = (c) => {
  // Half the page's area holds a plate's dots, so the pitch that keeps them under the cap.
  const least = Math.sqrt((c.w * c.h * 0.5) / FADE_DOTS_MAX);
  const pitch = Math.max(6, unit(c) * 2.6, least);
  const off = unit(c) * 0.7;
  return [
    {
      svg:
        `<g style="mix-blend-mode:${blendOf(c)}">` +
        fadePlate(c, c.p.a, 15, -1, pitch) +
        `<g transform="translate(${n(off)} ${n(-off)})">${fadePlate(c, c.p.b, 75, 1, pitch)}</g></g>` +
        grainSvg(`${c.uid}-rfg`, c.w, c.h, c.p.ink, 0.32, c.t.seed, 0.9),
    },
  ];
};

// A line screen: stripes of `colour` at `turn` degrees.
const lineScreen = (id: string, colour: string, pitch: number, turn: number) =>
  `<pattern id="${id}" width="${n(pitch)}" height="${n(pitch)}" patternUnits="userSpaceOnUse" patternTransform="rotate(${turn})">` +
  `<rect width="${n(pitch)}" height="${n(pitch * 0.46)}" fill="${colour}"/></pattern>`;

// Riso Lines: big cut-paper shapes filled with line screens in two inks hatched at crossing angles (a cross-hatch
// where they overlap), a key line printed off its mark.
const risoLines: Drawer = (c) => {
  const max = Math.max(c.w, c.h) * c.t.scale;
  const pitch = Math.max(4, unit(c) * 1.1);
  const off = unit(c) * 1.2;
  const la = `${c.uid}-rla`;
  const lb = `${c.uid}-rlb`;
  // A disc low on the right, an arch standing on the left, and a smaller disc crossing the first in the other ink.
  const dx = between(c.rnd, 0.74, 0.92) * c.w;
  const dy = between(c.rnd, 0.72, 0.95) * c.h;
  const dr = max * between(c.rnd, 0.2, 0.25);
  const aw = max * between(c.rnd, 0.16, 0.2);
  const ax = between(c.rnd, 0.02, 0.12) * c.w;
  const top = between(c.rnd, 0.12, 0.3) * c.h;
  const arch = `M${n(ax)} ${n(c.h + 2)}V${n(top + aw / 2)}A${n(aw / 2)} ${n(aw / 2)} 0 0 1 ${n(ax + aw)} ${n(top + aw / 2)}V${n(c.h + 2)}Z`;
  const sx = dx - dr * 0.7;
  const sy = dy - dr * 0.6;
  const sr = dr * 0.5;
  return [
    {
      svg:
        `<defs>${lineScreen(la, c.p.a, pitch, 35)}${lineScreen(lb, c.p.b, pitch, -35)}</defs>` +
        `<g style="mix-blend-mode:${blendOf(c)}">` +
        `<circle cx="${n(dx)}" cy="${n(dy)}" r="${n(dr)}" fill="url(#${la})" fill-opacity="0.85"/>` +
        `<path d="${arch}" fill="url(#${lb})" fill-opacity="0.85"/>` +
        `<circle cx="${n(sx)}" cy="${n(sy)}" r="${n(sr)}" fill="url(#${lb})" fill-opacity="0.85"/>` +
        `<circle cx="${n(dx + off)}" cy="${n(dy - off)}" r="${n(dr)}" fill="none" stroke="${c.p.c}" stroke-opacity="0.75" stroke-width="${n(unit(c) * 0.5)}"/>` +
        `<path d="${arch}" fill="none" stroke="${c.p.c}" stroke-opacity="0.75" stroke-width="${n(unit(c) * 0.5)}" transform="translate(${n(-off)} ${n(off)})"/>` +
        `</g>` +
        grainSvg(`${c.uid}-rlg`, c.w, c.h, c.p.ink, 0.32, c.t.seed, 0.9),
    },
  ];
};

export const RISO_DRAWERS = {
  'riso-overprint': risoOverprint,
  'riso-fade': risoFade,
  'riso-lines': risoLines,
} as const;
