import { rgbToHsv } from '../src/colour';
import { rgbToLabInto } from '../src/lab';
import { localFloorsOf } from '../src/floors';
import { classifyRgb } from '../src/classify';
import { loadPhoto } from './photos';
import { photoDir } from './truth';

// The mean colour of a 5x5 patch at each point, with the local floors there
// and the class the patch gets. Numbers only.
//   npx tsx scripts/pixel-probe.ts <photo> x,y [x,y ...]
const [name = '', ...pts] = process.argv.slice(2);
const image = loadPhoto(photoDir(), name);
const field = localFloorsOf(image);
for (const p of pts) {
  const [x, y] = p.split(',').map(Number) as [number, number];
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let dy = -2; dy <= 2; dy += 1)
    for (let dx = -2; dx <= 2; dx += 1) {
      const i = ((y + dy) * image.width + x + dx) * 4;
      r += image.data[i]!;
      g += image.data[i + 1]!;
      b += image.data[i + 2]!;
      n += 1;
    }
  r /= n;
  g /= n;
  b /= n;
  const hsv = rgbToHsv({ r, g, b });
  const lab = rgbToLabInto(r, g, b, { l: 0, a: 0, b: 0 });
  const f = field.floorsAt(x, y);
  console.log(
    `${p}: rgb ${r.toFixed(0)},${g.toFixed(0)},${b.toFixed(0)} h${hsv.h.toFixed(0)} s${hsv.s.toFixed(2)} v${hsv.v.toFixed(2)} Lab ${lab.l.toFixed(0)},${lab.a.toFixed(1)},${lab.b.toFixed(1)} | floor s${f.saturation.toFixed(2)} v${f.value.toFixed(2)} hue${f.wallHue.toFixed(0)} ab${f.wallA?.toFixed(1)},${f.wallB?.toFixed(1)} wv${f.wallValue?.toFixed(2)} -> ${classifyRgb(r, g, b, f)}`,
  );
}
