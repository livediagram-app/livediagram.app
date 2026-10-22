import { classMaskOf, detectStickies, type DetectDropReason } from '../src/detect';
import type { Box } from '../src/boxes';
import { holdsPoint, iou } from '../src/rect';
import { standoutOf } from '../src/standout';
import { brightnessOf, edgeContrastOf, roughnessOf, valueSpreadOf } from '../src/texture';
import { listPhotos, loadPhoto } from './photos';
import { photoDir, truthFor } from './truth';

// Which gate loses each note whose paper IS in the mask but gets no box.
//
//   npx tsx scripts/nobox.ts [--all] [--wall <name>]
//
// Runs the detector with a drop tracer, then, for every missed labelled note
// with paper under its centre and no detection over it (merged.ts calls these
// "paper-no-box"), lists every dropped box that holds the note's centre, with
// the gate that dropped it and its size against the note. The DECISIVE drop
// is the one whose box best overlaps the note (IoU). Prints positions and
// numbers only: never pixels, never the handwriting.

const DIR = photoDir();
const onlyWall = process.argv.includes('--wall')
  ? process.argv[process.argv.indexOf('--wall') + 1]
  : undefined;
const verbose = process.argv.includes('--all');

const tally: Record<string, Record<string, number>> = {};
for (const name of listPhotos(DIR)) {
  if (onlyWall && !name.includes(onlyWall)) continue;
  const labels = truthFor(name);
  if (!labels) continue;
  const image = loadPhoto(DIR, name);
  const { width, height } = image;
  const drops: { box: Box; reason: DetectDropReason }[] = [];
  const found = detectStickies(image, { onDrop: (box, reason) => drops.push({ box, reason }) });
  const mask = classMaskOf(image);
  const notes = labels.notes.map((n) => ({
    kind: n.kind,
    x: n.x * width,
    y: n.y * height,
    w: n.w * width,
    h: n.h * height,
    cx: (n.x + n.w / 2) * width,
    cy: (n.y + n.h / 2) * height,
  }));
  const matched = (n: (typeof notes)[number]) =>
    found.some(
      (b) =>
        Math.hypot(b.x + b.w / 2 - n.cx, b.y + b.h / 2 - n.cy) <= Math.max(n.w, n.h) / 2 &&
        (b.w * b.h) / (n.w * n.h) <= 2 &&
        (b.w * b.h) / (n.w * n.h) >= 0.5,
    );
  const byGate: Record<string, number> = {};
  console.log(`\n${name}`);
  for (const n of notes) {
    if (matched(n) || found.some((b) => holdsPoint(b, n.cx, n.cy))) continue;
    let paper = 0;
    let total = 0;
    for (let y = Math.round(n.cy - n.h / 3); y < n.cy + n.h / 3; y += 1)
      for (let x = Math.round(n.cx - n.w / 3); x < n.cx + n.w / 3; x += 1) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        total += 1;
        if (mask.classes[y * width + x] !== 0) paper += 1;
      }
    if (paper / Math.max(1, total) <= 0.4) continue;
    const over = drops
      .filter((d) => iou(d.box, n) > 0.05 || holdsPoint(d.box, n.cx, n.cy))
      .map((d) => ({ ...d, iou: iou(d.box, n) }))
      .sort((a, b) => b.iou - a.iou);
    const decisive = over[0];
    const gate = decisive ? decisive.reason : 'none-traced';
    byGate[gate] = (byGate[gate] ?? 0) + 1;
    const r = { x: Math.round(n.x), y: Math.round(n.y), w: Math.round(n.w), h: Math.round(n.h) };
    const feats =
      `so ${standoutOf(image, r).toFixed(2)} br ${brightnessOf(image, r).toFixed(2)} ` +
      `ro ${roughnessOf(image, r).toFixed(3)} sp ${valueSpreadOf(image, r).toFixed(3)} ` +
      `ed ${edgeContrastOf(image, r).toFixed(3)}`;
    console.log(
      `  ${n.kind.padEnd(15)} ${r.w}x${r.h} @${r.x},${r.y}  -> ${gate.padEnd(11)}` +
        (decisive
          ? ` box ${decisive.box.w}x${decisive.box.h} @${decisive.box.x},${decisive.box.y}` +
            ` iou ${decisive.iou.toFixed(2)} fill ${(decisive.box.pixels / (decisive.box.w * decisive.box.h)).toFixed(2)}`
          : '') +
        `  [label ${feats}]`,
    );
    if (verbose)
      for (const d of over.slice(1))
        console.log(
          `      also ${d.reason.padEnd(11)} ${d.box.w}x${d.box.h} @${d.box.x},${d.box.y} iou ${d.iou.toFixed(2)}`,
        );
  }
  console.log(`  by gate: ${JSON.stringify(byGate)}`);
  tally[name] = byGate;
}
const sum: Record<string, number> = {};
for (const g of Object.values(tally))
  for (const [k, v] of Object.entries(g)) sum[k] = (sum[k] ?? 0) + v;
console.log(`\nTOTAL by gate: ${JSON.stringify(sum)}`);
