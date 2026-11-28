// Real 3D's geometry (docs/specs/008-canvas/3d-engine.md "Block models"): boxes and faces gathered into flat arrays
// of positions and colours, shaded as the flat drawings shade (a top lighter, sides darker), with the outline of each
// box kept apart so it can be drawn in the art's outline colour. Pure: no three.js, no DOM.

export type Vec3 = readonly [number, number, number];

/** A colour as 0xrrggbb. */
export type Rgb = number;

/** How each side of a box is lit, as a factor on its colour (the drawings' light comes from above and in front). */
// The scene is lit (Real3DLayer's lights), so faces keep their own colour and the light shades them.
export const SHADE = { top: 1, front: 1, back: 1, side: 1, bottom: 1 } as const;

export function parseColour(c: string): Rgb {
  const s = c.trim();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    const full = h.length === 3 ? h.replace(/./g, (d) => d + d) : h.slice(0, 6);
    return Number.parseInt(full, 16) || 0;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (m) return (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]);
  return 0x888888;
}

export function shade(c: Rgb, f: number): [number, number, number] {
  const ch = (v: number) => Math.max(0, Math.min(1, (v / 255) * f));
  return [ch((c >> 16) & 255), ch((c >> 8) & 255), ch(c & 255)];
}

/** Mixes two colours, `t` of the way to `b`. */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export type BoxSpec = {
  /** The box's near-bottom-left corner and size, in the model's units: x across, y deep (down the canvas), z up. */
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  colour: Rgb;
  /** A different colour for its top (a cushion's seat, a desk's top). */
  top?: Rgb;
  /** A different colour for its front (+y) face (a drawer front, a screen). */
  front?: Rgb;
  /** Drawn see-through (glass). */
  glass?: boolean;
  /** Not outlined (a thin detail). */
  bare?: boolean;
  /** Square edges, never eased (a part that must meet another flush). */
  sharp?: boolean;
};

/** How much of a box's smallest side its eased edges take, and the least and most they ever take, in canvas px. */
const BEVEL_SHARE = 0.18;
const BEVEL_MIN = 0.3;
/** A part thinner than this (a rail, a book's spine, a trim) stays square: its eased edges would not show. */
const BEVEL_FROM = 2.5;
const BEVEL_MAX = 1.6;

export class MeshBuilder {
  readonly positions: number[] = [];
  readonly colours: number[] = [];
  readonly lines: number[] = [];
  readonly glassPositions: number[] = [];
  readonly glassColours: number[] = [];
  /** Each corner's normal (for the lights), alongside `positions` and `glassPositions`. */
  readonly normals: number[] = [];
  readonly glassNormals: number[] = [];
  /** Screens that light while someone sits at them: [from, to) corner ranges of `positions`, two numbers each. */
  readonly glows: number[] = [];

  /**
   * A Poster's picture place (docs/specs/009-elements/poster.md): four corners (bottom left, bottom right, top right,
   * top left as you face it) of an upright rectangle facing +y, twelve numbers, drawn by the 3D layer as a textured
   * quad of its own rather than into this geometry.
   */
  readonly pictures: number[] = [];

  /** Marks an upright picture place from (x0, z0) to (x1, z1) at depth `y`, facing +y. */
  picture(x0: number, y: number, z0: number, x1: number, z1: number): void {
    this.pictures.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
  }

  /** Builds a screen (whatever `draw` adds to `positions`), marked to light while someone sits at it. */
  screen(draw: () => void): void {
    const from = this.positions.length / 3;
    draw();
    this.glows.push(from, this.positions.length / 3);
  }

  /** Stretches everything built so far `k` times taller (z), its normals turned to match. */
  rise(k: number): this {
    for (const arr of [this.positions, this.glassPositions, this.lines, this.pictures])
      for (let i = 2; i < arr.length; i += 3) arr[i]! *= k;
    for (const arr of [this.normals, this.glassNormals])
      for (let i = 0; i < arr.length; i += 3) {
        const z = arr[i + 2]! / k;
        const l = Math.hypot(arr[i]!, arr[i + 1]!, z) || 1;
        arr[i]! /= l;
        arr[i + 1]! /= l;
        arr[i + 2] = z / l;
      }
    return this;
  }

  /** A quad, corners in order round it; lit flat, facing the way its corners wind (counter-clockwise outside). */
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, rgb: [number, number, number], glass = false): void {
    const n = faceNormal(a, b, c[0] === a[0] && c[1] === a[1] && c[2] === a[2] ? d : c);
    this.tri(a, b, c, n, n, n, rgb, glass);
    this.tri(a, c, d, n, n, n, rgb, glass);
  }

  /**
   * A triangle with a normal at each corner (smooth shapes share them across faces). Wound to face its normals, so
   * the lights and the depth agree whichever way it was given.
   */
  tri(
    a: Vec3,
    b: Vec3,
    c: Vec3,
    na: Vec3,
    nb: Vec3,
    nc: Vec3,
    rgb: readonly [number, number, number],
    glass = false,
  ): void {
    const pos = glass ? this.glassPositions : this.positions;
    const col = glass ? this.glassColours : this.colours;
    const nor = glass ? this.glassNormals : this.normals;
    const f = faceNormal(a, b, c);
    const avg = [na[0] + nb[0] + nc[0], na[1] + nb[1] + nc[1], na[2] + nb[2] + nc[2]];
    const flip = f[0] * avg[0]! + f[1] * avg[1]! + f[2] * avg[2]! < 0;
    const vs: [Vec3, Vec3][] = flip
      ? [
          [a, na],
          [c, nc],
          [b, nb],
        ]
      : [
          [a, na],
          [b, nb],
          [c, nc],
        ];
    for (const [v, n] of vs) {
      pos.push(v[0], v[1], v[2]);
      col.push(rgb[0], rgb[1], rgb[2]);
      nor.push(n[0], n[1], n[2]);
    }
  }

  line(a: Vec3, b: Vec3): void {
    this.lines.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  }

  box(b: BoxSpec): void {
    const { x, y, z, w, d, h } = b;
    if (w <= 0 || d <= 0 || h <= 0) return;
    const x1 = x + w;
    const y1 = y + d;
    const z1 = z + h;
    const g = b.glass === true;
    // Every solid box has its edges eased, as real furniture does, so the light catches them (rounded()).
    const ease = Math.min(BEVEL_MAX, BEVEL_SHARE * Math.min(w, d, h));
    if (!g && ease >= BEVEL_MIN && Math.min(w, d, h) >= BEVEL_FROM && b.sharp !== true) {
      this.rounded(x, y, z, x1, y1, z1, b.colour, ease, { top: b.top, front: b.front });
      return;
    }
    const top = shade(b.top ?? b.colour, SHADE.top);
    const front = shade(b.front ?? b.colour, SHADE.front);
    const back = shade(b.colour, SHADE.back);
    const side = shade(b.colour, SHADE.side);
    const bottom = shade(b.colour, SHADE.bottom);
    this.quad([x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1], top, g);
    this.quad([x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1], front, g);
    this.quad([x1, y, z], [x, y, z], [x, y, z1], [x1, y, z1], back, g);
    this.quad([x, y, z], [x, y1, z], [x, y1, z1], [x, y, z1], side, g);
    this.quad([x1, y1, z], [x1, y, z], [x1, y, z1], [x1, y1, z1], side, g);
    this.quad([x, y, z], [x1, y, z], [x1, y1, z], [x, y1, z], bottom, g);
    if (b.bare) return;
    const c: Vec3[] = [
      [x, y, z],
      [x1, y, z],
      [x1, y1, z],
      [x, y1, z],
      [x, y, z1],
      [x1, y, z1],
      [x1, y1, z1],
      [x, y1, z1],
    ];
    for (const [p, q] of [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ] as const)
      this.line(c[p]!, c[q]!);
  }

  /** A flat shape lying on (or over) the floor: a polygon fan at height z. */
  flat(
    points: readonly { x: number; y: number }[],
    z: number,
    colour: Rgb,
    f: number = SHADE.top,
  ): void {
    const rgb = shade(colour, f);
    for (let i = 1; i + 1 < points.length; i++) {
      const p0 = points[0]!;
      const p1 = points[i]!;
      const p2 = points[i + 1]!;
      const up: Vec3 = [0, 0, 1];
      this.tri([p0.x, p0.y, z], [p1.x, p1.y, z], [p2.x, p2.y, z], up, up, up, rgb);
    }
  }

  /** A wall-like slab from a to b on the floor, `t` thick, from z0 up to z1. */
  slab(
    a: { x: number; y: number },
    b: { x: number; y: number },
    t: number,
    z0: number,
    z1: number,
    colour: Rgb,
    opts: { top?: Rgb; glass?: boolean; bare?: boolean } = {},
  ): void {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 0.01 || z1 <= z0) return;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const nx = -uy * (t / 2);
    const ny = ux * (t / 2);
    const p = [
      [a.x + nx, a.y + ny],
      [b.x + nx, b.y + ny],
      [b.x - nx, b.y - ny],
      [a.x - nx, a.y - ny],
    ] as const;
    const g = opts.glass === true;
    const top = shade(opts.top ?? colour, SHADE.top);
    const face = shade(colour, 1);
    const v = (i: number, z: number): Vec3 => [p[i]![0], p[i]![1], z];
    this.quad(v(0, z1), v(1, z1), v(2, z1), v(3, z1), top, g);
    const sides: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ];
    for (const [i, j] of sides) this.quad(v(i, z0), v(j, z0), v(j, z1), v(i, z1), face, g);
    if (opts.bare) return;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.line(v(i, z1), v(j, z1));
      this.line(v(i, z0), v(i, z1));
    }
  }

  /**
   * A round post, drum, cone or bowl standing upright: from radius `r0` at `z0` to `r1` at `z1`, about (cx, cy),
   * smooth round its side, with flat caps (the top in `top`, if given). `rx`/`ry` scale it into an oval.
   */
  cylinder(
    cx: number,
    cy: number,
    z0: number,
    z1: number,
    r0: number,
    r1: number,
    colour: Rgb,
    o: {
      top?: Rgb;
      segments?: number;
      glass?: boolean;
      caps?: boolean;
      sx?: number;
      sy?: number;
    } = {},
  ): void {
    const n = o.segments ?? 20;
    const sx = o.sx ?? 1;
    const sy = o.sy ?? 1;
    const side = shade(colour, 1);
    const g = o.glass === true;
    const slope = (r0 - r1) / Math.max(1e-6, z1 - z0);
    const ring = (i: number) => {
      const t = (i / n) * Math.PI * 2;
      return [Math.cos(t), Math.sin(t)] as const;
    };
    for (let i = 0; i < n; i++) {
      const [c0, s0] = ring(i);
      const [c1, s1] = ring(i + 1);
      const n0 = norm([c0 / sx, s0 / sy, slope]);
      const n1 = norm([c1 / sx, s1 / sy, slope]);
      const a: Vec3 = [cx + c0 * r0 * sx, cy + s0 * r0 * sy, z0];
      const b: Vec3 = [cx + c1 * r0 * sx, cy + s1 * r0 * sy, z0];
      const c: Vec3 = [cx + c1 * r1 * sx, cy + s1 * r1 * sy, z1];
      const d: Vec3 = [cx + c0 * r1 * sx, cy + s0 * r1 * sy, z1];
      if (r0 > 0) this.tri(a, b, c, n0, n1, n1, side, g);
      if (r1 > 0) this.tri(a, c, d, n0, n1, n0, side, g);
      else this.tri(a, b, c, n0, n1, n1, side, g);
      if (o.caps !== false) {
        const up: Vec3 = [0, 0, 1];
        const down: Vec3 = [0, 0, -1];
        if (r1 > 0) this.tri([cx, cy, z1], d, c, up, up, up, shade(o.top ?? colour, 1), g);
        if (r0 > 0) this.tri([cx, cy, z0], b, a, down, down, down, side, g);
      }
    }
  }

  /**
   * A turned shape about an upright axis at (cx, cy): `profile` gives its radius at each height, bottom to top
   * (a vase, a fountain's bowl, a lampshade, a tree's crown), smooth round and along its side.
   */
  lathe(
    cx: number,
    cy: number,
    profile: readonly { r: number; z: number }[],
    colour: Rgb,
    o: {
      segments?: number;
      glass?: boolean;
      sx?: number;
      sy?: number;
      colours?: readonly Rgb[];
    } = {},
  ): void {
    const n = o.segments ?? 20;
    const sx = o.sx ?? 1;
    const sy = o.sy ?? 1;
    const g = o.glass === true;
    // Each profile point's normal in (r, z): across its neighbours' slope.
    const pn = profile.map((_, k) => {
      const a = profile[Math.max(0, k - 1)]!;
      const b = profile[Math.min(profile.length - 1, k + 1)]!;
      const dr = b.r - a.r;
      const dz = b.z - a.z;
      const l = Math.hypot(dr, dz) || 1;
      return [dz / l, -dr / l] as const;
    });
    for (let k = 0; k + 1 < profile.length; k++) {
      const p0 = profile[k]!;
      const p1 = profile[k + 1]!;
      const rgb = shade(o.colours?.[k] ?? colour, 1);
      for (let i = 0; i < n; i++) {
        const t0 = (i / n) * Math.PI * 2;
        const t1 = ((i + 1) / n) * Math.PI * 2;
        const v = (p: { r: number; z: number }, t: number): Vec3 => [
          cx + Math.cos(t) * p.r * sx,
          cy + Math.sin(t) * p.r * sy,
          p.z,
        ];
        const nv = (q: readonly [number, number], t: number): Vec3 =>
          norm([(Math.cos(t) * q[0]) / sx, (Math.sin(t) * q[0]) / sy, q[1]]);
        const a = v(p0, t0);
        const b = v(p0, t1);
        const c = v(p1, t1);
        const d = v(p1, t0);
        const na = nv(pn[k]!, t0);
        const nb = nv(pn[k]!, t1);
        const nc = nv(pn[k + 1]!, t1);
        const nd = nv(pn[k + 1]!, t0);
        if (p0.r > 0.001) this.tri(a, b, c, na, nb, nc, rgb, g);
        if (p1.r > 0.001) this.tri(a, c, d, na, nc, nd, rgb, g);
        else if (p0.r > 0.001) this.tri(a, b, c, na, nb, nc, rgb, g);
      }
    }
  }

  /** A ball or egg at (cx, cy, cz), radii rx, ry, rz; `from`/`to` (0 bottom to 1 top) keep only a band of it. */
  sphere(
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    colour: Rgb,
    o: { segments?: number; rings?: number; from?: number; to?: number; glass?: boolean } = {},
  ): void {
    const rings = o.rings ?? 12;
    const from = o.from ?? 0;
    const to = o.to ?? 1;
    const profile: { r: number; z: number }[] = [];
    for (let k = 0; k <= rings; k++) {
      const u = from + ((to - from) * k) / rings;
      const phi = -Math.PI / 2 + u * Math.PI;
      profile.push({ r: Math.max(0, Math.cos(phi)), z: cz + Math.sin(phi) * rz });
    }
    this.lathe(cx, cy, profile, colour, {
      segments: o.segments ?? 20,
      sx: rx,
      sy: ry,
      glass: o.glass,
    });
    if (to < 1) {
      const top = profile[profile.length - 1]!;
      if (top.r > 0.01)
        this.cylinder(cx, cy, top.z - 0.01, top.z, top.r, top.r, colour, {
          sx: rx,
          sy: ry,
          segments: o.segments ?? 20,
        });
    }
  }

  /** A round rod from a to b, radius r (a bike's frame, a rail, a log, a lamp's stem), smooth round, capped. */
  tube(
    a: Vec3,
    b: Vec3,
    r: number,
    colour: Rgb,
    o: { segments?: number; glass?: boolean; r1?: number } = {},
  ): void {
    const n = o.segments ?? 10;
    const axis = sub(b, a);
    const len = Math.hypot(axis[0], axis[1], axis[2]);
    if (len < 1e-6) return;
    const w = norm(axis);
    const helper: Vec3 = Math.abs(w[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const u = norm(cross(helper, w));
    const v = cross(w, u);
    const rgb = shade(colour, 1);
    const g = o.glass === true;
    const r1 = o.r1 ?? r;
    const at = (base: Vec3, rad: number, t: number): Vec3 => [
      base[0] + (u[0] * Math.cos(t) + v[0] * Math.sin(t)) * rad,
      base[1] + (u[1] * Math.cos(t) + v[1] * Math.sin(t)) * rad,
      base[2] + (u[2] * Math.cos(t) + v[2] * Math.sin(t)) * rad,
    ];
    const nAt = (t: number): Vec3 => [
      u[0] * Math.cos(t) + v[0] * Math.sin(t),
      u[1] * Math.cos(t) + v[1] * Math.sin(t),
      u[2] * Math.cos(t) + v[2] * Math.sin(t),
    ];
    const back: Vec3 = [-w[0], -w[1], -w[2]];
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * Math.PI * 2;
      const t1 = ((i + 1) / n) * Math.PI * 2;
      const p0 = at(a, r, t0);
      const p1 = at(a, r, t1);
      const q1 = at(b, r1, t1);
      const q0 = at(b, r1, t0);
      this.tri(p0, p1, q1, nAt(t0), nAt(t1), nAt(t1), rgb, g);
      this.tri(p0, q1, q0, nAt(t0), nAt(t1), nAt(t0), rgb, g);
      this.tri(a, p1, p0, back, back, back, rgb, g);
      this.tri(b, q0, q1, w, w, w, rgb, g);
    }
  }

  /**
   * A box with its edges bevelled by `bevel` (a cushion, a cabinet, a car's body): the six faces inset, a slanted
   * strip along each edge and a corner at each corner, so light catches its edges as it catches real furniture.
   */
  rounded(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    colour: Rgb,
    bevel: number,
    o: { top?: Rgb; front?: Rgb; glass?: boolean } = {},
  ): void {
    const e = Math.max(0, Math.min(bevel, (x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2));
    if (e <= 0.01) {
      this.box({
        x: x0,
        y: y0,
        z: z0,
        w: x1 - x0,
        d: y1 - y0,
        h: z1 - z0,
        colour,
        top: o.top,
        front: o.front,
        glass: o.glass,
        bare: true,
        sharp: true,
      });
      return;
    }
    const g = o.glass === true;
    const c = shade(colour, 1);
    const top = shade(o.top ?? colour, 1);
    const front = shade(o.front ?? colour, 1);
    // The surface point of the bevelled box in direction (sx, sy, sz), each -1, 0 or 1.
    const P = (sx: number, sy: number, sz: number, ex: number, ey: number, ez: number): Vec3 => [
      sx < 0 ? x0 + ex : x1 - ex,
      sy < 0 ? y0 + ey : y1 - ey,
      sz < 0 ? z0 + ez : z1 - ez,
    ];
    // Faces: each axis-aligned face inset by e on its other axes.
    const face = (axis: 0 | 1 | 2, sgn: -1 | 1, rgb: [number, number, number]) => {
      const n: Vec3 = [axis === 0 ? sgn : 0, axis === 1 ? sgn : 0, axis === 2 ? sgn : 0];
      const corner = (s1: number, s2: number): Vec3 => {
        const s = [0, 0, 0];
        const ex = [e, e, e];
        s[axis] = sgn;
        ex[axis] = 0;
        const others = [0, 1, 2].filter((k) => k !== axis);
        s[others[0]!] = s1;
        s[others[1]!] = s2;
        return P(s[0]!, s[1]!, s[2]!, ex[0]!, ex[1]!, ex[2]!);
      };
      this.tri(corner(-1, -1), corner(1, -1), corner(1, 1), n, n, n, rgb, g);
      this.tri(corner(-1, -1), corner(1, 1), corner(-1, 1), n, n, n, rgb, g);
    };
    face(2, 1, top);
    face(2, -1, c);
    face(1, 1, front);
    face(1, -1, c);
    face(0, 1, c);
    face(0, -1, c);
    // Edges: along each axis, at each of its four corners, a strip between the two faces' inset edges.
    for (const axis of [0, 1, 2] as const) {
      const [a1, a2] = [0, 1, 2].filter((k) => k !== axis) as [number, number];
      for (const s1 of [-1, 1])
        for (const s2 of [-1, 1]) {
          const end = (sa: number, inner: 1 | 2): Vec3 => {
            const s = [0, 0, 0];
            const ex = [e, e, e];
            s[axis] = sa;
            s[a1] = s1;
            s[a2] = s2;
            // On face a1: inset along a2; on face a2: inset along a1.
            if (inner === 1) ex[a1] = 0;
            else ex[a2] = 0;
            return P(s[0]!, s[1]!, s[2]!, ex[0]!, ex[1]!, ex[2]!);
          };
          const v1 = [0, 0, 0];
          v1[a1] = s1;
          const v2 = [0, 0, 0];
          v2[a2] = s2;
          const n1: Vec3 = [v1[0]!, v1[1]!, v1[2]!];
          const n2: Vec3 = [v2[0]!, v2[1]!, v2[2]!];
          const rgb = a1 === 2 && s1 > 0 ? top : a2 === 2 && s2 > 0 ? top : c;
          this.tri(end(-1, 1), end(1, 1), end(1, 2), n1, n1, n2, rgb, g);
          this.tri(end(-1, 1), end(1, 2), end(-1, 2), n1, n2, n2, rgb, g);
        }
    }
    // Corners: a triangle joining the three edges at each corner.
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) {
          const a = P(sx, sy, sz, 0, e, e);
          const b = P(sx, sy, sz, e, 0, e);
          const d = P(sx, sy, sz, e, e, 0);
          this.tri(a, b, d, [sx, 0, 0], [0, sy, 0], [0, 0, sz], sz > 0 ? top : c, g);
        }
  }
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function norm(v: readonly number[]): Vec3 {
  const l = Math.hypot(v[0]!, v[1]!, v[2]!) || 1;
  return [v[0]! / l, v[1]! / l, v[2]! / l];
}

/** The normal a triangle's corners wind round (counter-clockwise seen from where it points). */
export function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  return norm(cross(sub(b, a), sub(c, a)));
}
