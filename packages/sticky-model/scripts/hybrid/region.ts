import { detectStickies } from '../../../sticky-vision/src/detect';
import { HYBRID_RULES } from '../../../sticky-vision/src/hybrid';
import { CUE_OPTIONS, cuesOf } from '../../src/cues';
import { loadHybridWalls } from './walls';

// Everything in one region of one wall, side by side: the labels, the
// classical boxes (no model), the hybrid boxes and the model's notes
// (experiment group N). Positions and numbers only, never pixels.
//
//   npx tsx scripts/hybrid/region.ts <wall> x0,y0,x1,y1 [--t 0.5]

const [wallName, rect] = process.argv.slice(2);
const [x0, y0, x1, y1] = rect!.split(',').map(Number) as [number, number, number, number];
const i = process.argv.indexOf('--t');
const t = i === -1 ? CUE_OPTIONS.coreThreshold : Number(process.argv[i + 1]);

type R = { x: number; y: number; w: number; h: number };
const inRegion = (r: R) => {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
};
const at = (r: R) =>
  `x ${Math.round(r.x)}-${Math.round(r.x + r.w)} y ${Math.round(r.y)}-${Math.round(r.y + r.h)} (${Math.round(r.w)}x${Math.round(r.h)})`;

for (const wall of await loadHybridWalls()) {
  if (!wall.name.includes(wallName!)) continue;
  const { width, height } = wall.image;
  const cues = cuesOf(wall.probs, width, height, {
    coreThreshold: t,
    minCorePixels: CUE_OPTIONS.minCorePixels,
  });
  const show = (title: string, rs: (R & { extra?: string })[]) => {
    console.log(title);
    for (const r of rs.filter(inRegion).sort((a, b) => a.y - b.y || a.x - b.x))
      console.log(`  ${at(r)}${r.extra ? `  ${r.extra}` : ''}`);
  };
  show(
    'labels',
    wall.truth.notes.map((n) => ({
      x: n.x * width,
      y: n.y * height,
      w: n.w * width,
      h: n.h * height,
      extra: n.kind,
    })),
  );
  show(
    'classical',
    detectStickies(wall.image).map((b) => ({ ...b, extra: b.kind })),
  );
  show(
    'hybrid',
    detectStickies(wall.image, { model: { cues, rules: HYBRID_RULES } }).map((b) => ({
      ...b,
      extra: b.kind,
    })),
  );
  show(
    'model',
    cues.notes.map((n) => ({
      ...n,
      extra: `conf ${n.confidence.toFixed(2)} core ${at(n.core)} px ${n.corePixels}`,
    })),
  );
}
