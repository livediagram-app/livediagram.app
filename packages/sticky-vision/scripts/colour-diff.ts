import { detectStickies } from '../src/detect';
import { listPhotos, loadPhoto } from './photos';
import { photoDir, score, truthFor } from './truth';

// Which labelled notes one setting finds that another does not, per wall:
//
//   npx tsx scripts/colour-diff.ts "<setting A>" "<setting B>" [photo-substring]
//
// A setting is `NAME=value[,…]` as in colour-sweep.ts. A lost note is tagged
// MERGED when a box of B covers its centre along with another note's.

function withEnv<T>(setting: string, fn: () => T): T {
  const keys: string[] = [];
  for (const pair of setting.split(',').filter(Boolean)) {
    const [k, v] = pair.split('=');
    process.env[k!] = v ?? '1';
    keys.push(k!);
  }
  try {
    return fn();
  } finally {
    for (const k of keys) delete process.env[k];
  }
}

const [a = '', b = '', only] = process.argv.slice(2);
const dir = photoDir();
for (const name of listPhotos(dir)) {
  if (only && !name.includes(only)) continue;
  const truth = truthFor(name);
  if (!truth) continue;
  const image = loadPhoto(dir, name);
  const { width: W, height: H } = image;
  const foundB = withEnv(b, () => detectStickies(image));
  const sa = score(
    truth,
    withEnv(a, () => detectStickies(image)),
    W,
    H,
  );
  const sb = score(truth, foundB, W, H);
  const missA = new Set(sa.missed);
  const missB = new Set(sb.missed);
  const centre = (n: { x: number; y: number; w: number; h: number }) => ({
    cx: (n.x + n.w / 2) * W,
    cy: (n.y + n.h / 2) * H,
  });
  const inBox = (
    c: { cx: number; cy: number },
    box: { x: number; y: number; w: number; h: number },
  ) => c.cx >= box.x && c.cx <= box.x + box.w && c.cy >= box.y && c.cy <= box.y + box.h;
  const tag = (n: (typeof truth.notes)[number]) => {
    const c = centre(n);
    const holder = foundB.find((box) => inBox(c, box));
    if (!holder) return 'none';
    const held = truth.notes.filter((m) => inBox(centre(m), holder)).length;
    return held >= 2 ? `MERGED(${held})` : `box ${holder.w}x${holder.h}`;
  };
  const fmt = (n: (typeof truth.notes)[number]) => {
    const c = centre(n);
    return `${n.kind}@${Math.round(c.cx)},${Math.round(c.cy)}`;
  };
  const lost = truth.notes.filter((n) => !missA.has(n) && missB.has(n));
  const gained = truth.notes.filter((n) => missA.has(n) && !missB.has(n));
  const newSpurious = sb.spurious.length - sa.spurious.length;
  console.log(
    `\n${name}: +${gained.length} -${lost.length} notes, spurious ${sa.spurious.length}->${sb.spurious.length} (${newSpurious >= 0 ? '+' : ''}${newSpurious}), merged ${sa.merged}->${sb.merged}`,
  );
  if (gained.length) console.log(`  gained: ${gained.map(fmt).join('  ')}`);
  if (lost.length) console.log(`  lost:   ${lost.map((n) => `${fmt(n)} [${tag(n)}]`).join('  ')}`);
}
