import { classMaskOf, detectStickies } from '../src/detect';
import type { Box } from '../src/boxes';
import { listPhotos, loadPhoto } from './photos';
import { photoDir, truthFor } from './truth';

// Which boxes the size floor refuses could be the visible part of a note
// lapped under a neighbour, and what completing them would find.
//
//   npx tsx scripts/amodal-probe.ts
//
// For every box refused by the size floor: its sides against the wall's
// note, how much paper lies just beyond each side (the occluder), and
// whether the box completed to a square on its long side, grown under the
// side with the most paper beyond it, would match a labelled note the
// detector missed. Prints numbers only.

const DIR = photoDir();
const BAND = 2;

function beyond(
  mask: { width: number; height: number; classes: Uint8Array },
  b: Box,
  side: 'n' | 's' | 'w' | 'e',
): number {
  let paper = 0;
  let n = 0;
  for (let k = 1; k <= BAND; k += 1) {
    const along = side === 'n' || side === 's' ? b.w : b.h;
    for (let t = 0; t < along; t += 1) {
      const x = side === 'w' ? b.x - k : side === 'e' ? b.x + b.w - 1 + k : b.x + t;
      const y = side === 'n' ? b.y - k : side === 's' ? b.y + b.h - 1 + k : b.y + t;
      if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) continue;
      n += 1;
      const c = mask.classes[y * mask.width + x]!;
      if (c !== 0 && c !== b.classId) paper += 1;
      else if (c === b.classId) paper += 0.5;
    }
  }
  return n === 0 ? 0 : paper / n;
}

for (const name of listPhotos(DIR)) {
  const truth = truthFor(name);
  if (!truth) continue;
  const image = loadPhoto(DIR, name);
  const { width, height } = image;
  const mask = classMaskOf(image);
  const dropped: Box[] = [];
  const found = detectStickies(image, { onDrop: (b, r) => r === 'size-floor' && dropped.push(b) });
  const labels = truth.notes.map((n) => ({
    cx: (n.x + n.w / 2) * width,
    cy: (n.y + n.h / 2) * height,
    w: n.w * width,
    h: n.h * height,
  }));
  const matches = (
    b: { x: number; y: number; w: number; h: number },
    l: (typeof labels)[number],
  ) => {
    const d = Math.hypot(b.x + b.w / 2 - l.cx, b.y + b.h / 2 - l.cy);
    const ratio = (b.w * b.h) / (l.w * l.h);
    return d <= Math.max(l.w, l.h) * 0.5 && ratio <= 2 && ratio >= 0.5;
  };
  const missed = labels.filter((l) => !found.some((f) => matches(f, l)));
  console.log(`\n${name}  size-floor drops ${dropped.length}  missed ${missed.length}`);
  for (const b of dropped) {
    const horizontal = b.w >= b.h;
    const sides = horizontal ? (['n', 's'] as const) : (['w', 'e'] as const);
    const [a, z] = sides.map((s) => beyond(mask, b, s));
    const long = Math.max(b.w, b.h);
    const grow = long - Math.min(b.w, b.h);
    const towardsStart = a! > z!;
    const done = horizontal
      ? { x: b.x, y: towardsStart ? b.y - grow : b.y, w: b.w, h: long }
      : { x: towardsStart ? b.x - grow : b.x, y: b.y, w: long, h: b.h };
    const hit = missed.some((l) => matches(done, l));
    const holds = labels.filter(
      (l) => l.cx >= done.x && l.cx <= done.x + done.w && l.cy >= done.y && l.cy <= done.y + done.h,
    ).length;
    console.log(
      `  ${b.w}x${b.h} @${b.x},${b.y} short/long ${(Math.min(b.w, b.h) / long).toFixed(2)} beyond ${a!.toFixed(2)}/${z!.toFixed(2)} fill ${(b.pixels / (b.w * b.h)).toFixed(2)} -> ${hit ? 'NOTE' : 'junk'}${holds >= 2 ? ' MERGED' : ''}`,
    );
  }
}
