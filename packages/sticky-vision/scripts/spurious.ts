import { mkdirSync, writeFileSync } from 'node:fs';
import type { ImageBuffer } from '../src/colour';
import { detectStickies } from '../src/detect';
import { holdsPoint, overlapArea } from '../src/rect';
import { standoutPartsOf } from '../src/standout';
import { brightnessOf, edgeContrastOf, roughnessOf, valueSpreadOf } from '../src/texture';
import { encodePng } from './png';
import { listPhotos, loadPhoto, workDirFor } from './photos';
import { photoDir, score, truthFor } from './truth';

// What every SPURIOUS box is (a detection matching no labelled note), the
// precision group's view of a sweep:
//
//   npx tsx scripts/spurious.ts [photo-substring]
//
// Each box is put in one class by where it lies against the labels:
//   junk      over no labelled note (tape, cardboard, a window, bare wall…)
//   merged    holds the centres of two or more labelled notes (separation)
//   fragment  mostly inside one note and under half its area (separation or
//             assembly: a piece of a real note, not junk)
//   duplicate over a note another box already matched (assembly)
//   oversize  one note plus its surround, over twice its area (fitting)
//   offset    over one note, the right size, centre too far off (fitting)
// and gets a magnified crop, the box in red and the labels in white, in the
// system temp directory (never the repo: the photos are private).

type Rect = { x: number; y: number; w: number; h: number };
const area = (r: Rect) => r.w * r.h;
const centreIn = (r: Rect, o: Rect) => holdsPoint(r, o.x + o.w / 2, o.y + o.h / 2);

function crop(image: ImageBuffer, box: Rect, labels: Rect[], scale = 4): ImageBuffer {
  const pad = Math.round(Math.max(box.w, box.h) * 0.6);
  const x0 = Math.max(0, box.x - pad);
  const y0 = Math.max(0, box.y - pad);
  const x1 = Math.min(image.width, box.x + box.w + pad);
  const y1 = Math.min(image.height, box.y + box.h + pad);
  const w = (x1 - x0) * scale;
  const h = (y1 - y0) * scale;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const s = ((y0 + ((y / scale) | 0)) * image.width + x0 + ((x / scale) | 0)) * 4;
      const d = (y * w + x) * 4;
      data[d] = image.data[s]!;
      data[d + 1] = image.data[s + 1]!;
      data[d + 2] = image.data[s + 2]!;
      data[d + 3] = 255;
    }
  }
  const frame = (r: Rect, ink: [number, number, number], dotted: boolean) => {
    const put = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const d = (y * w + x) * 4;
      data[d] = ink[0];
      data[d + 1] = ink[1];
      data[d + 2] = ink[2];
    };
    const rx = (r.x - x0) * scale;
    const ry = (r.y - y0) * scale;
    const rw = r.w * scale;
    const rh = r.h * scale;
    for (let t = 0; t < rw; t += 1) {
      if (dotted && t % 6 > 2) continue;
      put(Math.round(rx + t), Math.round(ry));
      put(Math.round(rx + t), Math.round(ry + rh - 1));
    }
    for (let t = 0; t < rh; t += 1) {
      if (dotted && t % 6 > 2) continue;
      put(Math.round(rx), Math.round(ry + t));
      put(Math.round(rx + rw - 1), Math.round(ry + t));
    }
  };
  for (const l of labels) frame(l, [255, 255, 255], true);
  frame(box, [255, 0, 0], false);
  return { width: w, height: h, data };
}

const only = process.argv[2];
const dir = photoDir();
const outDir = `${workDirFor(dir)}/spurious`;
mkdirSync(outDir, { recursive: true });
const tally: Record<string, Record<string, number>> = {};
for (const name of listPhotos(dir)) {
  if (only && !name.includes(only)) continue;
  const truth = truthFor(name);
  if (!truth) continue;
  const image = loadPhoto(dir, name);
  const found = detectStickies(image);
  const scored = score(truth, found, image.width, image.height);
  const labels: Rect[] = truth.notes.map((n) => ({
    x: n.x * image.width,
    y: n.y * image.height,
    w: n.w * image.width,
    h: n.h * image.height,
  }));
  const missed = new Set(scored.missed);
  const wall = name.replace(/\.[^.]+$/, '');
  tally[wall] = {};
  console.log(`\n${wall}: ${scored.spurious.length} spurious`);
  scored.spurious.forEach((box, k) => {
    const over = labels
      .map((l, i) => ({
        i,
        l,
        inBox: overlapArea(box, l) / area(box),
        ofLabel: overlapArea(box, l) / area(l),
      }))
      .filter((o) => o.inBox > 0.05)
      .sort((a, b) => b.inBox - a.inBox);
    const covered = over.reduce((s, o) => s + o.inBox, 0);
    const centres = labels.filter((l) => centreIn(box, l)).length;
    const top = over[0];
    const topMissed = top ? missed.has(truth.notes[top.i]!) : false;
    let cls: string;
    if (covered < 0.3) cls = 'junk';
    else if (centres >= 2) cls = 'merged';
    else if (top && top.inBox >= 0.6 && area(box) < area(top.l) / 2)
      cls = topMissed ? 'fragment' : 'fragment-dup';
    else if (top && !topMissed) cls = 'duplicate';
    else if (top && area(box) > area(top.l) * 2) cls = 'oversize';
    else cls = 'offset';
    tally[wall]![cls] = (tally[wall]![cls] ?? 0) + 1;
    const parts = standoutPartsOf(image, box);
    const f = (v: number) => v.toFixed(3);
    console.log(
      `  #${k} ${cls.padEnd(12)} ${box.x},${box.y} ${box.w}x${box.h} ${box.kind.padEnd(12)} over=${f(covered)} ` +
        (top
          ? `top: ${f(top.inBox)} of box, ${f(top.ofLabel)} of label ${Math.round(top.l.w)}x${Math.round(top.l.h)}${topMissed ? ' (missed)' : ''} `
          : '') +
        `| conf=${f(box.confidence)} dS=${f(parts?.saturation ?? 0)} dV=${f(parts?.value ?? 0)} dH=${f(parts?.hue ?? 0)} ` +
        `rough=${f(roughnessOf(image, box))} bright=${f(brightnessOf(image, box))} spread=${f(valueSpreadOf(image, box))} edge=${f(edgeContrastOf(image, box))}`,
    );
    writeFileSync(`${outDir}/${wall}-${k}-${cls}.png`, encodePng(crop(image, box, labels)));
  });
}
console.log('\nby class:');
for (const [wall, t] of Object.entries(tally))
  console.log(`  ${wall.padEnd(18)} ${JSON.stringify(t)}`);
console.log(`crops: ${outDir}`);
