import { writeFileSync } from 'node:fs';
import { rgbToHsv, type ImageBuffer } from '../src/colour';
import { detectStickies, type DetectedSticky } from '../src/detect';
import { standoutOf, standoutPartsOf } from '../src/standout';
import { edgeSidesOf, lbpEntropyOf, roughnessOf, valueSpreadOf } from '../src/texture';
import { listPhotos, loadPhoto, workDirFor } from './photos';
import { photoDir, score, truthFor } from './truth';

// Every box the detector keeps, measured and marked NOTE (it matches a
// labelled note) or JUNK (it matches none), so a junk gate can be studied
// against the eight labelled walls (plans/event-storming-photo-95-experiments
// C1–C2). Output goes to the system temp directory: it is derived from
// private photographs and never enters the repo.
//
//   npx tsx scripts/junk-features.ts

export type BoxRow = {
  wall: string;
  note: boolean;
  // Of the boxes that match no note: PAPER when it lies over a labelled note
  // (a half, an offset or a merged box: a fitting fault, not junk), JUNK when
  // it lies over none (tape, cardboard, a window, bare wall).
  paper: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  f: Record<string, number>;
};

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  return s[s.length >> 1] ?? 0;
};

function frameLuma(image: ImageBuffer): number {
  const values: number[] = [];
  for (let i = 0; i < image.data.length; i += 4 * 17) {
    values.push(0.299 * image.data[i]! + 0.587 * image.data[i + 1]! + 0.114 * image.data[i + 2]!);
  }
  return median(values);
}

function insideStats(image: ImageBuffer, s: DetectedSticky) {
  const inset = Math.max(1, Math.round(Math.min(s.w, s.h) * 0.15));
  const sat: number[] = [];
  const val: number[] = [];
  const luma: number[] = [];
  const hx: number[] = [];
  const hy: number[] = [];
  for (let y = s.y + inset; y < s.y + s.h - inset; y += 2) {
    for (let x = s.x + inset; x < s.x + s.w - inset; x += 2) {
      const i = (y * image.width + x) * 4;
      const r = image.data[i]!;
      const g = image.data[i + 1]!;
      const b = image.data[i + 2]!;
      const hsv = rgbToHsv({ r, g, b });
      sat.push(hsv.s);
      val.push(hsv.v);
      luma.push(0.299 * r + 0.587 * g + 0.114 * b);
      hx.push(Math.cos((hsv.h * Math.PI) / 180) * hsv.s);
      hy.push(Math.sin((hsv.h * Math.PI) / 180) * hsv.s);
    }
  }
  const mean = (a: number[]) => a.reduce((p, c) => p + c, 0) / Math.max(1, a.length);
  const std = (a: number[]) => {
    const m = mean(a);
    return Math.sqrt(mean(a.map((v) => (v - m) ** 2)));
  };
  // Chroma spread: how far the pixels scatter round their mean colour on the
  // hue disc, which printed packaging does and one sheet of paper does not.
  const cx = mean(hx);
  const cy = mean(hy);
  const chromaSpread = Math.sqrt(mean(hx.map((v, k) => (v - cx) ** 2 + (hy[k]! - cy) ** 2)));
  return {
    satIn: median(sat),
    valIn: median(val),
    lumaIn: median(luma),
    satStd: std(sat),
    valStd: std(val),
    chromaSpread,
    inkShare: luma.filter((l) => l < median(luma) * 0.8).length / Math.max(1, luma.length),
  };
}

// How much of a box must lie over labelled notes for it to count as paper.
const PAPER_OVERLAP = 0.3;

function overLabel(
  b: { x: number; y: number; w: number; h: number },
  labels: { x: number; y: number; w: number; h: number }[],
): number {
  let covered = 0;
  for (const l of labels) {
    const ox = Math.max(0, Math.min(b.x + b.w, l.x + l.w) - Math.max(b.x, l.x));
    const oy = Math.max(0, Math.min(b.y + b.h, l.y + l.h) - Math.max(b.y, l.y));
    covered += ox * oy;
  }
  return covered / (b.w * b.h);
}

// Every labelled note on every wall: the recall denominator.
export function labelledNotes(): number {
  return listPhotos(photoDir()).reduce((n, name) => n + (truthFor(name)?.notes.length ?? 0), 0);
}

export function collectRows(): BoxRow[] {
  const dir = photoDir();
  const rows: BoxRow[] = [];
  for (const name of listPhotos(dir)) {
    const labels = truthFor(name);
    if (!labels) continue;
    const image = loadPhoto(dir, name);
    const found = detectStickies(image);
    const scored = score(labels, found, image.width, image.height);
    const junk = new Set(scored.spurious);
    const sideMed = median(found.map((s) => Math.sqrt(s.w * s.h)));
    const fl = frameLuma(image);
    const labelBoxes = labels.notes.map((n) => ({
      x: n.x * image.width,
      y: n.y * image.height,
      w: n.w * image.width,
      h: n.h * image.height,
    }));
    const start = rows.length;
    for (const s of found) {
      const st = insideStats(image, s);
      const parts = standoutPartsOf(image, s) ?? { saturation: 1, value: 1, hue: 1 };
      const sides = edgeSidesOf(image, s);
      const edgeDist = Math.min(s.x, s.y, image.width - s.x - s.w, image.height - s.y - s.h);
      rows.push({
        wall: name.replace(/\.[^.]+$/, ''),
        note: !junk.has(s),
        paper: junk.has(s) && overLabel(s, labelBoxes) > PAPER_OVERLAP,
        x: s.x,
        y: s.y,
        w: s.w,
        h: s.h,
        f: {
          standout: Math.min(2, standoutOf(image, s)),
          fill: s.confidence,
          aspect: Math.max(s.w, s.h) / Math.min(s.w, s.h),
          sizeRatio: Math.sqrt(s.w * s.h) / sideMed,
          roughness: roughnessOf(image, s),
          lbp: lbpEntropyOf(image, s),
          edge0: sides[0] ?? 1,
          edge1: sides[1] ?? sides[0] ?? 1,
          edge2: sides[2] ?? sides[1] ?? sides[0] ?? 1,
          edgeMax: sides[sides.length - 1] ?? 1,
          lumaRel: st.lumaIn / Math.max(1, fl),
          satIn: st.satIn,
          valIn: st.valIn,
          satStd: st.satStd,
          valStd: st.valStd,
          chromaSpread: st.chromaSpread,
          edgeDist: edgeDist / sideMed,
          dS: parts.saturation,
          dV: Math.min(3, parts.value),
          dH: parts.hue,
          inkShare: st.inkShare,
          px: Math.sqrt(s.w * s.h),
          spread20: valueSpreadOf(image, s, 0.2),
          spread25: valueSpreadOf(image, s, 0.25),
          spread30: valueSpreadOf(image, s, 0.3),
          orange: s.kind === 'domain-event' ? 1 : 0,
          blue: s.kind === 'command' ? 1 : 0,
        },
      });
    }
    // The frame's own ink level: how much writing a note on THIS photo shows
    // depends on its resolution, so uniformity is judged against the frame.
    const frameRows = rows.slice(start);
    const vs = median(frameRows.map((r) => r.f.valStd!));
    const ink = median(frameRows.map((r) => r.f.inkShare!));
    const rough = median(frameRows.map((r) => r.f.roughness!));
    const val = median(frameRows.map((r) => r.f.valIn!));
    const edge = median(frameRows.map((r) => r.f.edge1!));
    const sp = [20, 25, 30].map((k) => median(frameRows.map((r) => r.f[`spread${k}`]!)));
    for (const r of frameRows) {
      [20, 25, 30].forEach(
        (k, i) => (r.f[`spreadRel${k}`] = r.f[`spread${k}`]! / Math.max(1e-3, sp[i]!)),
      );
      r.f.roughRel = r.f.roughness! / Math.max(1e-3, rough);
      r.f.valRel = r.f.valIn! / Math.max(1e-3, val);
      r.f.edgeRel = r.f.edge1! / Math.max(1e-3, edge);
      r.f.valStdRel = r.f.valStd! / Math.max(1e-3, vs);
      r.f.inkRel = r.f.inkShare! / Math.max(1e-3, ink);
    }
  }
  return rows;
}

const q = (values: number[], at: number) => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * at))] ?? NaN;
};

function main() {
  const rows = collectRows();
  const out = `${workDirFor(photoDir())}/junk-features.json`;
  writeFileSync(out, JSON.stringify(rows));
  const names = Object.keys(rows[0]!.f);
  const notes = rows.filter((r) => r.note);
  const junk = rows.filter((r) => !r.note && !r.paper);
  console.log(
    `${notes.length} note boxes, ${junk.length} junk boxes, ${rows.length - notes.length - junk.length} paper boxes -> ${out}\n`,
  );
  const fmt = (v: number) => v.toFixed(3).padStart(7);
  console.log(
    `${'feature'.padEnd(13)} NOTE p02 p05 p10 p50 p90 p95 p98         | JUNK p05 p25 p50 p75 p95`,
  );
  for (const n of names) {
    const a = notes.map((r) => r.f[n]!);
    const b = junk.map((r) => r.f[n]!);
    console.log(
      `${n.padEnd(13)} ${[0.02, 0.05, 0.1, 0.5, 0.9, 0.95, 0.98].map((t) => fmt(q(a, t))).join('')} | ${[0.05, 0.25, 0.5, 0.75, 0.95].map((t) => fmt(q(b, t))).join('')}`,
    );
  }
  // Per wall: how many junk boxes each single-feature floor/ceiling set at
  // the NOTES' 2nd percentile (fitted on the other seven walls) would take,
  // and how many notes it would cost on the held-out wall.
  const walls = [...new Set(rows.map((r) => r.wall))];
  console.log(
    "\nsingle-feature gates at the other walls' note p02 / p98 (junk removed / notes lost, per wall):",
  );
  for (const n of names) {
    for (const dir of ['min', 'max'] as const) {
      let jr = 0;
      let nl = 0;
      const per: string[] = [];
      for (const wall of walls) {
        const train = notes.filter((r) => r.wall !== wall).map((r) => r.f[n]!);
        const t = dir === 'min' ? q(train, 0.02) : q(train, 0.98);
        const held = rows.filter((r) => r.wall === wall);
        const cut = (r: BoxRow) => (dir === 'min' ? r.f[n]! < t : r.f[n]! > t);
        const j = held.filter((r) => !r.note && !r.paper && cut(r)).length;
        const l = held.filter((r) => r.note && cut(r)).length;
        jr += j;
        nl += l;
        per.push(`${j}/${l}`);
      }
      console.log(
        `  ${n.padEnd(13)} ${dir}  total ${String(jr).padStart(3)}/${String(nl).padStart(3)}   ${per.join(' ')}`,
      );
    }
  }
}

if (process.argv[1]?.endsWith('junk-features.ts')) main();
