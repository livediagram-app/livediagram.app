import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classMaskOf } from '../src/detect';
import { EVENT_STORMING_NOTES } from '@livediagram/diagram';
import { encodePng } from './png';
import { listPhotos, loadPhoto } from './photos';
import { photoDir } from './truth';

// The class mask of every photo, side by side with the photo, each class in
// its catalogue fill (a pale shade in white), written to the system temp
// directory (never the repo: the photos are private).
//   npx tsx scripts/mask-view.ts [photo-substring]
const filter = process.argv[2] ?? '';
const DIR = photoDir();
for (const name of listPhotos(DIR).filter((n) => n.includes(filter))) {
  const image = loadPhoto(DIR, name);
  const { width, height, data } = image;
  const mask = classMaskOf(image);
  const out = new Uint8ClampedArray(width * 2 * height * 4);
  const hex = EVENT_STORMING_NOTES.map((n) => n.fill ?? '#ff00ff');
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const s = (y * width + x) * 4;
      const l = (y * width * 2 + x) * 4;
      const r = (y * width * 2 + x + width) * 4;
      for (let k = 0; k < 4; k += 1) out[l + k] = data[s + k]!;
      const c = mask.classes[y * width + x]!;
      const h = c === 0 ? '#202020' : (hex[c - 1] ?? '#ffffff');
      const v = parseInt(h.replace('#', '').slice(0, 6), 16);
      out[r] = (v >> 16) & 255;
      out[r + 1] = (v >> 8) & 255;
      out[r + 2] = v & 255;
      out[r + 3] = 255;
    }
  const path = join(tmpdir(), `sticky-mask-${name.replace(/\.[a-z]+$/, '')}.png`);
  writeFileSync(path, encodePng({ width: width * 2, height, data: out }));
  console.log(path);
}
