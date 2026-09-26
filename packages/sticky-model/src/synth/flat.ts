import { hexToRgb } from '@livediagram/sticky-vision';
import { layoutNotes, type NoteSpec } from './layout';
import { dividerLine, handwriting } from './notes';
import {
  boxBlur,
  eachNear,
  hsvToRgb,
  planeOf,
  scaleAt,
  stroke,
  type Plane,
  type Rgb,
} from './raster';
import type { Rng } from './rng';

// A wall as a screen draws it rather than as a camera sees it: a screenshot
// of a digital board, a wall drawn in a test. Flat canvas, flat fills, crisp
// edges, no light, no texture, no noise; typed or hand-written text, or none.
// A model that only ever saw photographs reads a flat, textureless note as
// background, because nothing in a photograph is that clean; these walls are
// what it learns otherwise from.

// Screens show notes zoomed in far past any photograph: up to the 256px tile.
export const FLAT_NOTE_SIZE_RANGE: [number, number] = [14, 240];

// A digital whiteboard's sticky palette and the editor's own event-storming
// fills, exact: screens repeat one colour to the bit.
const DIGITAL_FILLS = [
  '#fdba74',
  '#93c5fd',
  '#fef08a',
  '#d8b4fe',
  '#86efac',
  '#f9a8d4',
  '#fef9c3',
  '#fca5a5',
  '#fff9b1',
  '#f5d128',
  '#ff9d48',
  '#a6ccf5',
  '#c9df56',
  '#ea94bb',
  '#d5f692',
  '#67c6c0',
  '#f16c7f',
  '#be88c7',
];

// The synth planes work in 0-1, so the shared 0-255 parse is scaled down.
const fromHex = (h: string): Rgb => {
  const { r, g, b } = hexToRgb(h);
  return [r / 255, g / 255, b / 255];
};

// White, light grey, a pale tint, or dark mode.
function canvasColour(rng: Rng): Rgb {
  const r = rng.next();
  if (r < 0.35) return hsvToRgb(rng.range(0, 360), rng.range(0, 0.02), rng.range(0.96, 1));
  if (r < 0.6) return hsvToRgb(rng.range(180, 240), rng.range(0, 0.06), rng.range(0.82, 0.96));
  if (r < 0.75) return hsvToRgb(rng.range(0, 360), rng.range(0.03, 0.12), rng.range(0.85, 1));
  return hsvToRgb(rng.range(200, 260), rng.range(0, 0.15), rng.range(0.07, 0.25));
}

const lightness = (c: Rgb) => (c[0] + c[1] + c[2]) / 3;

function fill(plane: Plane, colour: Rgb): void {
  for (let p = 0; p < plane.width * plane.height; p += 1) plane.rgb.set(colour, p * 3);
}

// A dot or line grid, a shade off the canvas.
function canvasGrid(plane: Plane, rng: Rng, canvas: Rgb, size: number): void {
  const step = Math.max(6, Math.round(size * rng.range(0.25, 1)));
  const dots = rng.chance(0.5);
  const shade = lightness(canvas) > 0.5 ? rng.range(0.85, 0.95) : rng.range(1.3, 1.8);
  const ox = rng.int(0, step - 1);
  const oy = rng.int(0, step - 1);
  for (let y = 0; y < plane.height; y += 1) {
    for (let x = 0; x < plane.width; x += 1) {
      const onX = (x - ox) % step === 0;
      const onY = (y - oy) % step === 0;
      if (dots ? onX && onY : onX || onY) scaleAt(plane, y * plane.width + x, shade);
    }
  }
}

// Connectors between notes: straight or elbowed lines, ink on a light canvas,
// light on a dark one.
function connectors(plane: Plane, rng: Rng, ink: Rgb, size: number): void {
  const n = rng.int(1, 6);
  for (let i = 0; i < n; i += 1) {
    const x0 = rng.range(0, plane.width);
    const y0 = rng.range(0, plane.height);
    const x1 = x0 + rng.range(-4, 4) * size;
    const y1 = y0 + rng.range(-3, 3) * size;
    const pts: [number, number][] = rng.chance(0.5)
      ? [
          [x0, y0],
          [x1, y1],
        ]
      : [
          [x0, y0],
          [x1, y0],
          [x1, y1],
        ];
    stroke(plane, pts, rng.range(1, 3), ink, 1);
  }
}

// Lines of text as a screen sets it: short bars for words, or one long rule a
// line. `u`, `v` run across the note in its own frame, so a turned note turns
// its text with it.
function typedText(plane: Plane, rng: Rng, note: NoteSpec, ink: Rgb): void {
  const cos = Math.cos(note.angle);
  const sin = Math.sin(note.angle);
  const at = (u: number, v: number): [number, number] => {
    const lx = (u - 0.5) * note.w;
    const ly = (v - 0.5) * note.h;
    return [note.cx + lx * cos - ly * sin, note.cy + lx * sin + ly * cos];
  };
  const ruled = rng.chance(0.3);
  const lineH = Math.max(1.2, note.h * rng.range(0.03, 0.08));
  const lines = rng.int(1, 4);
  const top = rng.range(0.15, 0.35);
  const gap = rng.range(0.12, 0.2);
  for (let l = 0; l < lines; l += 1) {
    const v = top + l * gap;
    if (v > 0.88) break;
    const left = rng.range(0.06, 0.15);
    const right = 1 - rng.range(0.06, 0.4);
    if (ruled) {
      stroke(plane, [at(left, v), at(right, v)], lineH, ink, 1);
      continue;
    }
    let u = left;
    while (u < right) {
      const word = Math.min(right - u, rng.range(0.06, 0.2));
      stroke(plane, [at(u, v), at(u + word, v)], lineH, ink, 1);
      u += word + rng.range(0.03, 0.06);
    }
  }
}

type Edge = 'none' | 'line' | 'shadow';

function paintFlatNote(plane: Plane, note: NoteSpec, colour: Rgb, edge: Edge, rng: Rng): void {
  const s = Math.min(note.w, note.h);
  if (edge === 'shadow') {
    const soft = Math.max(1, s * 0.04);
    const shifted = { ...note, cy: note.cy + soft };
    const strength = rng.range(0.08, 0.25);
    eachNear(plane, shifted, soft, (p, sd) => {
      if (sd > 0) scaleAt(plane, p, 1 - strength * (1 - sd / soft));
    });
  }
  const border = edge === 'line' ? rng.range(0.7, 0.9) : 1;
  eachNear(plane, note, 0.5, (p, sd) => {
    const cover = Math.max(0, Math.min(1, 0.5 - sd));
    const f = edge === 'line' && sd > -1 ? border : 1;
    const o = p * 3;
    plane.rgb[o] = plane.rgb[o]! * (1 - cover) + colour[0] * f * cover;
    plane.rgb[o + 1] = plane.rgb[o + 1]! * (1 - cover) + colour[1] * f * cover;
    plane.rgb[o + 2] = plane.rgb[o + 2]! * (1 - cover) + colour[2] * f * cover;
    if (sd < 0) plane.ids[p] = note.id;
  });
}

// An upright note on a screen sits on whole pixels.
function snapped(note: NoteSpec): NoteSpec {
  const x0 = Math.round(note.cx - note.w / 2);
  const y0 = Math.round(note.cy - note.h / 2);
  const w = Math.max(1, Math.round(note.w));
  const h = Math.max(1, Math.round(note.h));
  return { ...note, angle: 0, cx: x0 + w / 2, cy: y0 + h / 2, w, h };
}

export type FlatWall = { rgb: Uint8Array; ids: Int32Array; notes: NoteSpec[]; noteSize: number };

export function paintFlatWall(
  rng: Rng,
  width: number,
  height: number,
  noteSize = rng.logRange(...FLAT_NOTE_SIZE_RANGE),
): FlatWall {
  const plane = planeOf(width, height);
  const canvas = canvasColour(rng);
  fill(plane, canvas);
  const dark = lightness(canvas) < 0.5;
  const lineInk: Rgb = dark ? [0.85, 0.87, 0.9] : [0.1, 0.1, 0.12];
  if (rng.chance(0.3)) canvasGrid(plane, rng, canvas, noteSize);
  if (rng.chance(0.5)) connectors(plane, rng, lineInk, noteSize);

  const upright = rng.chance(0.75);
  const notes = layoutNotes(rng, width, height, noteSize).map((n) => (upright ? snapped(n) : n));
  const digital = rng.chance(0.6);
  const edge: Edge = rng.pick(['none', 'none', 'line', 'shadow'] as const);
  const text = rng.pick(['none', 'typed', 'hand'] as const);
  const noteInk: Rgb = [0.07, 0.08, 0.1];
  for (const note of notes) {
    const colour = digital ? fromHex(rng.pick(DIGITAL_FILLS)) : note.colour;
    paintFlatNote(plane, note, colour, edge, rng);
    if (text === 'typed' && rng.chance(0.85)) typedText(plane, rng, note, noteInk);
    if (text === 'hand' && rng.chance(0.85)) handwriting(plane, rng, note);
    if (rng.chance(0.1)) dividerLine(plane, rng, note);
  }
  // A screenshot scaled on its way into the photo import softens its edges.
  if (rng.chance(0.2)) boxBlur(plane.rgb, width, height, 3, 1);
  const rgb = new Uint8Array(plane.rgb.length);
  for (let i = 0; i < rgb.length; i += 1) {
    rgb[i] = Math.round(255 * Math.max(0, Math.min(1, plane.rgb[i]!)));
  }
  return { rgb, ids: plane.ids, notes, noteSize };
}
