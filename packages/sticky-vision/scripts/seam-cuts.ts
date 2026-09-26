import { classMaskOf } from '../src/detect';
import { closePaperMask, labelComponents } from '../src/components';
import { estimateNoteSize, fillRatio, mergeFragments, type Box } from '../src/boxes';
import { splitOversized } from '../src/split';
import { cutAtNotches } from '../src/chords';
import { findSeam, luminanceOf } from '../src/seam';
import { listPhotos, loadPhoto } from './photos';
import { photoDir, truthFor } from './truth';

// Every seam the seam cut would find, judged against the labels: the
// separation group's view of whether a seam is between two notes or across
// one.
//
//   npx tsx scripts/seam-cuts.ts
//
// For each piece the splitter and the notch cut leave (the seam cut's input),
// prints the deepest seam it shows, if any, with the piece's size in notes,
// the seam's orientation, depth and position, and the verdict: GOOD when the
// piece holds two or more labelled centres and the seam has one on each side,
// MISS when it holds two but the seam leaves them on one side, BAD when it
// holds one centre (the seam crosses a single note, or cuts off a strip of a
// neighbour), NONE when it holds none.

type Rect = { x: number; y: number; w: number; h: number };
const inside = (r: Rect, x: number, y: number) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

const DIR = photoDir();
const tally: Record<string, number> = {};
for (const name of listPhotos(DIR)) {
  const labels = truthFor(name);
  if (!labels) continue;
  const image = loadPhoto(DIR, name);
  const { width, height } = image;
  const imageSize = Math.max(width, height);
  const mask = classMaskOf(image);
  const toBox = (c: {
    classId: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    pixels: number;
  }): Box => ({
    classId: c.classId,
    x: c.minX,
    y: c.minY,
    w: c.maxX - c.minX + 1,
    h: c.maxY - c.minY + 1,
    pixels: c.pixels,
  });
  const noiseFloor = Math.max(4, Math.round(imageSize * 0.008));
  const note = estimateNoteSize(labelComponents(mask).map(toBox), noiseFloor);
  const cap = Math.max(2, Math.round(imageSize * 0.006));
  const closed = closePaperMask(mask, {
    radius: Math.max(1, Math.min(cap, Math.round(note * 0.04))),
  });
  const pieces = mergeFragments(labelComponents(closed).map(toBox), note)
    .filter((b) => Math.min(b.w, b.h) >= noiseFloor && Math.min(b.w, b.h) >= note * 0.5)
    .flatMap((b) => splitOversized(b, note, closed, mask))
    .flatMap((b) => cutAtNotches(b, closed, note))
    .filter((b) => Math.min(b.w, b.h) >= note * 0.6 && fillRatio(b) >= 0.45);
  const lum = luminanceOf(image);
  const centres = labels.notes.map((n) => ({
    cx: (n.x + n.w / 2) * width,
    cy: (n.y + n.h / 2) * height,
  }));
  console.log(`\n${name}  note ${note}px`);
  for (const p of pieces) {
    const seam = findSeam(lum, p, note);
    if (!seam) continue;
    const held = centres.filter((c) => inside(p, c.cx, c.cy));
    const at = (c: { cx: number; cy: number }) => (seam.vertical ? c.cx : c.cy);
    const before = held.filter((c) => at(c) <= seam.at).length;
    const after = held.length - before;
    const from = seam.vertical ? p.x : p.y;
    const extent = seam.vertical ? p.w : p.h;
    const near = Math.min(seam.at - from, from + extent - seam.at) / note;
    const verdict =
      held.length >= 2 && before > 0 && after > 0
        ? 'GOOD'
        : held.length >= 2
          ? 'MISS'
          : held.length === 1
            ? 'BAD'
            : 'NONE';
    tally[verdict] = (tally[verdict] ?? 0) + 1;
    console.log(
      `  ${verdict.padEnd(4)} ${(p.w / note).toFixed(2)}x${(p.h / note).toFixed(2)}@${p.x},${p.y} ` +
        `${seam.vertical ? 'x' : 'y'} d${seam.depth.toFixed(0)} tilt ${seam.tilt} near ${near.toFixed(2)} ` +
        `along ${(extent / note).toFixed(2)} across ${((seam.vertical ? p.h : p.w) / note).toFixed(2)} held ${held.length}`,
    );
  }
}
console.log(`\n${JSON.stringify(tally)}`);
