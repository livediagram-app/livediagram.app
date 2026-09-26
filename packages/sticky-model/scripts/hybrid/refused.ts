import {
  detectStickies,
  holdsPoint,
  HYBRID_RULES,
  type Box,
  type DetectDropReason,
} from '@livediagram/sticky-vision';
import { score } from '../../../sticky-vision/scripts/truth';
import { CUE_OPTIONS, cuesOf } from '../../src/cues';
import { loadHybridWalls } from './walls';

// The boxes the classical gates refuse, against what the model sees in them
// (experiment N5): would bringing back a refused box that holds a model
// core's centre find missed notes, and how much junk with them? Per gate and
// model confidence band, the refused boxes that would match a missed label
// (and are held by no kept box) against those that would not.
//
//   npx tsx scripts/hybrid/refused.ts [--list]

type R = { x: number; y: number; w: number; h: number };
const cx = (r: R) => r.x + r.w / 2;
const cy = (r: R) => r.y + r.h / 2;
// The sweep's own match: centre within half the label's longer side, areas
// within 2x.
const matches = (d: R, l: R) =>
  Math.hypot(cx(d) - cx(l), cy(d) - cy(l)) <= Math.max(l.w, l.h) * 0.5 &&
  d.w * d.h <= 2 * l.w * l.h &&
  l.w * l.h <= 2 * d.w * d.h;
const list = process.argv.includes('--list');
const tally = new Map<string, { note: number; junk: number }>();

for (const wall of await loadHybridWalls()) {
  const { width, height } = wall.image;
  const cues = cuesOf(wall.probs, width, height, CUE_OPTIONS);
  const drops: { box: Box; reason: DetectDropReason }[] = [];
  const found = detectStickies(wall.image, {
    model: { cues, rules: HYBRID_RULES },
    onDrop: (box, reason) => drops.push({ box, reason }),
  });
  const s = score(wall.truth, found, width, height);
  const missed = s.missed.map((m) => ({
    x: m.x * width,
    y: m.y * height,
    w: m.w * width,
    h: m.h * height,
  }));
  for (const { box, reason } of drops) {
    if (found.some((f) => holdsPoint(f, cx(box), cy(box)))) continue;
    const core = cues.notes
      .filter((n) => holdsPoint(box, cx(n.core), cy(n.core)))
      .sort((a, b) => b.confidence - a.confidence)[0];
    const band = core ? `${(Math.floor(core.confidence * 10) / 10).toFixed(1)}` : 'none';
    const key = `${reason.padEnd(16)} core ${band}`;
    const hit = missed.some((l) => matches(box, l));
    const t = tally.get(key) ?? { note: 0, junk: 0 };
    if (hit) t.note += 1;
    else t.junk += 1;
    tally.set(key, t);
    if (list && hit)
      console.log(
        `${wall.name} ${reason} ${Math.round(cx(box))},${Math.round(cy(box))} ${box.w}x${box.h} core ${band}`,
      );
  }
}
for (const [k, v] of [...tally].sort()) console.log(`${k}  notes ${v.note}  junk ${v.junk}`);
