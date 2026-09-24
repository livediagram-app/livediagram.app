// Scratch, NEVER COMMITTED: where does each missed note get lost?
import { classMaskOf, detectStickies } from './src/detect';
import { labelComponents, closePaperMask } from './src/components';
import { estimateNoteSize, fitBoxes } from './src/boxes';
import { standsOut } from './src/standout';
import { loadPhoto, listPhotos } from './scripts/photos';
import { photoDir, score, truthFor } from './scripts/truth';
import * as D from './src/detect';

const dir = photoDir();
const tally: Record<string, number> = {};
for (const file of listPhotos(dir)) {
  const name = file.replace(/\.[^.]+$/, '');
  const truth = truthFor(name);
  if (!truth) continue;
  const image = loadPhoto(dir, file);
  const W = image.width, H = image.height;
  const mask = classMaskOf(image);
  const imageSize = Math.max(W, H);
  const noiseFloor = Math.max(4, Math.round(imageSize * 0.008));
  const noteSize = estimateNoteSize(
    labelComponents(mask).map((c) => ({ classId: c.classId, x: c.minX, y: c.minY, w: c.maxX - c.minX + 1, h: c.maxY - c.minY + 1, pixels: c.pixels })),
    noiseFloor,
  );
  const radius = (D as any).closeRadiusFor ? (D as any).closeRadiusFor(noteSize, imageSize) : undefined;
  const closed = closePaperMask(mask, radius ? { radius } : {});
  const pre = fitBoxes(labelComponents(closed), { imageSize, noteSize, mask: closed, seams: mask });
  const found = detectStickies(image);
  const s = score(truth, found as never, W, H);
  const reasons: Record<string, number> = {};
  const centreIn = (b: { x: number; y: number; w: number; h: number }, n: { x: number; y: number; w: number; h: number }) => {
    const cx = (n.x + n.w / 2) * W, cy = (n.y + n.h / 2) * H;
    return cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h;
  };
  for (const n of s.missed) {
    // 1. How much of the note's inner half is paper in the raw colour mask?
    const x0 = Math.round((n.x + n.w * 0.25) * W), x1 = Math.round((n.x + n.w * 0.75) * W);
    const y0 = Math.round((n.y + n.h * 0.25) * H), y1 = Math.round((n.y + n.h * 0.75) * H);
    let paper = 0, all = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { all++; if (mask.classes[y * W + x] !== 0) paper++; }
    const cover = all ? paper / all : 0;
    let why: string;
    if (cover < 0.25) why = 'colour: paper not in mask';
    else {
      const holder = pre.filter((b) => centreIn(b, n));
      const tw = n.w * W, th = n.h * H;
      if (holder.length === 0) why = 'assembly: no box made (size/fill/aspect floors)';
      else {
        const b = holder[0]!;
        const areaRatio = (b.w * b.h) / (tw * th);
        if (areaRatio > 2) why = 'merged: its box also holds other notes';
        else if (areaRatio < 0.5) why = 'split: its box is a fragment';
        else if (!standsOut(image, b)) why = 'standout gate refused it';
        else why = 'other (matching tolerance)';
      }
    }
    reasons[why] = (reasons[why] ?? 0) + 1;
    tally[why] = (tally[why] ?? 0) + 1;
  }
  console.log(`${name.padEnd(18)} missed ${String(s.missed.length).padStart(3)} | noteSize ${noteSize} |`, Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join('; '));
}
console.log('\nALL:', Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join('\n     '));
