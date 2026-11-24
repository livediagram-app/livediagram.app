// The Organic family (docs/specs/011-theme/page-designs.md "The catalogue"): blobs, waves, contour lines, ribbons and
// marbling, drawn from smooth curves. The ones that flow are worked out along the strip, so they run on from page to
// page. Pure.
import {
  between,
  blobPath,
  glowDef,
  linearDef,
  n,
  smoothClosed,
  smoothOpen,
  trio,
  unit,
  type DesignLayer,
  type Drawer,
} from './draw-kit';

// Blobs: soft-edged organic shapes along the page's edges (or scattered), each its own layer so each can float.
const blobs: Drawer = (c) => {
  const { a, b } = c.p;
  const colours = trio(c);
  const max = Math.max(c.w, c.h);
  const scatter = c.t.variant === 'scatter';
  const count = scatter ? 6 : Math.max(3, Math.round((c.span / c.w) * 2) + 1);
  const all = Array.from({ length: count }, (_, i) => {
    const r = (scatter ? between(c.rnd, 0.1, 0.18) : between(c.rnd, 0.24, 0.34)) * max * c.t.scale;
    const x = scatter
      ? between(c.rnd, 0, c.span)
      : (i / (count - 1)) * c.span + between(c.rnd, -0.06, 0.06) * c.w;
    const y = scatter ? between(c.rnd, 0, c.h) : i % 2 ? c.h + r * 0.15 : -r * 0.15;
    const d = blobPath(c.rnd, x - c.ox, y, r, 0.4, 8);
    return { x, y, r, d, colour: colours[i % 3]! };
  });
  const mine = all.filter((bl) => bl.x + bl.r * 1.3 > c.ox && bl.x - bl.r * 1.3 < c.ox + c.w);
  return mine.map((bl, i): DesignLayer => {
    const id = `${c.uid}-b${i}`;
    const cx = bl.x - c.ox;
    // Blur: a larger, fainter copy of the blob behind it, so its edge seems to soften into the page.
    const halo =
      c.t.blur > 0.05
        ? `<path d="${bl.d}" fill="${bl.colour}" fill-opacity="${n(0.22 * c.t.blur)}" ` +
          `transform="translate(${n(cx)} ${n(bl.y)}) scale(${n(1 + 0.18 * c.t.blur)}) translate(${n(-cx)} ${n(-bl.y)})"/>`
        : '';
    return {
      svg:
        `<defs>${linearDef(
          id,
          [
            [0, bl.colour, 0.85],
            [1, i % 2 ? a : b, 0.55],
          ],
          135 + i * 40,
        )}</defs>` +
        halo +
        `<path d="${bl.d}" fill="url(#${id})"/>`,
      motion: {
        kind: i % 2 ? 'breathe' : 'drift',
        seconds: 20 + i * 5,
        scale: 1.06,
        x: c.w * 0.025,
        y: c.h * 0.03,
        origin: [cx, bl.y],
      },
    };
  });
};

// Waves: three layers rolling along the bottom (or the top, or both), each a repeating swell, so a pan loops seamlessly.
const waves: Drawer = (c) => {
  const colours = trio(c);
  const lambda = c.w * 0.62 * c.t.scale;
  const sets: ('bottom' | 'top')[] =
    c.t.variant === 'both' ? ['bottom', 'top'] : [c.t.variant === 'top' ? 'top' : 'bottom'];
  const layers: DesignLayer[] = [];
  for (const side of sets) {
    const rows = side === 'top' && sets.length > 1 ? 2 : 3;
    for (let i = 0; i < rows; i += 1) {
      const depth = c.h * (0.3 - i * 0.07) * (sets.length > 1 ? 0.75 : 1);
      const amp = c.h * (0.035 + i * 0.012) * c.t.scale;
      const phase = between(c.rnd, 0, Math.PI * 2);
      const pts: [number, number][] = [];
      const steps = 16;
      const reach = c.w + lambda;
      for (let k = 0; k <= Math.ceil((reach / lambda) * steps); k += 1) {
        const x = (k * lambda) / steps;
        const wx = ((x + c.ox) / lambda) * Math.PI * 2;
        const dy = Math.sin(wx + phase) * amp + Math.sin(wx * 2 + phase * 1.7) * amp * 0.35;
        pts.push([x, side === 'bottom' ? c.h - depth + dy : depth + dy]);
      }
      const last = pts[pts.length - 1]![0];
      const edge = side === 'bottom' ? c.h + 2 : -2;
      const d = `${smoothOpen(pts)}L${n(last)} ${n(edge)}L0 ${n(edge)}Z`;
      layers.push({
        svg: `<path d="${d}" fill="${colours[(i + (side === 'top' ? 1 : 0)) % 3]}" fill-opacity="${n(0.32 + i * 0.2)}"/>`,
        motion: { kind: 'pan', seconds: 14 + (rows - i) * 6, x: -lambda },
      });
    }
  }
  return layers;
};

// Topographic: contour rings around a few summits along the strip, each kept clear of its neighbours', every fifth an
// index line in the accent.
const topographic: Drawer = (c) => {
  const step = unit(c) * (c.t.variant === 'bold' ? 3.8 : 2.6);
  const count = Math.max(3, Math.round((c.span / c.w) * 3));
  const peaks = Array.from({ length: count }, (_, i) => ({
    x: ((i + between(c.rnd, 0.15, 0.85)) / count) * c.span,
    y: between(c.rnd, 0.1, 0.9) * c.h,
    phase: [between(c.rnd, 0, 6), between(c.rnd, 0, 6), between(c.rnd, 0, 6)],
  }));
  const lines: string[] = [];
  const index: string[] = [];
  peaks.forEach((pk, i) => {
    const near = Math.min(
      ...peaks.filter((_, j) => j !== i).map((q) => Math.hypot(q.x - pk.x, q.y - pk.y)),
    );
    const cap = Math.min(near * 0.55, Math.max(c.w, c.h) * 0.6);
    if (pk.x + cap < c.ox || pk.x - cap > c.ox + c.w) return;
    const rings = Math.max(1, Math.floor(cap / step));
    for (let k = 1; k <= rings; k += 1) {
      const rk = k * step;
      const pts: [number, number][] = [];
      for (let s = 0; s < 36; s += 1) {
        const th = (s / 36) * Math.PI * 2;
        const wob =
          1 +
          0.16 * Math.sin(3 * th + pk.phase[0]! + k * 0.12) +
          0.09 * Math.sin(5 * th + pk.phase[1]! - k * 0.08) +
          0.05 * Math.sin(7 * th + pk.phase[2]!);
        pts.push([pk.x - c.ox + Math.cos(th) * rk * wob, pk.y + Math.sin(th) * rk * wob * 0.8]);
      }
      (k % 5 === 0 ? index : lines).push(smoothClosed(pts));
    }
  });
  return [
    {
      svg:
        `<path d="${lines.join('')}" fill="none" stroke="${c.p.ink}" stroke-opacity="0.2" stroke-width="1"/>` +
        `<path d="${index.join('')}" fill="none" stroke="${c.p.a}" stroke-opacity="0.55" stroke-width="1.6"/>`,
    },
  ];
};

// Flowing Ribbons: wide bands of colour weaving across the page at the angle, fine strands of light along them.
const ribbons: Drawer = (c) => {
  const colours = trio(c);
  const turn = `rotate(${n(c.t.angle)} ${n(c.w / 2)} ${n(c.h / 2)})`;
  const reachL = -c.w * 0.35;
  const reachR = c.w * 1.35;
  const wave = c.w * 0.55 * c.t.scale;
  return [0, 1, 2].map((i) => {
    const base = c.h * (0.62 + i * 0.13);
    const thick = c.h * (0.09 - i * 0.015) * c.t.scale;
    const phase = between(c.rnd, 0, Math.PI * 2);
    const amp = c.h * between(c.rnd, 0.1, 0.18);
    const top: [number, number][] = [];
    const bottom: [number, number][] = [];
    const strands: [number, number][][] = [[], [], []];
    for (let x = reachL; x <= reachR; x += c.w / 10) {
      const wx = (x + c.ox) / wave;
      const mid = base + Math.sin(wx + phase) * amp;
      const t = thick * (0.55 + 0.45 * Math.sin(wx * 0.7 + phase * 2));
      top.push([x, mid - t]);
      bottom.push([x, mid + t]);
      strands.forEach((s, k) => s.push([x, mid + (k - 1) * t * 0.6]));
    }
    const id = `${c.uid}-rb${i}`;
    const back = [...bottom].reverse();
    const body = `${smoothOpen(top)}L${n(back[0]![0])} ${n(back[0]![1])}${smoothOpen(back).replace(/^M[^C]*/, '')}Z`;
    return {
      svg:
        `<defs>${linearDef(
          id,
          [
            [0, colours[i]!, 0.15],
            [0.5, colours[(i + 1) % 3]!, 0.6],
            [1, colours[(i + 2) % 3]!, 0.2],
          ],
          90,
        )}</defs>` +
        `<g transform="${turn}"><path d="${body}" fill="url(#${id})"/>` +
        `<path d="${strands.map((s) => smoothOpen(s)).join('')}" fill="none" stroke="#ffffff" stroke-opacity="${c.p.dark ? 0.22 : 0.45}" stroke-width="1"/></g>`,
      motion: { kind: 'drift', seconds: 22 + i * 6, x: 0, y: c.h * (i % 2 ? -0.035 : 0.035) },
    };
  });
};

// Marbled: veins of colour swirling through a soft wash, each following one flow field.
const marbled: Drawer = (c) => {
  const colours = [c.p.a, c.p.b, c.p.c, c.p.ink];
  const s1 = between(c.rnd, 0, 6);
  const s2 = between(c.rnd, 0, 6);
  const k = 0.0042 / c.t.scale;
  const stepLen = unit(c) * 1.4;
  const veins = Array.from({ length: 26 }, (_, i) => {
    let x = between(c.rnd, -0.1, 1.1) * c.w;
    let y = between(c.rnd, -0.1, 1.1) * c.h;
    const pts: [number, number][] = [[x, y]];
    for (let s = 0; s < 70; s += 1) {
      const f = Math.sin(x * k + s1) * 2.2 + Math.cos(y * k * 1.3 + s2) * 2.2;
      x += Math.cos(f) * stepLen;
      y += Math.sin(f) * stepLen;
      if (s % 2) pts.push([x, y]);
    }
    const colour = colours[i % 4]!;
    const width = between(c.rnd, 0.6, i % 5 === 0 ? 4 : 2);
    return `<path d="${smoothOpen(pts)}" fill="none" stroke="${colour}" stroke-opacity="${n(between(c.rnd, 0.18, 0.5))}" stroke-width="${n(width)}" stroke-linecap="round"/>`;
  }).join('');
  const w1 = `${c.uid}-mw1`;
  const w2 = `${c.uid}-mw2`;
  return [
    {
      svg:
        `<defs>${glowDef(w1, c.p.a, 0.35, 0.9)}${glowDef(w2, c.p.b, 0.3, 0.9)}</defs>` +
        `<circle cx="${n(c.w * 0.2)}" cy="${n(c.h * 0.25)}" r="${n(Math.max(c.w, c.h) * 0.6)}" fill="url(#${w1})"/>` +
        `<circle cx="${n(c.w * 0.85)}" cy="${n(c.h * 0.8)}" r="${n(Math.max(c.w, c.h) * 0.55)}" fill="url(#${w2})"/>` +
        veins,
    },
  ];
};

export const ORGANIC_DRAWERS = {
  blobs,
  waves,
  topographic,
  ribbons,
  marbled,
} as const;
