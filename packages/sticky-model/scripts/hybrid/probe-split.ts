import { classMaskOf, detectStickies } from '../../../sticky-vision/src/detect';
import { HYBRID_RULES } from '../../../sticky-vision/src/hybrid';
import { luminanceOf } from '../../../sticky-vision/src/seam';
import { CUE_OPTIONS, cuesOf } from '../../src/cues';
import { loadHybridWalls } from './walls';

// J1's candidates: every box (after the kept rules) holding two or more model
// notes of a fair size, with what lies BETWEEN each pair of cores: how much of
// the gap the class mask calls paper, and how dark it is against the cores. A
// line drawn across one note should read as ink; two notes flush, as paper.
// Marked by what the labels say the box is: ONE note or a MERGE of several.
//
//   npx tsx scripts/hybrid/probe-split.ts [--min-area 0.2]

const i = process.argv.indexOf('--min-area');
const minArea = i === -1 ? 0.2 : Number(process.argv[i + 1]);

type R = { x: number; y: number; w: number; h: number };
const cx = (r: R) => r.x + r.w / 2;
const cy = (r: R) => r.y + r.h / 2;
const holds = (b: R, x: number, y: number) =>
  x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

for (const wall of await loadHybridWalls()) {
  const { width, height } = wall.image;
  const cues = cuesOf(wall.probs, width, height, CUE_OPTIONS);
  const found = detectStickies(wall.image, { model: { cues, rules: HYBRID_RULES } });
  const mask = classMaskOf(wall.image);
  const lum = luminanceOf(wall.image).data;
  const median = found.map((b) => b.w * b.h).sort((a, b) => a - b)[found.length >> 1] ?? 1;
  const labels = wall.truth.notes.map((n) => ({
    x: n.x * width,
    y: n.y * height,
    w: n.w * width,
    h: n.h * height,
  }));
  for (const b of found) {
    const inside = cues.notes.filter(
      (n) => holds(b, cx(n.core), cy(n.core)) && n.w * n.h >= minArea * median,
    );
    if (inside.length < 2) continue;
    const held = labels.filter((l) => holds(b, cx(l), cy(l))).length;
    const pairs: string[] = [];
    for (let a = 0; a < inside.length; a += 1)
      for (let c = a + 1; c < inside.length; c += 1) {
        const p = inside[a]!;
        const q = inside[c]!;
        // Sample the straight line between the two core centres, outside both
        // cores: the gap the model calls seam.
        let gap = 0;
        let paper = 0;
        let gapLum = 0;
        let coreLum = 0;
        let coreN = 0;
        const steps = Math.ceil(Math.hypot(cx(q.core) - cx(p.core), cy(q.core) - cy(p.core)));
        for (let s = 0; s <= steps; s += 1) {
          const x = Math.round(cx(p.core) + ((cx(q.core) - cx(p.core)) * s) / steps);
          const y = Math.round(cy(p.core) + ((cy(q.core) - cy(p.core)) * s) / steps);
          const l = lum[y * width + x]!;
          if (holds(p.core, x, y) || holds(q.core, x, y)) {
            coreLum += l;
            coreN += 1;
            continue;
          }
          gap += 1;
          gapLum += l;
          if (mask.classes[y * width + x]! > 0) paper += 1;
        }
        pairs.push(
          `c${p.confidence.toFixed(2)}/${q.confidence.toFixed(2)} gap ${gap}px paper ${gap ? (paper / gap).toFixed(2) : '-'}` +
            ` dark ${gap && coreN ? (gapLum / gap / (coreLum / coreN)).toFixed(2) : '-'}`,
        );
      }
    console.log(
      `${held >= 2 ? 'MERGE' : held === 1 ? 'one  ' : 'none '} ${wall.name.slice(0, 16).padEnd(17)}` +
        ` ${Math.round(cx(b))},${Math.round(cy(b))} ${b.w}x${b.h}  ${pairs.join('  |  ')}`,
    );
  }
}
