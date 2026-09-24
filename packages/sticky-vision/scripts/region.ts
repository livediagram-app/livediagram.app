import { classMaskOf } from '../src/detect';
import { closePaperMask, labelComponents } from '../src/components';
import { estimateNoteSize } from '../src/boxes';
import { loadPhoto } from './photos';
import { photoDir } from './truth';

// The raw and closed paper masks of one region of one photo, as text: which
// class each pixel is, so a separation question can be looked at pixel by
// pixel without writing an image anywhere.
//
//   npx tsx scripts/region.ts <photo> <x> <y> <w> <h>
//
// Prints the note size, the close radius, then the region twice (raw, closed):
// `.` is not paper, a digit is the class id (ids above 9 print as letters).

const [name, ...rest] = process.argv.slice(2);
if (!name || rest.length < 4) {
  console.error('usage: region.ts <photo> <x> <y> <w> <h>');
  process.exit(1);
}
const [x0, y0, w, h] = rest.map(Number) as [number, number, number, number];
const image = loadPhoto(photoDir(), name);
const mask = classMaskOf(image);
const imageSize = Math.max(image.width, image.height);
const noteSize = estimateNoteSize(
  labelComponents(mask).map((c) => ({
    classId: c.classId,
    x: c.minX,
    y: c.minY,
    w: c.maxX - c.minX + 1,
    h: c.maxY - c.minY + 1,
    pixels: c.pixels,
  })),
  Math.max(4, Math.round(imageSize * 0.008)),
);
const cap = Math.max(2, Math.round(imageSize * 0.006));
const radius = Math.max(1, Math.min(cap, Math.round(noteSize * 0.04)));
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
