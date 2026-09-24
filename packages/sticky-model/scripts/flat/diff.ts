import { detectStickies } from '../../../sticky-vision/src/detect';
import { HYBRID_RULES } from '../../../sticky-vision/src/hybrid';
import type { ModelCues } from '../../../sticky-vision/src/model-cues';
import { score } from '../../../sticky-vision/scripts/truth';
import { CUE_OPTIONS, cuesOf } from '../../src/cues';
import { loadHybridWalls } from '../hybrid/walls';

// Where two boundary models part on the labelled walls (group O): every box
// the hybrid gets wrong under one model and right under the other, with what
// each model says there (a core centre inside, the mean background over the
// middle half, the one J3 reads). Positions and numbers only.
//
//   npx tsx scripts/flat/diff.ts <weights A> <weights B>

type R = { x: number; y: number; w: number; h: number };
const [a, b] = process.argv.slice(2);
if (!a || !b) throw new Error('usage: diff.ts <weights A> <weights B>');

const key = (r: R) => `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)}x${Math.round(r.h)}`;

function said(cues: ModelCues, r: R): string {
  const core = cues.notes.find((n) => {
    const x = n.core.x + n.core.w / 2;
    const y = n.core.y + n.core.h / 2;
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  });
  let sum = 0;
  let n = 0;
  for (let y = Math.floor(r.y + r.h / 4); y < r.y + (3 * r.h) / 4; y += 1) {
    for (let x = Math.floor(r.x + r.w / 4); x < r.x + (3 * r.w) / 4; x += 1) {
      sum += cues.background[y * cues.width + x]!;
      n += 1;
    }
  }
  const bg = n ? sum / n / 255 : 0;
  return `bg ${bg.toFixed(2)} core ${core ? core.confidence.toFixed(2) : '-'}`;
}

const wallsA = await loadHybridWalls(a);
const wallsB = await loadHybridWalls(b);
for (let i = 0; i < wallsA.length; i += 1) {
  const wa = wallsA[i]!;
  const wb = wallsB[i]!;
  const { width, height } = wa.image;
  const cuesA = cuesOf(wa.probs, width, height, CUE_OPTIONS);
  const cuesB = cuesOf(wb.probs, width, height, CUE_OPTIONS);
  const sa = score(
    wa.truth,
    detectStickies(wa.image, { model: { cues: cuesA, rules: HYBRID_RULES } }),
    width,
    height,
  );
  const sb = score(
    wb.truth,
    detectStickies(wb.image, { model: { cues: cuesB, rules: HYBRID_RULES } }),
    width,
    height,
  );
  const px = (r: R) => ({ x: r.x * width, y: r.y * height, w: r.w * width, h: r.h * height });
  const lines: string[] = [];
  const spurA = new Set(sa.spurious.map((r) => key(r)));
  const spurB = new Set(sb.spurious.map((r) => key(r)));
  for (const r of sb.spurious)
    if (!spurA.has(key(r)))
      lines.push(`  spurious in B only ${key(r)}  A: ${said(cuesA, r)}  B: ${said(cuesB, r)}`);
  for (const r of sa.spurious)
    if (!spurB.has(key(r)))
      lines.push(`  spurious in A only ${key(r)}  A: ${said(cuesA, r)}  B: ${said(cuesB, r)}`);
  const missA = new Set(sa.missed.map((m) => key(px(m))));
  const missB = new Set(sb.missed.map((m) => key(px(m))));
  for (const m of sb.missed)
    if (!missA.has(key(px(m))))
      lines.push(
        `  missed in B only ${key(px(m))}  A: ${said(cuesA, px(m))}  B: ${said(cuesB, px(m))}`,
      );
  for (const m of sa.missed)
    if (!missB.has(key(px(m))))
      lines.push(
        `  missed in A only ${key(px(m))}  A: ${said(cuesA, px(m))}  B: ${said(cuesB, px(m))}`,
      );
  if (lines.length) console.log(`${wa.name}\n${lines.join('\n')}`);
}
