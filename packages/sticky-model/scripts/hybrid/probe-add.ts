import { classMaskOf, detectStickies } from '../../../sticky-vision/src/detect';
import { CUE_OPTIONS, cuesOf } from '../../src/cues';
import { loadHybridWalls } from './walls';

// J2's candidates: every model note the classical detector has no box on,
// with the features a rule could read (core confidence, core size, box size
// against the wall's note, paper under it), marked NOTE when it matches a
// label no classical box matched and JUNK otherwise.
//
//   npx tsx scripts/hybrid/probe-add.ts [--t 0.5] [--min-core 12]

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1]!;
};
const t = Number(arg('t', String(CUE_OPTIONS.coreThreshold)));
const minCore = Number(arg('min-core', '12'));

type R = { x: number; y: number; w: number; h: number };
const cx = (r: R) => r.x + r.w / 2;
const cy = (r: R) => r.y + r.h / 2;
const overlap = (a: R, b: R) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? (w * h) / (a.w * a.h) : 0;
};
const matches = (m: R, l: R) =>
  Math.hypot(cx(m) - cx(l), cy(m) - cy(l)) <= Math.max(l.w, l.h) * 0.5 &&
  (m.w * m.h) / (l.w * l.h) <= 2 &&
  (m.w * m.h) / (l.w * l.h) >= 0.5;

const rows: string[] = [];
for (const wall of await loadHybridWalls()) {
  const { width, height } = wall.image;
  const found = detectStickies(wall.image);
  const cues = cuesOf(wall.probs, width, height, { coreThreshold: t, minCorePixels: minCore });
  const mask = classMaskOf(wall.image);
  const areas = found.map((b) => b.w * b.h).sort((a, b) => a - b);
  const median = areas[Math.floor(areas.length / 2)] ?? 1;
  const labels = wall.truth.notes.map((n) => ({
    x: n.x * width,
    y: n.y * height,
    w: n.w * width,
    h: n.h * height,
  }));
  for (const m of cues.notes) {
    const cover = Math.max(0, ...found.map((b) => overlap(m, b)));
    if (cover >= 0.3) continue;
    let paper = 0;
    let n = 0;
    for (let y = Math.max(0, m.y); y < Math.min(height, m.y + m.h); y += 1)
      for (let x = Math.max(0, m.x); x < Math.min(width, m.x + m.w); x += 1) {
        n += 1;
        if (mask.classes[y * width + x]! > 0) paper += 1;
      }
    const label = labels.findIndex((l) => matches(m, l));
    const takenByClassical = label >= 0 && found.some((b) => matches(b, labels[label]!));
    const verdict = label >= 0 && !takenByClassical ? 'NOTE' : 'junk';
    rows.push(
      `${verdict.padEnd(5)} ${wall.name.slice(0, 16).padEnd(17)} ${Math.round(cx(m))},${Math.round(cy(m))}`.padEnd(
        34,
      ) +
        ` conf ${m.confidence.toFixed(2)}  core ${String(m.corePixels).padStart(5)}  area/med ${((m.w * m.h) / median).toFixed(2)}` +
        `  aspect ${(Math.max(m.w, m.h) / Math.min(m.w, m.h)).toFixed(2)}  fill ${(m.corePixels / (m.w * m.h)).toFixed(2)}` +
        `  paper ${(n ? paper / n : 0).toFixed(2)}  cover ${cover.toFixed(2)}`,
    );
  }
}
console.log(rows.sort().join('\n'));
