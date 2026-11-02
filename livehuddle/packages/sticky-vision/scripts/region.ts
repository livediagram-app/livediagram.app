import { classMaskOf, closeRadiusFor } from '../src/detect';
import { closePaperMask, labelComponents } from '../src/components';
import { boxOf, estimateNoteSize, noiseFloorFor } from '../src/boxes';
import { writeFileSync } from 'node:fs';
import { loadPhoto, workDirFor } from './photos';
import { encodePng } from './png';
import { photoDir } from './truth';

// The raw and closed paper masks of one region of one photo, as text: which
// class each pixel is, so a separation question can be looked at pixel by
// pixel without writing an image anywhere.
//
//   npx tsx scripts/region.ts <photo> <x> <y> <w> <h> [--png]
//
// Prints the note size, the close radius, then the region twice (raw, closed):
// `.` is not paper, a digit is the class id (ids above 9 print as letters).
// `--png` also writes the region of the photograph, magnified four times, to
// the system temp directory (never the repo: the photos are private).

const png = process.argv.includes('--png');
const [name, ...rest] = process.argv.slice(2).filter((a) => a !== '--png');
if (!name || rest.length < 4) {
  console.error('usage: region.ts <photo> <x> <y> <w> <h>');
  process.exit(1);
}
const [x0, y0, w, h] = rest.map(Number) as [number, number, number, number];
const image = loadPhoto(photoDir(), name);
const mask = classMaskOf(image);
const imageSize = Math.max(image.width, image.height);
const noteSize = estimateNoteSize(labelComponents(mask).map(boxOf), noiseFloorFor(imageSize));
// The detector's own radius (a hand-copied 0.04 closed twice as hard).
const radius = closeRadiusFor(noteSize, imageSize);
const closed = closePaperMask(mask, { radius });
console.log(`note ${noteSize}px  close radius ${radius}`);
const glyph = (c: number) => (c === 0 ? '.' : c < 10 ? String(c) : String.fromCharCode(55 + c));
for (const [label, m] of [
  ['raw', mask],
  ['closed', closed],
] as const) {
  console.log(`\n${label}`);
  for (let y = y0; y < y0 + h && y < m.height; y += 1) {
    let row = `${String(y).padStart(4)} `;
    for (let x = x0; x < x0 + w && x < m.width; x += 1) row += glyph(m.classes[y * m.width + x]!);
    console.log(row);
  }
}

if (png) {
  const scale = 4;
  const x1 = Math.min(image.width, x0 + w);
  const y1 = Math.min(image.height, y0 + h);
  const cw = (x1 - x0) * scale;
  const ch = (y1 - y0) * scale;
  const data = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y += 1)
    for (let x = 0; x < cw; x += 1) {
      const si = ((y0 + Math.floor(y / scale)) * image.width + x0 + Math.floor(x / scale)) * 4;
      const di = (y * cw + x) * 4;
      for (let k = 0; k < 3; k += 1) data[di + k] = image.data[si + k]!;
      data[di + 3] = 255;
    }
  const out = `${workDirFor(photoDir())}/region-${name.replace(/\.[^.]+$/, '')}-${x0}-${y0}.png`;
  writeFileSync(out, encodePng({ width: cw, height: ch, data }));
  console.log(`\nwrote ${out}`);
}
