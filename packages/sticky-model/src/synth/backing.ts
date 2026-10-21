import { backingColour, type Backing } from './palette';
import { blendAt, hsvToRgb, stroke, valueNoise, type Plane, type Rgb } from './raster';
import type { Rng } from './rng';

// The surface behind the notes, and everything on it that is NOT a note: the
// texture of kraft, the creases of a paper roll, whiteboard glare and marker
// lines, tape, cardboard and printed sheets. All of it is background to the
// model, so every one of these teaches it something a colour threshold gets
// wrong.

export function paintBacking(plane: Plane, rng: Rng, backing: Backing, size: number): void {
  const base = backingColour(rng, backing);
  const coarse = valueNoise(rng, size * rng.range(2, 6));
  const fine = valueNoise(rng, rng.range(1.5, 4));
  const fibre = valueNoise(rng, rng.range(3, 8));
  const coarseAmp = backing === 'kraft' ? rng.range(0.05, 0.16) : rng.range(0.02, 0.08);
  const fineAmp = backing === 'kraft' ? rng.range(0.02, 0.06) : rng.range(0, 0.02);
  for (let y = 0; y < plane.height; y += 1) {
    for (let x = 0; x < plane.width; x += 1) {
      const p = y * plane.width + x;
      const f =
        1 +
        (coarse(x, y) - 0.5) * 2 * coarseAmp +
        (fine(x, y) - 0.5) * 2 * fineAmp +
        (backing === 'kraft' ? (fibre(x * 0.25, y * 3) - 0.5) * fineAmp : 0);
      plane.rgb[p * 3] = base[0] * f;
      plane.rgb[p * 3 + 1] = base[1] * f;
      plane.rgb[p * 3 + 2] = base[2] * f;
    }
  }
  // Creases and roll joins: long soft lines, lighter on one side than the other.
  const creases = rng.int(0, backing === 'whiteboard' ? 1 : 4);
  for (let i = 0; i < creases; i += 1) crease(plane, rng);
  if (backing === 'whiteboard') {
    const glares = rng.int(0, 3);
    for (let i = 0; i < glares; i += 1) glare(plane, rng);
  }
}

function crease(plane: Plane, rng: Rng): void {
  const horizontal = rng.chance(0.6);
  const at = rng.range(0, horizontal ? plane.height : plane.width);
  const slope = rng.range(-0.05, 0.05);
  const width = rng.range(1, 4);
  const depth = rng.range(0.03, 0.15) * (rng.chance(0.5) ? 1 : -1);
  for (let y = 0; y < plane.height; y += 1) {
    for (let x = 0; x < plane.width; x += 1) {
      const d = horizontal ? y - (at + slope * x) : x - (at + slope * y);
      if (Math.abs(d) > width * 3) continue;
      const f = 1 - depth * Math.sign(d) * Math.exp(-(d * d) / (2 * width * width));
      const p = (y * plane.width + x) * 3;
      plane.rgb[p] = plane.rgb[p]! * f;
      plane.rgb[p + 1] = plane.rgb[p + 1]! * f;
      plane.rgb[p + 2] = plane.rgb[p + 2]! * f;
    }
  }
}

function glare(plane: Plane, rng: Rng): void {
  const cx = rng.range(0, plane.width);
  const cy = rng.range(0, plane.height);
  const rx = rng.range(0.05, 0.4) * plane.width;
  const ry = rx * rng.range(0.2, 1);
  const strength = rng.range(0.1, 0.5);
  for (let y = 0; y < plane.height; y += 1) {
    for (let x = 0; x < plane.width; x += 1) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d > 4) continue;
      blendAt(plane, y * plane.width + x, [1, 1, 1], strength * Math.exp(-d));
    }
  }
}

const INKS: Rgb[] = [
  [0.08, 0.08, 0.1],
  [0.12, 0.15, 0.4],
  [0.5, 0.1, 0.1],
  [0.1, 0.35, 0.15],
  [0.3, 0.3, 0.32],
];

export function inkColour(rng: Rng): Rgb {
  const base = rng.chance(0.6) ? INKS[0]! : rng.pick(INKS);
  const j = rng.range(-0.05, 0.08);
  return [base[0] + j, base[1] + j, base[2] + j];
}

// Marker lines and arrows drawn on the wall between the notes.
export function paintWallMarks(plane: Plane, rng: Rng, size: number): void {
  const n = rng.int(0, 6);
  for (let i = 0; i < n; i += 1) {
    const pts: [number, number][] = [];
    let x = rng.range(0, plane.width);
    let y = rng.range(0, plane.height);
    const angle = rng.range(0, Math.PI * 2);
    const len = rng.range(1, 6) * size;
    const steps = 12;
    const bend = rng.range(-0.1, 0.1);
    for (let s = 0; s <= steps; s += 1) {
      pts.push([x, y]);
      const a = angle + bend * s;
      x += (Math.cos(a) * len) / steps;
      y += (Math.sin(a) * len) / steps;
    }
    const dashed = rng.chance(0.3);
    const colour = inkColour(rng);
    const width = rng.range(0.6, 2.5);
    if (dashed) {
      for (let s = 1; s < pts.length; s += 2)
        stroke(plane, [pts[s - 1]!, pts[s]!], width, colour, 0.9);
    } else {
      stroke(plane, pts, width, colour, rng.range(0.6, 1));
    }
  }
}

// Things on the wall shaped and coloured like paper that are NOT notes:
// masking tape, cardboard, printed sheets, big hand-written headings.
export function paintDistractors(plane: Plane, rng: Rng, size: number): void {
  const n = rng.int(0, 5);
  for (let i = 0; i < n; i += 1) {
    const kind = rng.next();
    if (kind < 0.45) tape(plane, rng, size);
    else if (kind < 0.7) sheet(plane, rng, size);
    else heading(plane, rng, size);
  }
}

export function tape(plane: Plane, rng: Rng, size: number): void {
  const colour = hsvToRgb(rng.range(40, 60), rng.range(0.25, 0.6), rng.range(0.75, 0.95));
  const cx = rng.range(0, plane.width);
  const cy = rng.range(0, plane.height);
  const w = size * rng.range(0.8, 3);
  const h = size * rng.range(0.25, 0.45);
  const a = rng.chance(0.6) ? rng.range(-0.1, 0.1) : rng.range(0, Math.PI);
  const alpha = rng.range(0.45, 0.85);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const reach = Math.hypot(w, h) / 2;
  for (
    let y = Math.max(0, Math.floor(cy - reach));
    y < Math.min(plane.height, cy + reach);
    y += 1
  ) {
    for (
      let x = Math.max(0, Math.floor(cx - reach));
      x < Math.min(plane.width, cx + reach);
      x += 1
    ) {
      const lx = (x - cx) * cos + (y - cy) * sin;
      const ly = -(x - cx) * sin + (y - cy) * cos;
      // Torn ends: a ragged edge rather than a clean cut.
      const ragged = w / 2 - Math.abs(Math.sin(ly * 1.7) * 1.5);
      if (Math.abs(lx) > ragged || Math.abs(ly) > h / 2) continue;
      blendAt(plane, y * plane.width + x, colour, alpha);
    }
  }
}

function sheet(plane: Plane, rng: Rng, size: number): void {
  const cardboard = rng.chance(0.5);
  const colour = cardboard
    ? hsvToRgb(rng.range(25, 38), rng.range(0.35, 0.6), rng.range(0.55, 0.85))
    : hsvToRgb(rng.range(0, 360), rng.range(0, 0.08), rng.range(0.85, 1));
  const w = size * rng.range(1.5, 5);
  const h = size * rng.range(1.2, 4);
  const x0 = rng.range(-w / 2, plane.width - w / 2);
  const y0 = rng.range(-h / 2, plane.height - h / 2);
  const flute = valueNoise(rng, 2);
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(plane.height, y0 + h); y += 1) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(plane.width, x0 + w); x += 1) {
      const f = cardboard ? 1 + (flute(x * 0.3, 0) - 0.5) * 0.08 : 1;
      blendAt(plane, y * plane.width + x, [colour[0] * f, colour[1] * f, colour[2] * f], 1);
    }
  }
  // Printed lines of text.
  const lines = rng.int(0, 8);
  const ink = inkColour(rng);
  for (let l = 0; l < lines; l += 1) {
    const y = y0 + h * rng.range(0.1, 0.9);
    const xa = x0 + w * rng.range(0.05, 0.4);
    const xb = xa + w * rng.range(0.1, 0.5);
    stroke(
      plane,
      [
        [xa, y],
        [xb, y],
      ],
      rng.range(0.8, 2.5),
      ink,
      0.8,
    );
  }
}

function heading(plane: Plane, rng: Rng, size: number): void {
  const x = rng.range(0, plane.width);
  const y = rng.range(0, plane.height);
  scribble(
    plane,
    rng,
    x,
    y,
    size * rng.range(1, 4),
    size * rng.range(0.25, 0.6),
    inkColour(rng),
    rng.range(1, 3),
  );
}

// Handwriting-like strokes: a looping line along a baseline, broken into words.
export function scribble(
  plane: Plane,
  rng: Rng,
  x0: number,
  y0: number,
  length: number,
  height: number,
  colour: Rgb,
  width: number,
): void {
  let x = x0;
  const end = x0 + length;
  while (x < end) {
    const wordLen = Math.min(end - x, height * rng.range(1, 4));
    const pts: [number, number][] = [];
    const freq = rng.range(0.6, 1.4) / Math.max(1, height * 0.35);
    const phase = rng.range(0, Math.PI * 2);
    const steps = Math.max(4, Math.round(wordLen / 1.2));
    for (let s = 0; s <= steps; s += 1) {
      const t = (s / steps) * wordLen;
      const loop = Math.sin(t * freq * Math.PI * 2 + phase);
      pts.push([
        x + t + loop * height * 0.15,
        y0 + loop * height * 0.4 + rng.gauss() * height * 0.05,
      ]);
    }
    stroke(plane, pts, width, colour, rng.range(0.75, 1));
    x += wordLen + height * rng.range(0.3, 0.8);
  }
}
