// SVG path data to polylines (docs/specs/020-import-export/blueprints/whiteboard-import.md "Ink"):
// Whiteboard draws each ink stroke as a filled outline path, so the importer
// needs its points. Curves are sampled at a step in path units; malformed data
// ends the sub-path it is in and keeps what came before.

import type { Point } from './matrix';

export type SubPath = { points: Point[]; closed: boolean };

const MAX_SEGMENTS_PER_CURVE = 256;

// One token: a command letter or a number (SVG's compact forms: `-.5`, `1e-3`, `.5.5`).
const TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const ARITY: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

function tokenise(d: string): string[] {
  const tokens: string[] = [];
  let last = 0;
  for (const m of d.matchAll(TOKEN)) {
    // Anything but separators between tokens is malformed from here on.
    if (/[^\s,]/.test(d.slice(last, m.index))) return tokens.concat('!');
    tokens.push(m[0]);
    last = m.index! + m[0].length;
  }
  if (/[^\s,]/.test(d.slice(last))) tokens.push('!');
  return tokens;
}

const segmentsFor = (length: number, step: number) =>
  Math.max(1, Math.min(MAX_SEGMENTS_PER_CURVE, Math.ceil(length / step)));

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, step: number, out: Point[]) {
  const n = segmentsFor(dist(p0, p1) + dist(p1, p2) + dist(p2, p3), step);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const w0 = u * u * u;
    const w1 = 3 * u * u * t;
    const w2 = 3 * u * t * t;
    const w3 = t * t * t;
    out.push(
      i === n
        ? { ...p3 }
        : {
            x: w0 * p0.x + w1 * p1.x + w2 * p2.x + w3 * p3.x,
            y: w0 * p0.y + w1 * p1.y + w2 * p2.y + w3 * p3.y,
          },
    );
  }
}

function quad(p0: Point, p1: Point, p2: Point, step: number, out: Point[]) {
  cubic(
    p0,
    { x: p0.x + (2 / 3) * (p1.x - p0.x), y: p0.y + (2 / 3) * (p1.y - p0.y) },
    { x: p2.x + (2 / 3) * (p1.x - p2.x), y: p2.y + (2 / 3) * (p1.y - p2.y) },
    p2,
    step,
    out,
  );
}

// Endpoint to centre parameterisation (SVG 1.1 F.6.5), sampled.
function arc(
  p0: Point,
  rxIn: number,
  ryIn: number,
  xRotDeg: number,
  large: boolean,
  sweep: boolean,
  p: Point,
  step: number,
  out: Point[],
) {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0 || (p0.x === p.x && p0.y === p.y)) {
    out.push({ ...p });
    return;
  }
  const phi = (xRotDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (p0.x - p.x) / 2;
  const dy = (p0.y - p.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (coef * rx * y1) / ry;
  const cy1 = (-coef * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (p0.x + p.x) / 2;
  const cy = sin * cx1 + cos * cy1 + (p0.y + p.y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const theta1 = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const n = segmentsFor(Math.abs(delta) * Math.max(rx, ry), step);
  for (let i = 1; i <= n; i++) {
    if (i === n) {
      out.push({ ...p });
      break;
    }
    const t = theta1 + (delta * i) / n;
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    out.push({ x: cos * ex - sin * ey + cx, y: sin * ex + cos * ey + cy });
  }
}

/** Every sub-path of `d` as points, curves sampled about every `step` units. */
export function flattenPath(d: string, step: number): SubPath[] {
  const tokens = tokenise(d);
  const subs: SubPath[] = [];
  let current: SubPath | null = null;
  let pos: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  // The previous curve's second control point, for S and T reflections.
  let lastCubic: Point | null = null;
  let lastQuad: Point | null = null;
  let cmd = '';
  let i = 0;

  const finish = () => {
    if (current && current.points.length > 0) subs.push(current);
    current = null;
  };

  while (i < tokens.length) {
    const token = tokens[i]!;
    if (token === '!') break;
    if (/[a-zA-Z]/.test(token)) {
      cmd = token;
      i += 1;
      if (cmd === 'Z' || cmd === 'z') {
        if (current) (current as SubPath).closed = true;
        pos = { ...start };
        finish();
        lastCubic = lastQuad = null;
        continue;
      }
    } else if (cmd === '' || cmd === 'Z' || cmd === 'z') {
      break;
    }
    const upper = cmd.toUpperCase();
    const arity = ARITY[upper]!;
    const args = tokens.slice(i, i + arity).map(Number);
    if (args.length < arity || args.some((n) => !Number.isFinite(n))) break;
    i += arity;
    const rel = cmd !== upper;
    const at = (x: number, y: number): Point => (rel ? { x: pos.x + x, y: pos.y + y } : { x, y });

    if (upper === 'M') {
      finish();
      pos = at(args[0]!, args[1]!);
      start = { ...pos };
      current = { points: [{ ...pos }], closed: false };
      // Pairs after a move are implicit lines.
      cmd = rel ? 'l' : 'L';
      lastCubic = lastQuad = null;
      continue;
    }
    if (!current) current = { points: [{ ...pos }], closed: false };
    const out = (current as SubPath).points;
    let nextCubic: Point | null = null;
    let nextQuad: Point | null = null;
    switch (upper) {
      case 'L':
        pos = at(args[0]!, args[1]!);
        out.push({ ...pos });
        break;
      case 'H':
        pos = { x: rel ? pos.x + args[0]! : args[0]!, y: pos.y };
        out.push({ ...pos });
        break;
      case 'V':
        pos = { x: pos.x, y: rel ? pos.y + args[0]! : args[0]! };
        out.push({ ...pos });
        break;
      case 'C': {
        const c1 = at(args[0]!, args[1]!);
        const c2 = at(args[2]!, args[3]!);
        const end = at(args[4]!, args[5]!);
        cubic(pos, c1, c2, end, step, out);
        nextCubic = c2;
        pos = end;
        break;
      }
      case 'S': {
        const c1: Point = lastCubic
          ? { x: 2 * pos.x - lastCubic.x, y: 2 * pos.y - lastCubic.y }
          : pos;
        const c2 = at(args[0]!, args[1]!);
        const end = at(args[2]!, args[3]!);
        cubic(pos, c1, c2, end, step, out);
        nextCubic = c2;
        pos = end;
        break;
      }
      case 'Q': {
        const c = at(args[0]!, args[1]!);
        const end = at(args[2]!, args[3]!);
        quad(pos, c, end, step, out);
        nextQuad = c;
        pos = end;
        break;
      }
      case 'T': {
        const c: Point = lastQuad ? { x: 2 * pos.x - lastQuad.x, y: 2 * pos.y - lastQuad.y } : pos;
        const end = at(args[0]!, args[1]!);
        quad(pos, c, end, step, out);
        nextQuad = c;
        pos = end;
        break;
      }
      case 'A': {
        const end = at(args[5]!, args[6]!);
        arc(pos, args[0]!, args[1]!, args[2]!, args[3] !== 0, args[4] !== 0, end, step, out);
        pos = end;
        break;
      }
    }
    lastCubic = nextCubic;
    lastQuad = nextQuad;
  }
  finish();
  return subs;
}
