import { localFloorsOf } from '../src/floors';
import { listPhotos, loadPhoto } from './photos';
import { photoDir } from './truth';

// The wall's colour per floor tile, as CIELAB chroma (how far from grey the
// wall is there) and hue angle: which walls have a hue worth keeping clear of.
//
//   npx tsx scripts/wall-chroma.ts [photo-substring]
//
// Numbers only: nothing derived from the photographs is written anywhere.

const only = process.argv[2];
const dir = photoDir();
for (const name of listPhotos(dir)) {
  if (only && !name.includes(only)) continue;
  const image = loadPhoto(dir, name);
  const field = localFloorsOf(image);
  const cellW = image.width / field.tilesX;
  const cellH = image.height / field.tilesY;
  console.log(
    `\n${name}  frame: hue ${field.global.wallHue.toFixed(0)} a ${field.global.wallA?.toFixed(1)} b ${field.global.wallB?.toFixed(1)} s>=${field.global.saturation.toFixed(2)}`,
  );
  for (let ty = 0; ty < field.tilesY; ty += 1) {
    const cells: string[] = [];
    for (let tx = 0; tx < field.tilesX; tx += 1) {
      const f = field.floorsAt((tx + 0.5) * cellW, (ty + 0.5) * cellH);
      const c = Math.hypot(f.wallA ?? 0, f.wallB ?? 0);
      cells.push(`${c.toFixed(0).padStart(3)}/${f.wallHue.toFixed(0).padStart(3)}`);
    }
    console.log('  ' + cells.join(' '));
  }
}
