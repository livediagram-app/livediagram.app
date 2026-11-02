import { classMaskOf } from '../src/detect';
import { localFloorsOf, type PaperFloors } from '../src/floors';
import { labImageOf } from '../src/lab';
import { rgbToHsv } from '../src/colour';
import { listPhotos, loadPhoto } from './photos';
import { photoDir, truthFor } from './truth';

// Pixels the classifier calls WALL (lit, not ink): how many a candidate
// "far from the wall in a*b*" rescue would turn into paper inside the
// labelled notes (inset) versus outside every note (grown). Optionally on
// a*b* box-filtered over a radius, a region's colour rather than a pixel's.
//
//   npx tsx scripts/rescue-probe.ts [radius] [photo-substring]
//
// Numbers only.

const radius = Number(process.argv[2] ?? 0);
const only = process.argv[3];
const TS = [8, 10, 12, 14, 16, 18, 20, 24, 28];

function boxFilter(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r <= 0) return src;
  const sat = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y += 1) {
    let row = 0;
    for (let x = 0; x < w; x += 1) {
      row += src[y * w + x]!;
      sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1]! + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const s =
        sat[y1 * (w + 1) + x1]! -
        sat[y0 * (w + 1) + x1]! -
        sat[y1 * (w + 1) + x0]! +
        sat[y0 * (w + 1) + x0]!;
      out[y * w + x] = s / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

const dir = photoDir();
for (const name of listPhotos(dir)) {
  if (only && !name.includes(only)) continue;
  const truth = truthFor(name);
  if (!truth) continue;
  const image = loadPhoto(dir, name);
  const { width: W, height: H, data } = image;
  const mask = classMaskOf(image);
  const field = localFloorsOf(image);
  const lab = labImageOf(image);
  const a = boxFilter(lab.a, W, H, radius);
  const b = boxFilter(lab.b, W, H, radius);
  // 0 off-note, 1 note inset, 2 between
  const zone = new Uint8Array(W * H);
  const noteId = new Int32Array(W * H).fill(-1);
  truth.notes.forEach((n) => {
    const gx = n.w * W * 0.15;
    const gy = n.h * H * 0.15;
    for (
      let y = Math.max(0, Math.floor(n.y * H - gy));
      y < Math.min(H, n.y * H + n.h * H + gy);
      y += 1
    )
      for (
        let x = Math.max(0, Math.floor(n.x * W - gx));
        x < Math.min(W, n.x * W + n.w * W + gx);
        x += 1
      )
        if (zone[y * W + x] === 0) zone[y * W + x] = 2;
  });
  const paperOf = new Map<number, { paper: number; all: number }>();
  truth.notes.forEach((n, k) => {
    const gx = n.w * W * 0.15;
    const gy = n.h * H * 0.15;
    const st = { paper: 0, all: 0 };
    for (let y = Math.ceil(n.y * H + gy); y < n.y * H + n.h * H - gy; y += 1)
      for (let x = Math.ceil(n.x * W + gx); x < n.x * W + n.w * W - gx; x += 1) {
        zone[y * W + x] = 1;
        noteId[y * W + x] = k;
        st.all += 1;
        if (mask.classes[y * W + x]! > 0) st.paper += 1;
      }
    paperOf.set(k, st);
  });
  const inMissed = new Array(TS.length).fill(0);
  const inNote = new Array(TS.length).fill(0);
  const off = new Array(TS.length).fill(0);
  let offTotal = 0;
  const f: PaperFloors = { saturation: 0, value: 0, wallHue: -1 };
  for (let p = 0; p < W * H; p += 1) {
    if (zone[p] === 0) offTotal += 1;
    if (mask.classes[p]! > 0) continue;
    const i = p * 4;
    const hsv = rgbToHsv({ r: data[i]!, g: data[i + 1]!, b: data[i + 2]! });
    field.floorsInto(p % W, (p / W) | 0, f);
    if (hsv.v < f.value) continue;
    const d = Math.hypot(a[p]! - (f.wallA ?? 0), b[p]! - (f.wallB ?? 0));
    for (let t = 0; t < TS.length; t += 1) {
      if (d < TS[t]!) break;
      if (zone[p] === 1) {
        inNote[t] += 1;
        const st = paperOf.get(noteId[p]!)!;
        if (st.paper / st.all < 0.5) inMissed[t] += 1;
      } else if (zone[p] === 0) off[t] += 1;
    }
  }
  console.log(`\n${name} r=${radius}  off-note px ${offTotal}`);
  console.log('  T       ' + TS.map((t) => String(t).padStart(7)).join(''));
  console.log('  missed  ' + inMissed.map((v) => String(v).padStart(7)).join(''));
  console.log('  in-note ' + inNote.map((v) => String(v).padStart(7)).join(''));
  console.log('  off     ' + off.map((v) => String(v).padStart(7)).join(''));
}
