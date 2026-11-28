// The bar's drawings (docs/specs/009-elements/office.md "Bar"): the bar, its stool, the drinks cabinet and the drinks
// fridge, each view as a table of parts in the furniture's vocabulary (seating.ts). office-garden.ts re-exports what it
// shares. Pure: no React, no DOM.

import type { FurnitureDrawing, FurniturePart } from './seating';
import { ellipse, path, rect } from './furniture-parts';
import { BAR_STOOL_SEATS } from '@livehuddle/avatar/seats';
import { GARDEN_TONES as T } from './garden-tones';

// --- The bar --------------------------------------------------------------------------------------------------

function bottleRow(y: number, from: number, to: number, offset: number): FurniturePart[] {
  const out: FurniturePart[] = [];
  const heights = [16, 12, 18, 14, 10, 16, 13];
  let x = from;
  let i = 0;
  while (x + 7 <= to) {
    const h = heights[(i + offset) % heights.length]!;
    const fill = T.bottles[(i + offset) % T.bottles.length];
    out.push(rect('panel', x, y - h, 7, h, 2, fill));
    out.push(rect('panel', x + 2, y - h - 4, 3, 5, 1, fill));
    x += i % 3 === 2 ? 16 : 11;
    i += 1;
  }
  return out;
}

// A long counter with a dark top, bottles on a back shelf behind it, glasses on the counter, a foot rail.
export const BAR_VIEW: FurnitureDrawing = {
  width: 240,
  height: 120,
  parts: [
    ellipse('shadow', 120, 116, 118, 4),
    rect('face', 8, 2, 224, 50, 3),
    ...bottleRow(24, 16, 224, 0),
    rect('panel', 12, 24, 216, 4, 1.5, T.wood),
    ...bottleRow(46, 20, 224, 3),
    rect('panel', 4, 56, 232, 46, 3, T.wood),
    path('rail', 'M60 62v34M120 62v34M180 62v34'),
    rect('panel', 0, 50, 240, 12, 4, T.counter),
    rect('panel', 46, 40, 8, 11, 2, T.glass),
    rect('panel', 150, 42, 7, 9, 2, T.glass),
    rect('panel', 184, 40, 8, 11, 2, T.glass),
    path('line', 'M12 108H228'),
  ],
  seats: [],
};

// Bottle necks over a shelf's top, seen from behind it.
function bottleNecks(y: number, from: number, to: number, offset: number): FurniturePart[] {
  const out: FurniturePart[] = [];
  for (let x = from, i = 0; x + 3 <= to; x += i % 3 === 2 ? 16 : 11, i += 1)
    out.push(
      rect(
        'panel',
        x,
        y - 2 * ((i + offset) % 3),
        3,
        8,
        1,
        T.bottles[(i + offset) % T.bottles.length],
      ),
    );
  return out;
}

// Bottles standing in a column down a strip: the shelf's front cheated toward you on the turned bar.
function bottleColumn(x: number, from: number, to: number, offset: number): FurniturePart[] {
  const out: FurniturePart[] = [];
  for (let y = from, i = 0; y + 5 <= to; y += i % 3 === 2 ? 11 : 8, i += 1)
    out.push(rect('panel', x, y, 7, 6, 2, T.bottles[(i + offset) % T.bottles.length]));
  return out;
}

// From the bartender's side: the counter beyond, its dark top with the glasses and a shelf of glasses under it; the
// back shelf nearest you, its back to you, the bottles' necks over its top.
export const BAR_BACK: FurnitureDrawing = {
  width: 240,
  height: 120,
  parts: [
    ellipse('shadow', 120, 116, 118, 4),
    rect('face', 6, 18, 228, 34, 3, T.wood),
    path('rail', 'M10 36H230'),
    rect('panel', 30, 38, 7, 8, 2, T.glass),
    rect('panel', 42, 38, 7, 8, 2, T.glass),
    rect('panel', 190, 38, 7, 8, 2, T.glass),
    rect('panel', 0, 10, 240, 12, 4, T.counter),
    rect('panel', 186, 2, 8, 11, 2, T.glass),
    rect('panel', 83, 4, 7, 9, 2, T.glass),
    rect('panel', 48, 2, 8, 11, 2, T.glass),
    ...bottleNecks(52, 18, 224, 0),
    rect('face', 8, 56, 224, 48, 3),
    path('rail', 'M64 62V98M120 62V98M176 62V98'),
    rect('panel', 4, 102, 232, 6, 2, T.wood),
  ],
  seats: [],
};

// Facing left: long and narrow, the counter down its left with its wooden front cheated toward you and its foot rail
// along it, the glasses on its dark top; the back shelf down its right, its bottles toward the counter.
export const BAR_SIDE: FurnitureDrawing = {
  width: 104,
  height: 232,
  parts: [
    ellipse('shadow', 52, 228, 50, 4),
    // The back shelf: its top, its near end, its bottles cheated toward the counter.
    rect('panel', 70, 12, 28, 160, 3),
    rect('face', 70, 170, 28, 52, 3),
    rect('face', 62, 14, 10, 206, 2),
    ...bottleColumn(63, 18, 214, 0),
    // The counter: its front, its dark top with the glasses, its near end.
    rect('panel', 8, 12, 12, 210, 3, T.wood),
    path('rail', 'M10 64h8M10 118h8M10 172h8'),
    rect('panel', 18, 12, 28, 162, 4, T.counter),
    rect('panel', 28, 32, 8, 11, 2, T.glass),
    rect('panel', 28, 102, 7, 9, 2, T.glass),
    rect('panel', 28, 124, 8, 11, 2, T.glass),
    rect('face', 18, 172, 28, 50, 3, T.wood),
    path('line', 'M4 24V220'),
  ],
  seats: [],
};

// A round padded seat on a tall stem with a foot ring: its sitter faces the bar.
export const BAR_STOOL_VIEW: FurnitureDrawing = {
  width: BAR_STOOL_SEATS.width,
  height: BAR_STOOL_SEATS.height,
  parts: [
    ellipse('shadow', 22, 61, 14, 2.5),
    ellipse('panel', 22, 59, 11, 3, '#6b7480'),
    path('line', 'M22 30V58', '#59616d'),
    ellipse('rail', 22, 46, 10, 3, '#3a4049'),
    ellipse('face', 22, 28, 17, 6, '#5a3a24'),
    ellipse('panel', 22, 25, 17, 6.5, '#8a5a3a'),
  ],
  seats: BAR_STOOL_SEATS.seats.map(({ u, v }) => ({ u, v })),
};

// A wooden cabinet with glass doors, bottles inside, drawers below.
export const DRINKS_CABINET_VIEW: FurnitureDrawing = {
  width: 88,
  height: 120,
  parts: [
    ellipse('shadow', 44, 117, 40, 3),
    path('line', 'M12 108v8M76 108v8'),
    rect('panel', 4, 4, 80, 106, 4, T.wood),
    rect('panel', 10, 12, 32, 64, 2, T.glass),
    rect('panel', 46, 12, 32, 64, 2, T.glass),
    ...bottleRow(42, 13, 40, 1),
    ...bottleRow(42, 49, 76, 4),
    path('rail', 'M10 44H42M46 44H78'),
    ...bottleRow(72, 13, 40, 2),
    ...bottleRow(72, 49, 76, 5),
    path('glint', 'M16 70L28 18M52 70L64 18'),
    rect('panel', 10, 82, 68, 22, 2, T.woodDeep),
    path('rail', 'M38 93h12'),
  ],
  seats: [],
};

// Its back to you: the top seen from above, the back's boards, its legs.
export const DRINKS_CABINET_BACK: FurnitureDrawing = {
  width: 88,
  height: 120,
  parts: [
    ellipse('shadow', 44, 117, 40, 3),
    path('line', 'M12 108v8M76 108v8'),
    rect('panel', 4, 4, 80, 10, 3, T.wood),
    rect('face', 4, 12, 80, 98, 4, T.wood),
    path('rail', 'M24 18V104M44 18V104M64 18V104'),
  ],
  seats: [],
};

// Facing left: its top running away to its near end, its front cheated down its left: the glass doors with their
// bottles, and the drawers below.
export const DRINKS_CABINET_SIDE: FurnitureDrawing = {
  width: 48,
  height: 176,
  parts: [
    ellipse('shadow', 26, 172, 22, 3),
    path('line', 'M20 160v10M42 160v10'),
    rect('panel', 14, 4, 32, 56, 3, T.wood),
    rect('face', 14, 58, 32, 104, 4, T.wood),
    rect('panel', 4, 6, 12, 156, 3, T.wood),
    rect('panel', 6, 10, 8, 102, 2, T.glass),
    ...bottleColumn(6.5, 14, 58, 1),
    path('rail', 'M6 61h8'),
    ...bottleColumn(6.5, 64, 108, 4),
    path('glint', 'M8 104L12 20'),
    rect('panel', 6, 116, 8, 42, 2, T.woodDeep),
    path('rail', 'M10 130v12'),
  ],
  seats: [],
};

function canRow(y: number, offset: number): FurniturePart[] {
  const out: FurniturePart[] = [];
  for (let i = 0; i < 5; i += 1)
    out.push(rect('panel', 13 + i * 9.4, y - 12, 7, 12, 1.5, T.cans[(i + offset) % T.cans.length]));
  return out;
}

// A tall glass-fronted fridge of coloured cans.
export const DRINKS_FRIDGE_VIEW: FurnitureDrawing = {
  width: 72,
  height: 128,
  parts: [
    ellipse('shadow', 36, 125, 33, 3),
    rect('panel', 4, 4, 64, 118, 6),
    rect('screen', 10, 9, 52, 6, 2),
    rect('panel', 9, 19, 54, 96, 3, T.glassDeep),
    ...canRow(44, 0),
    path('rail', 'M10 45H62'),
    ...canRow(72, 1),
    path('rail', 'M10 73H62'),
    ...canRow(100, 2),
    path('rail', 'M10 101H62'),
    path('glint', 'M16 110L34 24'),
    path('line', 'M58 48V88'),
  ],
  seats: [],
};

// Its back to you: the top seen from above, its back, and the cooling coil's grille low down.
export const DRINKS_FRIDGE_BACK: FurnitureDrawing = {
  width: 72,
  height: 128,
  parts: [
    ellipse('shadow', 36, 125, 33, 3),
    rect('panel', 4, 4, 64, 10, 4),
    rect('face', 4, 12, 64, 110, 6),
    rect('rail', 12, 78, 48, 34, 2),
    path('rail', 'M16 86h40M16 94h40M16 102h40'),
  ],
  seats: [],
};

// Cans standing in a column down the turned fridge's glass.
function canColumn(from: number, to: number, offset: number): FurniturePart[] {
  const out: FurniturePart[] = [];
  for (let y = from, i = 0; y + 7 <= to; y += 9, i += 1)
    out.push(rect('panel', 8, y, 6, 7, 1.5, T.cans[(i + offset) % T.cans.length]));
  return out;
}

// Facing left: tall and narrow, its top running away to its near side, its glass front cheated down its left with
// the lit header, the cans on their shelves and the handle at its near end.
export const DRINKS_FRIDGE_SIDE: FurnitureDrawing = {
  width: 56,
  height: 168,
  parts: [
    ellipse('shadow', 32, 164, 26, 3),
    rect('panel', 16, 4, 36, 42, 4),
    rect('face', 16, 44, 36, 118, 6),
    rect('panel', 4, 6, 14, 156, 4),
    rect('screen', 7, 10, 8, 7, 2),
    rect('panel', 7, 20, 8, 136, 3, T.glassDeep),
    ...canColumn(22, 64, 0),
    path('rail', 'M8 65h6'),
    ...canColumn(67, 109, 1),
    path('rail', 'M8 110h6'),
    ...canColumn(112, 154, 2),
    path('glint', 'M9 150L13 30'),
    path('line', 'M4 116V146'),
  ],
  seats: [],
};
