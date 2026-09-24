import { classMaskOf, closeRadiusFor, detectStickies } from '../src/detect';
import { estimateNoteSize, isPlausibleNote, type Box } from '../src/boxes';
import { closePaperMask, labelComponents } from '../src/components';
import { convexityDefects, largestRegion, traceOuterContour } from '../src/contour';
import { noteSizeField } from '../src/size-field';
import { listPhotos, loadPhoto } from './photos';
import { photoDir, truthFor } from './truth';

// Lapped pairs by their outline: how deep the deepest notch of a detection a
// little longer than a note is, for a detection holding two labelled notes
// (PAIR) against one holding one (SINGLE).
//
//   npx tsx scripts/notch-probe.ts

const DIR = photoDir();
const rows: { v: string; depth: number; n: number; span: number }[] = [];
for (const name of listPhotos(DIR)) {
  const truth = truthFor(name);
  if (!truth) continue;
  const image = loadPhoto(DIR, name);
  const { width, height } = image;
  const imageSize = Math.max(width, height);
  const noiseFloor = Math.max(4, Math.round(imageSize * 0.008));
  const mask = classMaskOf(image);
  const blobs: Box[] = labelComponents(mask).map((c) => ({
    classId: c.classId,
    x: c.minX,
    y: c.minY,
    w: c.maxX - c.minX + 1,
    h: c.maxY - c.minY + 1,
    pixels: c.pixels,
  }));
  const wall = estimateNoteSize(blobs, noiseFloor);
  const field = noteSizeField(
    blobs.filter((b) => isPlausibleNote(b, noiseFloor)),
    wall,
  );
  const closed = closePaperMask(mask, { radius: closeRadiusFor(wall, imageSize) });
  const centres = truth.notes.map((n) => ({
    cx: (n.x + n.w / 2) * width,
    cy: (n.y + n.h / 2) * height,
  }));
  const kindId = new Map<string, number>();
  for (const d of detectStickies(image)) {
    const note = field.sizeAt(d.x + d.w / 2, d.y + d.h / 2);
    const span = Math.max(d.w, d.h) / note;
    if (span < 1.05 || span > 1.8) continue;
    // The class under the detection's centre is its own paper.
    const cls = closed.classes[Math.round(d.y + d.h / 2) * width + Math.round(d.x + d.w / 2)]!;
    const bin = new Uint8Array(d.w * d.h);
    for (let y = 0; y < d.h; y += 1)
      for (let x = 0; x < d.w; x += 1)
        if (closed.classes[(y + d.y) * width + x + d.x] === cls && cls !== 0) bin[y * d.w + x] = 1;
    const region = largestRegion(bin, d.w, d.h);
    const notches = convexityDefects(traceOuterContour(region, d.w, d.h), note * 0.04);
    const depths = notches.map((n) => n.depth / note).sort((a, b) => b - a);
    const held = centres.filter(
      (c) => c.cx >= d.x && c.cx <= d.x + d.w && c.cy >= d.y && c.cy <= d.y + d.h,
    ).length;
    const v = held >= 2 ? 'PAIR' : held === 1 ? 'SINGLE' : 'NONE';
    rows.push({ v, depth: depths[0] ?? 0, n: notches.length, span });
    if (v === 'PAIR')
      console.log(
        `${name} PAIR ${d.w}x${d.h}@${d.x},${d.y} span ${span.toFixed(2)} notches ${depths.map((x) => x.toFixed(2)).join(',')}`,
      );
  }
  void kindId;
}
for (const v of ['PAIR', 'SINGLE']) {
  const r = rows.filter((x) => x.v === v);
  const buckets = [0, 0.08, 0.12, 0.16, 0.2, 0.3];
  console.log(
    v,
    r.length,
    buckets.map((b) => `>=${b}:${r.filter((x) => x.depth >= b).length}`).join(' '),
  );
}
