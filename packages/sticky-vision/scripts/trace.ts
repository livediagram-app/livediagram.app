import { classMaskOf, detectStickies } from '../src/detect';
import { closePaperMask, labelComponents } from '../src/components';
import {
  estimateNoteSize,
  estimateNoteSizes,
  fillRatio,
  mergeFragments,
  type Box,
} from '../src/boxes';
import { splitOversized } from '../src/split';
import { cutAtNotches } from '../src/chords';
import { cutAtSeam, findSeam, luminanceOf } from '../src/seam';
import { listPhotos, loadPhoto } from './photos';
import { photoDir, truthFor } from './truth';

// Where a box comes from: the separation group's trace of a sweep.
//
//   npx tsx scripts/trace.ts [photo-substring] [x,y ...]
//
// With points, traces the blob (after the close and the fragment merge) under
// each point; without, every detection that holds two or more labelled
// centres. For each it prints the blob, then the pieces the splitter, the
// notch cut and the seam cut make of it that lie over the point (or the
// detection), with the seam each piece shows — all in notes, so the numbers
// read the same on every wall. The seam cut runs whether or not the detector
// hands it the photograph's luminance.

type Rect = { x: number; y: number; w: number; h: number };
const inside = (r: Rect, x: number, y: number) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

const [filter = '', ...pointArgs] = process.argv.slice(2);
const points = pointArgs.map((p) => p.split(',').map(Number) as [number, number]);
const DIR = photoDir();
for (const name of listPhotos(DIR).filter((n) => n.includes(filter))) {
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
  const blobs = labelComponents(mask).map(toBox);
  const note = estimateNoteSize(blobs, noiseFloor);
  const classSize = estimateNoteSizes(blobs, noiseFloor);
  const cap = Math.max(2, Math.round(imageSize * 0.006));
  const closed = closePaperMask(mask, {
    radius: Math.max(1, Math.min(cap, Math.round(note * 0.04))),
  });
  const merged = mergeFragments(labelComponents(closed).map(toBox), note);
  const lum = luminanceOf(image);
  const notes = labels.notes.map((n) => ({
    kind: n.kind,
    cx: (n.x + n.w / 2) * width,
    cy: (n.y + n.h / 2) * height,
    w: n.w * width,
    h: n.h * height,
  }));
  const fmt = (b: Box) => {
    const seam = findSeam(lum, b, note);
    const s = seam
      ? ` seam ${seam.vertical ? 'x' : 'y'}=${seam.at}${seam.tilt ? `~${seam.tilt}` : ''} d${seam.depth.toFixed(0)}`
      : '';
    return `${b.w}x${b.h}@${b.x},${b.y} (${(b.w / note).toFixed(2)}x${(b.h / note).toFixed(2)}) f${fillRatio(b).toFixed(2)}${s}`;
  };
  console.log(`\n${name}  note ${note}px  class sizes ${JSON.stringify([...classSize])}`);
  const targets: Rect[] = points.length
    ? points.map(([x, y]) => ({ x, y, w: 0, h: 0 }))
    : detectStickies(image).filter((d) => notes.filter((n) => inside(d, n.cx, n.cy)).length >= 2);
  for (const t of targets) {
    const held = notes.filter(
      (n) => overlap(t, { x: n.cx, y: n.cy, w: 1, h: 1 }) > 0 || inside(t, n.cx, n.cy),
    );
    const near = notes.filter(
      (n) =>
        Math.abs(n.cx - (t.x + t.w / 2)) < note * 1.2 &&
        Math.abs(n.cy - (t.y + t.h / 2)) < note * 1.2,
    );
    console.log(
      `  at ${t.w}x${t.h}@${t.x},${t.y}  labels near: ${near
        .map(
          (n) =>
            `${n.kind} ${n.w.toFixed(0)}x${n.h.toFixed(0)}@${(n.cx - n.w / 2).toFixed(0)},${(n.cy - n.h / 2).toFixed(0)}`,
        )
        .join(' | ')}${held.length > 1 ? `  (holds ${held.length})` : ''}`,
    );
    const hit = (b: Rect) => (t.w === 0 ? inside(b, t.x, t.y) : overlap(b, t) > 0);
    const source = merged.filter(hit).sort((a, b) => overlap(b, t) - overlap(a, t))[0];
    if (!source) continue;
    console.log(
      `    blob  ${fmt(source)} class ${source.classId} parts ${source.parts?.length ?? 1}`,
    );
    const split = splitOversized(source, note, closed, mask);
    console.log(`    split ${split.filter(hit).map(fmt).join(' | ')}`);
    const notched = split.flatMap((b) => cutAtNotches(b, closed, note));
    console.log(`    notch ${notched.filter(hit).map(fmt).join(' | ')}`);
    const seamed = notched.flatMap((b) => cutAtSeam(b, lum, closed, note));
    console.log(`    seam  ${seamed.filter(hit).map(fmt).join(' | ')}`);
  }
}
