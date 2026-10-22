import { hexToRgb, type ImageBuffer } from '@livediagram/sticky-vision';
import { rngFrom, type Rng } from '../../src/synth/rng';

// Drawn boards: the flat, textureless walls a screenshot of a digital board
// (or the e2e suite's drawn photo) shows. Flat fills, crisp edges, no light,
// no noise. A held-out check for the boundary model, drawn by code that shares
// nothing with the training generator (`src/synth/`), so a model cannot pass
// it by having learnt this file's quirks.

export type DrawnNote = { x: number; y: number; w: number; h: number; fill: string };
export type Board = { name: string; image: ImageBuffer; notes: DrawnNote[] };

type Rgb = [number, number, number];

const hex = (h: string): Rgb => {
  const { r, g, b } = hexToRgb(h);
  return [r, g, b];
};

// The editor's event-storming fills and a digital whiteboard's sticky palette.
const FILLS = [
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
];

// Canvases a board is drawn on: the e2e wall, white, a light grey, and dark
// mode.
const CANVASES = ['#f1f5f9', '#ffffff', '#e5e7eb', '#1e1e1e'];

const INK = hex('#111827');

function blank(width: number, height: number, canvas: string): ImageBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  const [r, g, b] = hex(canvas);
  for (let p = 0; p < width * height; p += 1) data.set([r, g, b, 255], p * 4);
  return { width, height, data };
}

function rect(img: ImageBuffer, x: number, y: number, w: number, h: number, c: Rgb): void {
  for (let yy = Math.max(0, y); yy < Math.min(img.height, y + h); yy += 1) {
    for (let xx = Math.max(0, x); xx < Math.min(img.width, x + w); xx += 1) {
      img.data.set([c[0], c[1], c[2], 255], (yy * img.width + xx) * 4);
    }
  }
}

// Text as a digital board sets it: lines of short black bars (words).
function typed(img: ImageBuffer, n: DrawnNote, rng: Rng): void {
  const lineH = Math.max(2, Math.round(n.h * 0.07));
  const lines = rng.int(1, 3);
  for (let l = 0; l < lines; l += 1) {
    const y = Math.round(n.y + n.h * (0.25 + l * 0.18));
    let x = Math.round(n.x + n.w * 0.12);
    const end = n.x + n.w * rng.range(0.6, 0.88);
    while (x < end) {
      const word = Math.max(3, Math.round(n.w * rng.range(0.06, 0.18)));
      rect(img, x, y, Math.min(word, Math.round(end - x)), lineH, INK);
      x += word + Math.max(2, Math.round(n.w * 0.04));
    }
  }
}

// The e2e suite's two marker strokes, 8px in from each side, 4px thick.
function strokes(img: ImageBuffer, n: DrawnNote): void {
  for (const at of [0.35, 0.55]) {
    rect(img, n.x + 8, Math.round(n.y + n.h * at), n.w - 16, 4, INK);
  }
}

type Text = 'none' | 'typed' | 'strokes';

function draw(img: ImageBuffer, notes: DrawnNote[], text: Text, rng: Rng): void {
  for (const n of notes) {
    rect(img, n.x, n.y, n.w, n.h, hex(n.fill));
    if (text === 'typed') typed(img, n, rng);
    if (text === 'strokes') strokes(img, n);
  }
}

// A grid of notes of one size with a gap between them (a digital board).
function grid(rng: Rng, width: number, height: number, size: number, gap: number): DrawnNote[] {
  const notes: DrawnNote[] = [];
  const margin = Math.round(size * 0.4);
  for (let y = margin; y + size <= height - margin; y += size + gap) {
    for (let x = margin; x + size <= width - margin; x += size + gap) {
      notes.push({ x, y, w: size, h: size, fill: rng.pick(FILLS) });
    }
  }
  return notes;
}

// The e2e suite's walls, exactly (`apps/live/e2e/photo-model.spec.ts`).
function e2eBoards(): Board[] {
  const rng = rngFrom(0);
  const make = (name: string, notes: DrawnNote[]): Board => {
    const image = blank(900, 400, '#f1f5f9');
    draw(image, notes, 'strokes', rng);
    return { name, image, notes };
  };
  return [
    make('e2e-three', [
      { fill: '#fdba74', x: 120, y: 120, w: 160, h: 160 },
      { fill: '#93c5fd', x: 380, y: 120, w: 160, h: 160 },
      { fill: '#fdba74', x: 640, y: 120, w: 160, h: 160 },
    ]),
    make('e2e-flat', [
      { fill: '#fdba74', x: 200, y: 120, w: 180, h: 180 },
      { fill: '#93c5fd', x: 500, y: 120, w: 180, h: 180 },
    ]),
  ];
}

export const BOARD_SIZES = [36, 60, 100, 160, 220];
const TEXTS: Text[] = ['none', 'typed', 'strokes'];

// Every canvas x note size x text style, one grid each, plus the e2e walls.
export function drawnBoards(): Board[] {
  const boards = e2eBoards();
  let seed = 1;
  for (const canvas of CANVASES) {
    for (const size of BOARD_SIZES) {
      for (const text of TEXTS) {
        const rng = rngFrom(seed);
        seed += 1;
        const width = 1000;
        const height = Math.max(400, Math.round(size * 3.2));
        const notes = grid(rng, width, height, size, Math.round(size * rng.range(0.12, 0.5)));
        const image = blank(width, height, canvas);
        draw(image, notes, text, rng);
        boards.push({ name: `${canvas.slice(1)}-${size}-${text}`, image, notes });
      }
    }
  }
  return boards;
}
