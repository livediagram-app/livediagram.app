// Real 3D's soft rounded slabs (docs/specs/008-canvas/3d-engine.md "No blocky soft goods"): a cushion, a chair's
// back, any upholstered or moulded part that is a rounded rectangle with rolled edges rather than a box. Built along
// any three axes, so it lies flat as a seat or stands tilted as a back, and bends so a back wraps round its sitter.
// Pure: no three.js, no DOM.
import { shade, type Rgb, type Vec3 } from '../mesh-builder';
import type { Builder } from './kit';

/** Where a pillow sits: `o` its back face's middle, `a` and `b` across its face, `c` through it (unit vectors). */
export type PillowFrame = { o: Vec3; a: Vec3; b: Vec3; c: Vec3 };

/** One step of a pillow's edge: how far in from its outline, at how far through it (along `c`). */
export type PillowStep = { inset: number; c: number };

export type PillowOptions = {
  /** Each profile segment's colour (else `colour`). */
  colours?: readonly Rgb[];
  /** The first and last steps' faces (false leaves that face open). */
  startFace?: Rgb | false;
  endFace?: Rgb | false;
  /** How far its ends come forward along `c` (a back wrapping its sitter); 0 is flat. */
  bend?: number;
  /** Segments round each rounded corner. */
  corner?: number;
};

const unit = (v: readonly number[]): Vec3 => {
  const l = Math.hypot(v[0]!, v[1]!, v[2]!) || 1;
  return [v[0]! / l, v[1]! / l, v[2]! / l];
};

/**
 * A rounded rectangle `2hw` by `2hd` (corners of radius `radius`) swept through its thickness along `profile`, each
 * step inset from the outline: a rolled cushion when the steps ease in at both faces. Smooth normals all round.
 */
export function pillow(
  m: Builder,
  f: PillowFrame,
  hw: number,
  hd: number,
  radius: number,
  profile: readonly PillowStep[],
  colour: Rgb,
  o: PillowOptions = {},
): void {
  const k = o.corner ?? 4;
  const bend = o.bend ?? 0;
  // The outline's points round the four corners, each with its outward direction in (a, b).
  const ring: { ca: number; cb: number; ux: number; uy: number }[] = [];
  for (const [sa, sb, a0] of [
    [1, 1, 0],
    [-1, 1, Math.PI / 2],
    [-1, -1, Math.PI],
    [1, -1, (3 * Math.PI) / 2],
  ] as const)
    for (let i = 0; i <= k; i++) {
      const t = a0 + (i / k) * (Math.PI / 2);
      ring.push({ ca: sa, cb: sb, ux: Math.cos(t), uy: Math.sin(t) });
    }
  const along = (s: PillowStep) => {
    const r = Math.max(0.05, radius - s.inset);
    return { r, ha: hw - s.inset - r, hb: hd - s.inset - r };
  };
  const world = (pa: number, pb: number, pc: number): Vec3 => [
    f.o[0] + f.a[0] * pa + f.b[0] * pb + f.c[0] * pc,
    f.o[1] + f.a[1] * pa + f.b[1] * pb + f.c[1] * pc,
    f.o[2] + f.a[2] * pa + f.b[2] * pb + f.c[2] * pc,
  ];
  const toWorld = (n: readonly number[]): Vec3 =>
    unit([
      f.a[0] * n[0]! + f.b[0] * n[1]! + f.c[0] * n[2]!,
      f.a[1] * n[0]! + f.b[1] * n[1]! + f.c[1] * n[2]!,
      f.a[2] * n[0]! + f.b[2] * n[1]! + f.c[2] * n[2]!,
    ]);
  // Each step's normal in (outward, through): across its neighbours' slope, as a lathe's.
  const pn = profile.map((_, i) => {
    const p = profile[Math.max(0, i - 1)]!;
    const q = profile[Math.min(profile.length - 1, i + 1)]!;
    const dr = -(q.inset - p.inset);
    const dc = q.c - p.c;
    const l = Math.hypot(dr, dc) || 1;
    return [dc / l, -dr / l] as const;
  });
  const point = (s: PillowStep, j: number): { p: Vec3; pa: number; pb: number } => {
    const g = along(s);
    const q = ring[j]!;
    const pa = q.ca * g.ha + q.ux * g.r;
    const pb = q.cb * g.hb + q.uy * g.r;
    return { p: world(pa, pb, s.c + bend * (pa / hw) ** 2), pa, pb };
  };
  const normal = (i: number, j: number, pa: number): Vec3 => {
    const q = ring[j]!;
    const [h, v] = pn[i]!;
    // The bend tips the face's normal along a.
    const slope = (2 * bend * pa) / (hw * hw);
    return toWorld([q.ux * h - v * slope, q.uy * h, v]);
  };
  const n = ring.length;
  // Every step's points and normals once, then joined step to step.
  const pts = profile.map((step) => Array.from({ length: n }, (_, j) => point(step, j)));
  const nms = pts.map((row, i) => row.map((q, j) => normal(i, j, q.pa)));
  for (let i = 0; i + 1 < profile.length; i++) {
    const rgb = shade(o.colours?.[i] ?? colour, 1);
    const p0 = pts[i]!;
    const p1 = pts[i + 1]!;
    const n0 = nms[i]!;
    const n1 = nms[i + 1]!;
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      m.tri(p0[j]!.p, p0[k]!.p, p1[k]!.p, n0[j]!, n0[k]!, n1[k]!, rgb);
      m.tri(p0[j]!.p, p1[k]!.p, p1[j]!.p, n0[j]!, n1[k]!, n1[j]!, rgb);
    }
  }
  // The faces: a fan from the middle of the first and the last steps.
  const face = (i: number, rgb: Rgb, out: 1 | -1) => {
    const mid = world(0, 0, profile[i]!.c);
    const fill = shade(rgb, 1);
    const nn = (pa: number) => toWorld([(-2 * bend * pa * out) / (hw * hw), 0, out]);
    const row = pts[i]!;
    const ns = row.map((q) => nn(q.pa));
    const n0 = nn(0);
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      m.tri(mid, row[j]!.p, row[k]!.p, n0, ns[j]!, ns[k]!, fill);
    }
  };
  if (o.startFace !== false && profile.length > 0)
    face(0, o.startFace ?? o.colours?.[0] ?? colour, -1);
  if (o.endFace !== false && profile.length > 0)
    face(profile.length - 1, o.endFace ?? o.colours?.[profile.length - 2] ?? colour, 1);
}
