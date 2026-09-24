import { classMaskOf } from '../src/detect';
import { listPhotos, loadPhoto } from './photos';
import { photoDir, truthFor } from './truth';

// For each labelled note: how much of the paper inside the middle of its label
// is its dominant class. Notes whose paper is split between classes.
//   npx tsx scripts/mixed-kinds.ts
const DIR = photoDir();
for (const name of listPhotos(DIR)) {
  const labels = truthFor(name);
  if (!labels) continue;
  const image = loadPhoto(DIR, name);
  const { width, height } = image;
  const mask = classMaskOf(image);
  const out: string[] = [];
  for (const n of labels.notes) {
    const x0 = Math.round((n.x + n.w * 0.15) * width);
    const x1 = Math.round((n.x + n.w * 0.85) * width);
    const y0 = Math.round((n.y + n.h * 0.15) * height);
    const y1 = Math.round((n.y + n.h * 0.85) * height);
    const counts = new Map<number, number>();
    let paper = 0;
    for (let y = y0; y < y1; y += 1)
      for (let x = x0; x < x1; x += 1) {
        const c = mask.classes[y * width + x]!;
        if (c === 0) continue;
        paper += 1;
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    const top = Math.max(0, ...counts.values());
    const share = paper ? top / paper : 1;
    if (share < 0.8 && paper > 20)
      out.push(
        `${n.kind}@${Math.round((n.x + n.w / 2) * width)},${Math.round((n.y + n.h / 2) * height)} share ${share.toFixed(2)} paper ${(paper / ((x1 - x0) * (y1 - y0))).toFixed(2)} ${JSON.stringify([...counts])}`,
      );
  }
  console.log(`${name}: ${out.length} mixed`);
  for (const o of out) console.log(`  ${o}`);
}
