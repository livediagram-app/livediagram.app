import {
  classMaskOf,
  detectStickies,
  holdsPoint,
  HYBRID_RULES,
  iou,
  type Box,
  type DetectDropReason,
} from '@livediagram/sticky-vision';
import { score } from '../../../sticky-vision/scripts/truth';
import { CUE_OPTIONS, cuesOf } from '../../src/cues';
import { loadHybridWalls } from './walls';

// Where each note the HYBRID detector misses is lost (experiment group N).
//
//   npx tsx scripts/hybrid/misses.ts [--wall 201743,whiteboard] [--t 0.5]
//
// Per missed label: whether a detection holds its centre (merged into a
// neighbour's box, or another box), the paper fraction under it, the
// classical drop that best overlaps it (gate and IoU), and the model note
// that best overlaps it with every number the add rule reads (confidence,
// area against the median box, paper, and whether a box holds its centre or
// it holds a box's). Positions and numbers only: never pixels.

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1]!;
};
const only = arg('wall')?.split(',');
const t = Number(arg('t') ?? CUE_OPTIONS.coreThreshold);

type R = { x: number; y: number; w: number; h: number };
const cx = (r: R) => r.x + r.w / 2;
const cy = (r: R) => r.y + r.h / 2;
const centreIn = (r: R, b: R) => holdsPoint(b, cx(r), cy(r));
const at = (r: R) =>
  `${Math.round(cx(r))},${Math.round(cy(r))} ${Math.round(r.w)}x${Math.round(r.h)}`;

for (const wall of await loadHybridWalls()) {
  if (only && !only.some((o) => wall.name.includes(o))) continue;
  const { width, height } = wall.image;
  const cues = cuesOf(wall.probs, width, height, {
    coreThreshold: t,
    minCorePixels: CUE_OPTIONS.minCorePixels,
  });
  const drops: { box: Box; reason: DetectDropReason }[] = [];
  const found = detectStickies(wall.image, {
    model: { cues, rules: HYBRID_RULES },
    onDrop: (box, reason) => drops.push({ box, reason }),
  });
  const s = score(wall.truth, found, width, height);
  const mask = classMaskOf(wall.image);
  const areas = found.map((b) => b.w * b.h).sort((a, b) => a - b);
  const median = areas[Math.floor(areas.length / 2)] ?? 1;
  const paperOf = (b: R) => {
    let paper = 0;
    let n = 0;
    for (let y = Math.max(0, Math.round(b.y)); y < Math.min(height, b.y + b.h); y += 1)
      for (let x = Math.max(0, Math.round(b.x)); x < Math.min(width, b.x + b.w); x += 1) {
        if (mask.classes[y * width + x]! > 0) paper += 1;
        n += 1;
      }
    return n ? paper / n : 0;
  };
  const labels = wall.truth.notes.map((n) => ({
    x: n.x * width,
    y: n.y * height,
    w: n.w * width,
    h: n.h * height,
    kind: n.kind,
    note: n,
  }));
  console.log(
    `\n${wall.name}  found ${found.length}  missed ${s.missed.length}  spurious ${s.spurious.length}  merged ${s.merged}  median box ${Math.round(Math.sqrt(median))}px`,
  );
  for (const m of s.missed) {
    const l = { x: m.x * width, y: m.y * height, w: m.w * width, h: m.h * height };
    const inter = (a: R, b: R) =>
      Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    // The most of it (or of the other, whichever is smaller) another label covers.
    const lap = labels
      .filter((o) => o.note !== m)
      .reduce((m, o) => Math.max(m, inter(o, l) / Math.min(o.w * o.h, l.w * l.h)), 0);
    const holder = found.find((b) => centreIn(l, b));
    const held = holder ? labels.filter((o) => centreIn(o, holder)).length : 0;
    const inHolder = holder
      ? cues.notes
          .filter((n) => centreIn(n.core, holder))
          .map((n) => `${at(n)} c${n.confidence.toFixed(2)} a${((n.w * n.h) / median).toFixed(2)}`)
          .join('; ')
      : '';
    const where = holder
      ? `${held >= 2 ? `MERGED(${held})` : 'IN'} ${at(holder)} cores [${inHolder}]`
      : 'no box';
    const drop = drops.map((d) => ({ ...d, iou: iou(d.box, l) })).sort((a, b) => b.iou - a.iou)[0];
    const dropText =
      drop && drop.iou > 0.1 ? `${drop.reason} ${at(drop.box)} iou ${drop.iou.toFixed(2)}` : '-';
    const note = cues.notes.map((n) => ({ n, iou: iou(n, l) })).sort((a, b) => b.iou - a.iou)[0];
    let modelText = 'model: none';
    if (note && note.iou > 0.05) {
      const n = note.n;
      const cover = found.find((b) => centreIn(n, b) || centreIn(b, n));
      const covered = cover !== undefined;
      modelText =
        `model ${at(n)} iou ${note.iou.toFixed(2)} conf ${n.confidence.toFixed(2)} ` +
        `area ${((n.w * n.h) / median).toFixed(2)} paper ${paperOf(n).toFixed(2)}${covered ? ` COVERED by ${at(cover)}` : ''}`;
    }
    console.log(
      `  ${m.kind.padEnd(13)} ${at(l).padEnd(16)} paper ${paperOf(l).toFixed(2)} lap ${lap.toFixed(2)}  ${where}\n      drop: ${dropText}\n      ${modelText}`,
    );
  }
  for (const b of s.spurious) console.log(`  spurious ${at(b)}`);
}
