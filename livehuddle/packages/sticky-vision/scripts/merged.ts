import { writeFileSync } from 'node:fs';
import { classMaskOf, detectStickies } from '../src/detect';
import { labelComponents } from '../src/components';
import { boxOf, estimateNoteSize, noiseFloorFor } from '../src/boxes';
import { holdsPoint } from '../src/rect';
import { encodePng } from './png';
import { listPhotos, loadPhoto, workDirFor } from './photos';
import { photoDir, truthFor } from './truth';

// What the MERGED boxes are, and where the missed notes went: the separation
// group's view of a sweep.
//
//   npx tsx scripts/merged.ts [--crops]
//
// For every merged box (a detection holding the centres of two or more
// labelled notes) it prints the box against the note size, how the notes
// inside it are arranged (columns x rows), their kinds, and how much of the
// box the raw mask calls its colour. For every missed note it says whether its
// centre sits in a merged box, in some other detection, or in none — and, with
// none, whether the raw mask has the note's paper there at all. `--crops`
// writes a magnified crop of each merged box to the system temp directory
// (never the repo: the photos are private).

const DIR = photoDir();
const crops = process.argv.includes('--crops');

function arrangement(points: { cx: number; cy: number }[], note: number): string {
  const cluster = (vals: number[]) => {
    const sorted = [...vals].sort((a, b) => a - b);
    let groups = 1;
    for (let i = 1; i < sorted.length; i += 1)
      if (sorted[i]! - sorted[i - 1]! > note * 0.5) groups += 1;
    return groups;
  };
  return `${cluster(points.map((p) => p.cx))}x${cluster(points.map((p) => p.cy))}`;
}

let totalMerged = 0;
const causes: Record<string, number> = {};
for (const name of listPhotos(DIR)) {
  const labels = truthFor(name);
  if (!labels) continue;
  const image = loadPhoto(DIR, name);
  const { width, height } = image;
  const found = detectStickies(image);
  const mask = classMaskOf(image);
  const imageSize = Math.max(width, height);
  const noiseFloor = noiseFloorFor(imageSize);
  const noteSize = estimateNoteSize(labelComponents(mask).map(boxOf), noiseFloor);
  const notes = labels.notes.map((n) => ({
    kind: n.kind,
    cx: (n.x + n.w / 2) * width,
    cy: (n.y + n.h / 2) * height,
    w: n.w * width,
    h: n.h * height,
  }));
  const merged = found.filter((b) => notes.filter((n) => holdsPoint(b, n.cx, n.cy)).length >= 2);
  totalMerged += merged.length;
  console.log(`\n${name}  note ${noteSize}px  merged ${merged.length}`);
  merged.forEach((b, i) => {
    const held = notes.filter((n) => holdsPoint(b, n.cx, n.cy));
    const kinds = [...new Set(held.map((n) => n.kind))].join('+');
    const labelNote = held.reduce((a, n) => a + Math.min(n.w, n.h), 0) / held.length;
    console.log(
      `  #${i} ${b.kind.padEnd(15)} ${b.w}x${b.h} @${b.x},${b.y}  ` +
        `(${(b.w / noteSize).toFixed(2)} x ${(b.h / noteSize).toFixed(2)} notes; label note ${labelNote.toFixed(0)}px)  ` +
        `holds ${held.length} ${arrangement(held, labelNote)} ${kinds}  conf ${b.confidence.toFixed(2)}\n      ` +
        held
          .map((n) => `${n.cx.toFixed(0)},${n.cy.toFixed(0)} ${n.w.toFixed(0)}x${n.h.toFixed(0)}`)
          .join('  '),
    );
    // Why it is merged. INSEPARABLE: one held label's centre lies inside
    // another held label's own rectangle, so ANY box the size of either note
    // holds both centres — the labels overlap that much (a label drawn twice,
    // a pair boxed as one as well as each, or a note lapped more than half
    // over another). CROSS-COLOUR: the notes are of different kinds, so the
    // box is one note whose extent covers a neighbour of another colour.
    // Otherwise it is SAME-COLOUR, the separator's own business.
    const within = (a: (typeof held)[number], b: (typeof held)[number]) =>
      Math.abs(a.cx - b.cx) <= b.w / 2 && Math.abs(a.cy - b.cy) <= b.h / 2;
    const inseparable = held.some((a) => held.some((b) => a !== b && within(a, b)));
    const key = inseparable
      ? 'inseparable'
      : new Set(held.map((n) => n.kind)).size > 1
        ? 'cross-colour'
        : 'same-colour';
    console.log(`      -> ${key}`);
    causes[key] = (causes[key] ?? 0) + 1;
    if (crops) {
      const pad = 8;
      const x0 = Math.max(0, b.x - pad);
      const y0 = Math.max(0, b.y - pad);
      const x1 = Math.min(width, b.x + b.w + pad);
      const y1 = Math.min(height, b.y + b.h + pad);
      const scale = 4;
      const cw = (x1 - x0) * scale;
      const ch = (y1 - y0) * scale;
      const data = new Uint8ClampedArray(cw * ch * 4);
      for (let y = 0; y < ch; y += 1)
        for (let x = 0; x < cw; x += 1) {
          const sx = x0 + Math.floor(x / scale);
          const sy = y0 + Math.floor(y / scale);
          const si = (sy * width + sx) * 4;
          const di = (y * cw + x) * 4;
          data[di] = image.data[si]!;
          data[di + 1] = image.data[si + 1]!;
          data[di + 2] = image.data[si + 2]!;
          data[di + 3] = 255;
        }
      for (const n of held) {
        const px = Math.round((n.cx - x0) * scale);
        const py = Math.round((n.cy - y0) * scale);
        for (let d = -6; d <= 6; d += 1)
          for (const [x, y] of [
            [px + d, py],
            [px, py + d],
          ] as const)
            if (x >= 0 && y >= 0 && x < cw && y < ch) {
              const di = (y * cw + x) * 4;
              data[di] = 255;
              data[di + 1] = 0;
              data[di + 2] = 255;
            }
      }
      const out = `${workDirFor(DIR)}/merged-${name.replace(/\.[^.]+$/, '')}-${i}.png`;
      writeFileSync(out, encodePng({ width: cw, height: ch, data }));
    }
  });
  // Missed notes: where did they go?
  const matchedHit = (n: (typeof notes)[number]) =>
    found.some(
      (b) =>
        Math.hypot(b.x + b.w / 2 - n.cx, b.y + b.h / 2 - n.cy) <= Math.max(n.w, n.h) / 2 &&
        (b.w * b.h) / (n.w * n.h) <= 2 &&
        (b.w * b.h) / (n.w * n.h) >= 0.5,
    );
  const where: Record<string, number> = {};
  for (const n of notes) {
    if (matchedHit(n)) continue;
    const holder = found.find((b) => holdsPoint(b, n.cx, n.cy));
    let why: string;
    if (holder && merged.includes(holder)) why = 'in-merged';
    else if (holder) why = 'in-other-box';
    else {
      let paper = 0;
      let total = 0;
      for (let y = Math.round(n.cy - n.h / 3); y < n.cy + n.h / 3; y += 1)
        for (let x = Math.round(n.cx - n.w / 3); x < n.cx + n.w / 3; x += 1) {
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          total += 1;
          if (mask.classes[y * width + x] !== 0) paper += 1;
        }
      why = paper / Math.max(1, total) > 0.4 ? 'paper-no-box' : 'no-paper';
    }
    where[why] = (where[why] ?? 0) + 1;
  }
  console.log(`  missed: ${JSON.stringify(where)}`);
}
console.log(`\nmerged ${totalMerged}  by cause ${JSON.stringify(causes)}`);
