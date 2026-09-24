import { rgbToHsv } from '../src/colour';
import { rgbToLabInto } from '../src/lab';
import { listPhotos, loadPhoto } from './photos';
import { photoDir, truthFor } from './truth';

// Per labelled note of the given kinds: median hue, saturation and a*b* of
// the saturated-enough pixels in the middle of its label. Numbers only.
//   npx tsx scripts/kind-hues.ts kind[,kind...]
const kinds = new Set((process.argv[2] ?? 'command,policy').split(','));
const DIR = photoDir();
const med = (v: number[]) => [...v].sort((a, b) => a - b)[v.length >> 1] ?? NaN;
for (const name of listPhotos(DIR)) {
  const labels = truthFor(name);
  if (!labels) continue;
  const image = loadPhoto(DIR, name);
  const { width, height, data } = image;
  for (const n of labels.notes) {
    if (!kinds.has(n.kind)) continue;
    const hs: number[] = [],
      ss: number[] = [],
      as: number[] = [],
      bs: number[] = [];
    for (let y = Math.round((n.y + n.h * 0.2) * height); y < (n.y + n.h * 0.8) * height; y += 1)
      for (let x = Math.round((n.x + n.w * 0.2) * width); x < (n.x + n.w * 0.8) * width; x += 1) {
        const i = (y * width + x) * 4;
        const hsv = rgbToHsv({ r: data[i]!, g: data[i + 1]!, b: data[i + 2]! });
        if (hsv.s < 0.1 || hsv.v < 0.25) continue;
        const lab = rgbToLabInto(data[i]!, data[i + 1]!, data[i + 2]!, { l: 0, a: 0, b: 0 });
        hs.push(hsv.h);
        ss.push(hsv.s);
        as.push(lab.a);
        bs.push(lab.b);
      }
    console.log(
      `${name.slice(0, 16).padEnd(16)} ${n.kind.padEnd(8)} @${Math.round((n.x + n.w / 2) * width)},${Math.round((n.y + n.h / 2) * height)} h${med(hs).toFixed(0)} s${med(ss).toFixed(2)} ab ${med(as).toFixed(0)},${med(bs).toFixed(0)} n${hs.length}`,
    );
  }
}
