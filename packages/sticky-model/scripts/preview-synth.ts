import { mkdirSync, writeFileSync } from 'node:fs';
import { encodePng } from '../../sticky-vision/scripts/png';
import { syntheticWall } from '../src/synth/wall';
import { WORK_DIR } from './paths';

// A contact sheet of synthetic walls beside their masks, to judge the
// generator by eye:
//
//   npx tsx scripts/preview-synth.ts [count] [size] [firstSeed]
//
// Written under the system temp directory, never into the repo.

const count = Number(process.argv[2] ?? 12);
const size = Number(process.argv[3] ?? 256);
const first = Number(process.argv[4] ?? 1);
const cols = 4;
const rows = Math.ceil(count / cols);
const sheetW = cols * size * 2 + (cols - 1) * 8;
const sheetH = rows * size + (rows - 1) * 8;
const data = new Uint8ClampedArray(sheetW * sheetH * 4).fill(40);
const MASK_INK: [number, number, number][] = [
  [30, 30, 30],
  [240, 240, 240],
  [230, 60, 60],
];

for (let i = 0; i < count; i += 1) {
  const wall = syntheticWall(first + i, size, size);
  const ox = (i % cols) * (size * 2 + 8);
  const oy = Math.floor(i / cols) * (size + 8);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const s = y * size + x;
      const o = ((oy + y) * sheetW + ox + x) * 4;
      data[o] = wall.rgb[s * 3]!;
      data[o + 1] = wall.rgb[s * 3 + 1]!;
      data[o + 2] = wall.rgb[s * 3 + 2]!;
      data[o + 3] = 255;
      const m = ((oy + y) * sheetW + ox + size + x) * 4;
      const ink = MASK_INK[wall.classes[s]!]!;
      data[m] = ink[0];
      data[m + 1] = ink[1];
      data[m + 2] = ink[2];
      data[m + 3] = 255;
    }
  }
}

mkdirSync(WORK_DIR, { recursive: true });
const out = `${WORK_DIR}/synth-preview.png`;
writeFileSync(out, encodePng({ width: sheetW, height: sheetH, data }));
console.log(out);
