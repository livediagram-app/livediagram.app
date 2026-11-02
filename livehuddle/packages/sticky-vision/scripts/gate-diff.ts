import { detectStickies, type DetectedSticky } from '../src/detect';
import { standoutOf } from '../src/standout';
import { brightnessOf, edgeContrastOf, roughnessOf, valueSpreadOf } from '../src/texture';
import { listPhotos, loadPhoto } from './photos';
import { photoDir, score, truthFor } from './truth';

// What a change to a gate ADDS and REMOVES, box by box.
//
//   npx tsx scripts/gate-diff.ts KEY=VALUE [KEY=VALUE ...]
//
// Runs the detector twice per wall: once as it is, once with the given
// environment variables set (an experiment's temporary switch), and prints
// every box one run has and the other does not, tagged TP (matches a label),
// MERGED (holds two labelled centres) or FP, with its size against the
// wall's median labelled note and the surface measures the junk gates use.
// Numbers and positions only; never pixels.

const DIR = photoDir();
const vars = process.argv.slice(2).filter((a) => a.includes('='));

const run = (image: Parameters<typeof detectStickies>[0], on: boolean) => {
  const saved: Record<string, string | undefined> = {};
  for (const v of vars) {
    const [k, val] = v.split('=') as [string, string];
    saved[k] = process.env[k];
    if (on) process.env[k] = val;
    else delete process.env[k];
  }
  const out = detectStickies(image);
  for (const [k, val] of Object.entries(saved)) {
    if (val === undefined) delete process.env[k];
    else process.env[k] = val;
  }
  return out;
};

const key = (b: DetectedSticky) => `${b.x},${b.y},${b.w},${b.h}`;
const counts = { addTP: 0, addFP: 0, addMerged: 0, lostTP: 0, lostFP: 0, lostMerged: 0 };
for (const name of listPhotos(DIR)) {
  const truth = truthFor(name);
  if (!truth) continue;
  const image = loadPhoto(DIR, name);
  const { width, height } = image;
  const note = [...truth.notes.map((n) => Math.min(n.w * width, n.h * height))].sort(
    (a, b) => a - b,
  )[truth.notes.length >> 1]!;
  const before = run(image, false);
  const after = run(image, true);
  const tag = (boxes: DetectedSticky[]) => {
    const s = score(
      truth,
      boxes.map((b) => ({ ...b })),
      width,
      height,
    );
    const spurious = new Set(s.spurious.map((b) => `${b.x},${b.y},${b.w},${b.h}`));
    return (b: DetectedSticky) => {
      const held = truth.notes.filter((n) => {
        const cx = (n.x + n.w / 2) * width;
        const cy = (n.y + n.h / 2) * height;
        return cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h;
      }).length;
      if (held >= 2) return 'MERGED';
      return spurious.has(key(b)) ? 'FP' : 'TP';
    };
  };
  const tagBefore = tag(before);
  const tagAfter = tag(after);
  const beforeKeys = new Set(before.map(key));
  const afterKeys = new Set(after.map(key));
  const lines: string[] = [];
  const describe = (sign: string, b: DetectedSticky, t: string) => {
    const r = { x: b.x, y: b.y, w: b.w, h: b.h };
    lines.push(
      `  ${sign} ${t.padEnd(6)} ${b.kind.padEnd(15)} ${b.w}x${b.h} @${b.x},${b.y} ` +
        `(${(Math.min(b.w, b.h) / note).toFixed(2)} x ${(Math.max(b.w, b.h) / note).toFixed(2)} note) ` +
        `fill ${b.confidence.toFixed(2)} so ${standoutOf(image, r).toFixed(2)} ` +
        `br ${brightnessOf(image, r).toFixed(2)} ro ${roughnessOf(image, r).toFixed(3)} ` +
        `sp ${valueSpreadOf(image, r).toFixed(3)} ed ${edgeContrastOf(image, r).toFixed(3)}`,
    );
  };
  for (const b of after)
    if (!beforeKeys.has(key(b))) {
      const t = tagAfter(b);
      describe('+', b, t);
      if (t === 'TP') counts.addTP += 1;
      else if (t === 'FP') counts.addFP += 1;
      else counts.addMerged += 1;
    }
  for (const b of before)
    if (!afterKeys.has(key(b))) {
      const t = tagBefore(b);
      describe('-', b, t);
      if (t === 'TP') counts.lostTP += 1;
      else if (t === 'FP') counts.lostFP += 1;
      else counts.lostMerged += 1;
    }
  if (lines.length > 0)
    console.log(`\n${name} (median note ${note.toFixed(0)}px)\n${lines.join('\n')}`);
}
console.log(`\n${JSON.stringify(counts)}`);
