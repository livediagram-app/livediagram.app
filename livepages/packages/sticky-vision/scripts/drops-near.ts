import { detectStickies } from '../src/detect';
import { loadPhoto } from './photos';
import { photoDir } from './truth';
// Every box a gate drops, and every detection, within r pixels of a point:
// which gate loses the note there, when nobox.ts's best-overlap guess is not
// enough. Positions and numbers only.
//
//   npx tsx scripts/drops-near.ts <photo> x,y [r]
const [name = '', pt = '0,0', rr = '30'] = process.argv.slice(2);
const [px, py] = pt.split(',').map(Number) as [number, number];
const r = Number(rr);
const image = loadPhoto(photoDir(), name);
const near = (b: { x: number; y: number; w: number; h: number }) =>
  Math.abs(b.x + b.w / 2 - px) <= r && Math.abs(b.y + b.h / 2 - py) <= r;
const found = detectStickies(image, {
  onDrop: (b, why) => {
    if (near(b))
      console.log(
        `drop ${why.padEnd(10)} ${b.w}x${b.h}@${b.x},${b.y} c${b.classId} fill ${(b.pixels / (b.w * b.h)).toFixed(2)}`,
      );
  },
});
for (const f of found) if (near(f)) console.log(`kept ${f.kind} ${f.w}x${f.h}@${f.x},${f.y}`);
