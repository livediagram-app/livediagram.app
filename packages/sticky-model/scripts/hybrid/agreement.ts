import { detectStickies, iou } from '@livediagram/sticky-vision';
import { score } from '../../../sticky-vision/scripts/truth';
import { CUE_OPTIONS, cuesOf } from '../../src/cues';
import { loadHybridWalls } from './walls';

// How well each classical box agrees with the boundary model (experiment N):
// per box, the best IoU with a sure model note (confidence >= --c), binned,
// for boxes that match a label and boxes that do not (spurious or merged).
// Numbers only.
//
//   npx tsx scripts/hybrid/agreement.ts [--c 0.7]

const i = process.argv.indexOf('--c');
const minConf = i === -1 ? 0.7 : Number(process.argv[i + 1]);
type R = { x: number; y: number; w: number; h: number };
const bins = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.01];
const binOf = (v: number) => bins.findIndex((b, k) => v >= b && v < bins[k + 1]!);
console.log(`best IoU with a sure note (conf >= ${minConf}); bins ${bins.slice(0, -1).join(' ')}`);
for (const wall of await loadHybridWalls()) {
  const { width, height } = wall.image;
  const cues = cuesOf(wall.probs, width, height, CUE_OPTIONS);
  const sure = cues.notes.filter((n) => n.confidence >= minConf);
  const found = detectStickies(wall.image);
  const s = score(wall.truth, found, width, height);
  const bad = new Set<R>(s.spurious as R[]);
  const good = new Array(bins.length - 1).fill(0);
  const wrong = new Array(bins.length - 1).fill(0);
  for (const b of found) {
    const best = sure.reduce((m, n) => Math.max(m, iou(n, b)), 0);
    (bad.has(b) ? wrong : good)[binOf(best)] += 1;
  }
  console.log(
    `${wall.name.padEnd(22)} match ${good.map((v) => String(v).padStart(4)).join('')}   spurious ${wrong.map((v) => String(v).padStart(3)).join('')}`,
  );
}
