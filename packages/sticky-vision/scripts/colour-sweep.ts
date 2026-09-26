import { classMaskOf, detectStickies } from '../src/detect';
import { listPhotos, loadPhoto } from './photos';
import { meetsBar, photoDir, score, truthFor, type Score } from './truth';

// The calibrate summary, many times over in one process: each argument is one
// setting, `NAME=value[,NAME=value…]`, put into the environment before the
// detector runs, so a knob read from `process.env` while an experiment is open
// can be swept without re-decoding eight photographs per value.
//
//   npx tsx scripts/colour-sweep.ts "" "ES_LAB=1" "ES_LAB=1,ES_LAB_AB=10"
//
// An empty argument is the detector as it stands.

const dir = photoDir();
const photos = listPhotos(dir)
  .map((name) => ({ name, truth: truthFor(name), image: loadPhoto(dir, name) }))
  .filter((p) => p.truth !== null);

const pc = (v: number) => `${(v * 100).toFixed(0)}%`;

function run(setting: string) {
  const assigned: string[] = [];
  for (const pair of setting.split(',').filter(Boolean)) {
    const [k, v] = pair.split('=');
    process.env[k!] = v ?? '1';
    assigned.push(k!);
  }
  const rows: { name: string; s: Score; px: { recall: number; junk: number } }[] = [];
  const started = performance.now();
  for (const p of photos) {
    const found = detectStickies(p.image);
    rows.push({
      name: p.name,
      s: score(p.truth!, found, p.image.width, p.image.height),
      px: process.argv.includes('--pixels')
        ? pixelScore(p.image, p.truth!.notes)
        : { recall: 0, junk: 0 },
    });
  }
  const took = performance.now() - started;
  for (const k of assigned) delete process.env[k];
  const truth = rows.reduce((a, r) => a + r.s.truth, 0);
  const detected = rows.reduce((a, r) => a + r.s.detected, 0);
  const matched = rows.reduce((a, r) => a + r.s.matched, 0);
  const precision = matched / Math.max(1, detected);
  const recall = matched / Math.max(1, truth);
  const f1 = (2 * precision * recall) / Math.max(1e-9, precision + recall);
  const merged = rows.reduce((a, r) => a + r.s.merged, 0);
  const passing = rows.filter((r) => meetsBar(r.s)).length;
  const pxLine = process.argv.includes('--pixels')
    ? `  px-recall ${pc(rows.reduce((a, r) => a + r.px.recall, 0) / rows.length)}  px-junk ${pc(rows.reduce((a, r) => a + r.px.junk, 0) / rows.length)}`
    : '';
  console.log(
    `\n[${setting || 'baseline'}]  TOTAL F1 ${(f1 * 100).toFixed(1)}%  prec ${pc(precision)}  rec ${pc(recall)}  merged ${merged}  ${passing}/${rows.length} pass${pxLine}  ${took.toFixed(0)}ms`,
  );
  if (process.argv.includes('--brief')) return;
  for (const { name, s, px } of rows) {
    console.log(
      `  ${name.replace(/\.[^.]+$/, '').padEnd(18)} F1 ${pc(s.f1).padStart(4)}  prec ${pc(s.precision).padStart(4)}  rec ${pc(s.recall).padStart(4)}  rec-A ${pc(s.recallWithoutActors).padStart(4)}  matched ${String(s.matched).padStart(3)}/${String(s.truth).padStart(3)}  found ${String(s.detected).padStart(3)}  merged ${String(s.merged).padStart(2)}${process.argv.includes('--pixels') ? `  px-recall ${pc(px.recall)} px-junk ${pc(px.junk)}` : ''}`,
    );
  }
}

for (const setting of process.argv.slice(2).filter((a) => !a.startsWith('--'))) run(setting);

// The classifier on its own, before any box is drawn: how much of the paper
// inside the labelled notes (inset 15%) is classified paper, and how much of
// what is classified paper lies outside every labelled note (grown 15%).
function pixelScore(
  image: { width: number; height: number; data: Uint8ClampedArray },
  notes: { x: number; y: number; w: number; h: number }[],
): { recall: number; junk: number } {
  const { width: W, height: H } = image;
  const mask = classMaskOf(image);
  const near = new Uint8Array(W * H);
  let inside = 0;
  let found = 0;
  for (const n of notes) {
    const x0 = n.x * W;
    const y0 = n.y * H;
    const w = n.w * W;
    const h = n.h * H;
    const inset = Math.min(w, h) * 0.15;
    for (
      let y = Math.max(0, Math.floor(y0 - inset));
      y < Math.min(H, Math.ceil(y0 + h + inset));
      y += 1
    ) {
      for (
        let x = Math.max(0, Math.floor(x0 - inset));
        x < Math.min(W, Math.ceil(x0 + w + inset));
        x += 1
      ) {
        near[y * W + x] = 1;
        if (x >= x0 + inset && x < x0 + w - inset && y >= y0 + inset && y < y0 + h - inset) {
          inside += 1;
          if (mask.classes[y * W + x]! > 0) found += 1;
        }
      }
    }
  }
  let paper = 0;
  let junk = 0;
  for (let p = 0; p < W * H; p += 1) {
    if (mask.classes[p]! === 0) continue;
    paper += 1;
    if (!near[p]) junk += 1;
  }
  return { recall: found / Math.max(1, inside), junk: junk / Math.max(1, paper) };
}
