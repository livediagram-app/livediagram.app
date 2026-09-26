import { existsSync, writeFileSync } from 'node:fs';
import { classifyRgb } from '../src/classify';
import { wallFloorsOf } from '../src/floors';
import { rgbToHsv, type ImageBuffer } from '../src/colour';
import { classMaskOf, detectStickies, type DetectedSticky } from '../src/detect';
import { labelComponents } from '../src/components';
import { boxOf, fitBoxes, mergeFragments } from '../src/boxes';
import { encodePng } from './png';
import { chromeCacheOf, listPhotos, loadPhoto, workDirFor, workingEdgeFrom } from './photos';
import { renderWorkingImages } from './chrome';
import { BAR, meetsBar, photoDir, score, truthDir, truthFor, type Score } from './truth';

// Calibrating the detector against REAL photographs of a real wall.
//
// A script, not a test: the photos are somebody's actual workshop and never
// enter the repo, so nothing here can run in CI. The unit tests stay synthetic,
// exact and fast; this is the loop you run by hand while moving a threshold.
//
//   npx tsx scripts/calibrate.ts [--photos <dir>] [--edge <px>] [--magick] [--probe x,y,x,y <photo>]
//   (--magick: resample with ImageMagick instead of the editor's own Chromium path)
//
// Reads every JPEG or PNG in the folder (default: this package's gitignored
// `test-files/`), converts each ONCE to the editor's working size and caches
// the decoded RGBA — both under the system temp directory, never in the repo —
// and prints what the detector makes of it: how many stickies, of which kinds,
// where across the frame (left / middle / right thirds, which is how a shade
// gradient shows up as a number), and the wall floors it measured. It also
// writes an overlay PNG per photo with a box round every detection, coloured by
// kind, which is the only honest way to judge "did it find the notes".

const PHOTO_DIR = process.argv.includes('--photos')
  ? process.argv[process.argv.indexOf('--photos') + 1]!
  : photoDir();

const EDGE = workingEdgeFrom(process.argv);

const KIND_INK: Record<string, [number, number, number]> = {
  'domain-event': [255, 0, 0],
  command: [0, 0, 255],
  policy: [160, 0, 255],
  actor: [255, 230, 0],
  'read-model': [0, 200, 0],
  'external-system': [255, 0, 255],
  aggregate: [150, 120, 0],
  hotspot: [0, 255, 255],
};

function overlay(
  image: ImageBuffer,
  boxes: { x: number; y: number; w: number; h: number; kind: string }[],
  truth?: { x: number; y: number; w: number; h: number }[],
): ImageBuffer {
  const data = new Uint8ClampedArray(image.data);
  const put = (x: number, y: number, ink: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
    const i = (y * image.width + x) * 4;
    data[i] = ink[0];
    data[i + 1] = ink[1];
    data[i + 2] = ink[2];
  };
  for (const box of boxes) {
    const ink = KIND_INK[box.kind] ?? [0, 0, 0];
    for (let t = 0; t < 2; t += 1) {
      for (let x = box.x; x < box.x + box.w; x += 1) {
        put(x, box.y + t, ink);
        put(x, box.y + box.h - 1 - t, ink);
      }
      for (let y = box.y; y < box.y + box.h; y += 1) {
        put(box.x + t, y, ink);
        put(box.x + box.w - 1 - t, y, ink);
      }
    }
  }
  // Hand-labelled notes as a dotted white frame UNDER the detections, so a
  // glance at the overlay says which boxes are on paper and which notes have
  // nothing on them at all.
  for (const box of truth ?? []) {
    for (let x = box.x; x < box.x + box.w; x += 3) {
      put(x, box.y, [255, 255, 255]);
      put(x, box.y + box.h - 1, [255, 255, 255]);
    }
    for (let y = box.y; y < box.y + box.h; y += 3) {
      put(box.x, y, [255, 255, 255]);
      put(box.x + box.w - 1, y, [255, 255, 255]);
    }
  }
  return { width: image.width, height: image.height, data };
}

// Detections per horizontal third. A wall lit from one side loses its notes in
// the dark third and nowhere else, so this one line is the whole diagnosis.
function thirds(found: DetectedSticky[], width: number): [number, number, number] {
  const counts: [number, number, number] = [0, 0, 0];
  for (const s of found) {
    const cx = s.x + s.w / 2;
    const band = Math.min(2, Math.floor((cx / width) * 3));
    counts[band as 0 | 1 | 2] += 1;
  }
  return counts;
}

// The median value of the lit pixels in each third: what "the right-hand side
// is darker" is worth in numbers.
function brightnessByThird(image: ImageBuffer): [number, number, number] {
  const buckets = [new Int32Array(101), new Int32Array(101), new Int32Array(101)] as const;
  for (let y = 0; y < image.height; y += 3) {
    for (let x = 0; x < image.width; x += 3) {
      const i = (y * image.width + x) * 4;
      const max = Math.max(image.data[i]!, image.data[i + 1]!, image.data[i + 2]!);
      const band = Math.min(2, Math.floor((x / image.width) * 3));
      buckets[band as 0 | 1 | 2][Math.round((max / 255) * 100)]! += 1;
    }
  }
  return buckets.map((b) => {
    const total = b.reduce((a, c) => a + c, 0);
    let seen = 0;
    for (let i = 0; i < b.length; i += 1) {
      seen += b[i]!;
      if (seen >= total / 2) return i / 100;
    }
    return 0;
  }) as unknown as [number, number, number];
}

function probe(image: ImageBuffer, floors: ReturnType<typeof wallFloorsOf>, spec: string) {
  const nums = spec.split(',').map(Number);
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i]!;
    const y = nums[i + 1]!;
    // A small patch, not one pixel: a single pixel on handwriting says "ink"
    // and tells you nothing about the paper it is written on.
    let best: { h: number; s: number; v: number } | null = null;
    for (let dy = -4; dy <= 4; dy += 2) {
      for (let dx = -4; dx <= 4; dx += 2) {
        const o = ((y + dy) * image.width + (x + dx)) * 4;
        if (o < 0 || o >= image.data.length) continue;
        const hsv = rgbToHsv({ r: image.data[o]!, g: image.data[o + 1]!, b: image.data[o + 2]! });
        if (!best || hsv.v > best.v) best = hsv;
      }
    }
    if (!best) continue;
    const o = (y * image.width + x) * 4;
    const verdict = classifyRgb(image.data[o]!, image.data[o + 1]!, image.data[o + 2]!, floors);
    console.log(
      `    probe (${x},${y}) brightest-of-patch h=${best.h.toFixed(0)} s=${best.s.toFixed(2)} v=${best.v.toFixed(2)}` +
        `  vs floors s>=${floors.saturation.toFixed(2)} v>=${floors.value.toFixed(2)}` +
        `  ${best.s < floors.saturation ? `FAILS saturation by ${(floors.saturation - best.s).toFixed(2)}` : 'clears saturation'},` +
        ` ${best.v < floors.value ? `FAILS value by ${(floors.value - best.v).toFixed(2)}` : 'clears value'}` +
        `  -> ${verdict}`,
    );
  }
}

function report(name: string) {
  const image = loadPhoto(PHOTO_DIR, name, EDGE);
  const floors = wallFloorsOf(image);
  const started = performance.now();
  const found = detectStickies(image);
  const took = performance.now() - started;

  const kinds: Record<string, number> = {};
  for (const s of found) kinds[s.kind] = (kinds[s.kind] ?? 0) + 1;

  // What the mask thinks the whole frame is, sampled: a wall that reads as
  // paper is the failure that hides every other one.
  const mask: Record<string, number> = {};
  for (let i = 0; i < image.data.length; i += 4 * 11) {
    const c = classifyRgb(image.data[i]!, image.data[i + 1]!, image.data[i + 2]!, floors);
    mask[c] = (mask[c] ?? 0) + 1;
  }
  const total = Object.values(mask).reduce((a, b) => a + b, 0);
  const maskPct = Object.entries(mask)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${((v / total) * 100).toFixed(1)}%`)
    .join(', ');

  console.log(`\n${name}  ${image.width}x${image.height}  ${took.toFixed(0)}ms`);
  console.log(
    `  wall floors: s>=${floors.saturation.toFixed(2)} v>=${floors.value.toFixed(2)} hue=${floors.wallHue.toFixed(0)}`,
  );
  const [l, m, r] = thirds(found, image.width);
  const [bl, bm, br] = brightnessByThird(image);
  console.log(
    `  thirds: left ${l} / middle ${m} / right ${r}   median value: ${bl.toFixed(2)} / ${bm.toFixed(2)} / ${br.toFixed(2)}`,
  );
  // Where boxes are lost: raw blobs -> kept -> merged -> split.
  const mask0 = classMaskOf(image, floors);
  const components = labelComponents(mask0);
  const boxes = fitBoxes(components);
  const largest = components.reduce(
    (max, c) => Math.max(max, Math.max(c.maxX - c.minX + 1, c.maxY - c.minY + 1)),
    0,
  );
  console.log(
    `  blobs ${components.length} -> boxes ${boxes.length} -> found ${found.length} (largest blob side ${largest}px)`,
  );
  // The shape of the size distribution, which is what every threshold below
  // the mask is derived from.
  const merged = mergeFragments(
    components.map(boxOf),
    Math.max(2, Math.round(Math.max(image.width, image.height) * 0.006)) / 0.12,
  );
  const mins = merged.map((b) => Math.min(b.w, b.h)).sort((a, b) => a - b);
  const at = (q: number) => mins[Math.floor((mins.length - 1) * q)] ?? 0;
  console.log(
    `  merged ${merged.length} min-side p10=${at(0.1)} p25=${at(0.25)} p50=${at(0.5)} p75=${at(0.75)} p90=${at(0.9)} max=${at(1)}`,
  );
  console.log(`  found ${found.length}: ${JSON.stringify(kinds)}`);
  console.log(`  mask: ${maskPct}`);
  if (process.argv.includes('--boxes')) {
    for (const s of found.slice(0, 80)) {
      const i = ((s.y + Math.floor(s.h / 2)) * image.width + s.x + Math.floor(s.w / 2)) * 4;
      const hsv = rgbToHsv({ r: image.data[i]!, g: image.data[i + 1]!, b: image.data[i + 2]! });
      console.log(
        `    #${String(s.id).padStart(2)} ${s.kind.padEnd(15)} ${String(s.w).padStart(3)}x${String(s.h).padStart(3)} @${String(s.x).padStart(4)},${String(s.y).padStart(4)} row${s.row} h=${hsv.h.toFixed(0).padStart(3)} s=${hsv.s.toFixed(2)} v=${hsv.v.toFixed(2)} conf=${s.confidence.toFixed(2)}`,
      );
    }
  }
  // `--probe x,y[,x,y…] <photo>` — what the pixels at named spots actually
  // are, and which floor they fail, for when a note is missing and the
  // question is why.
  const probeArg = process.argv.indexOf('--probe');
  if (probeArg !== -1 && name.includes(process.argv[probeArg + 2] ?? '')) {
    probe(image, floors, process.argv[probeArg + 1] ?? '');
  }
  // Precision and recall against the hand-labelled truth, when this photo has
  // been labelled. The lists matter more than the percentages: a named missing
  // note is a thing to go and look at, a percentage is not.
  const labels = truthFor(name);
  let scored: Score | null = null;
  if (labels) {
    scored = score(labels, found, image.width, image.height);
    console.log(
      `  TRUTH ${scored.truth} notes: matched ${scored.matched}` +
        `  precision ${(scored.precision * 100).toFixed(0)}%  recall ${(scored.recall * 100).toFixed(0)}%` +
        `  F1 ${(scored.f1 * 100).toFixed(0)}%  kinds right ${scored.kindsRight}/${scored.matched}`,
    );
    const place = (b: { x: number; y: number; w: number; h: number }) =>
      `${Math.round(b.x + b.w / 2)},${Math.round(b.y + b.h / 2)} ${Math.round(b.w)}x${Math.round(b.h)}`;
    console.log(
      `    missed (${scored.missed.length}): ` +
        scored.missed
          .map((n) =>
            place({
              x: n.x * image.width,
              y: n.y * image.height,
              w: n.w * image.width,
              h: n.h * image.height,
            }),
          )
          .join('  '),
    );
    console.log(
      `    spurious (${scored.spurious.length}): ` + scored.spurious.map(place).join('  '),
    );
  }
  const out = `${workDirFor(PHOTO_DIR)}/overlay-${name.replace(/\.[^.]+$/, '')}.png`;
  const truthBoxes = labels?.notes.map((n) => ({
    x: Math.round(n.x * image.width),
    y: Math.round(n.y * image.height),
    w: Math.round(n.w * image.width),
    h: Math.round(n.h * image.height),
  }));
  writeFileSync(out, encodePng(overlay(image, found, truthBoxes)));
  console.log(`  overlay: ${out}`);
  return { name, found: found.length, thirds: [l, m, r] as const, scored, took };
}

async function main() {
  if (!existsSync(PHOTO_DIR)) {
    console.error(`no such folder: ${PHOTO_DIR}`);
    process.exit(1);
  }
  const names = listPhotos(PHOTO_DIR);
  if (names.length === 0) {
    console.error(`no JPEG or PNG photos in ${PHOTO_DIR}`);
    process.exit(1);
  }
  // The editor's own pixels first (scripts/chrome.ts), unless asked for
  // ImageMagick's: the sweep scores the image the product detects on.
  if (!process.argv.includes('--magick')) {
    await renderWorkingImages(PHOTO_DIR, names, EDGE, chromeCacheOf(PHOTO_DIR, EDGE));
  }
  const rows = names.map(report);
  console.log(`\nSUMMARY (${PHOTO_DIR}, working edge ${EDGE}px)   truth: ${truthDir()}\n`);
  const pc = (v: number) => `${(v * 100).toFixed(0)}%`;
  console.log(
    `  ${'photo'.padEnd(26)}${'found'.padStart(7)}${'L/M/R'.padStart(14)}` +
      `${'truth'.padStart(8)}${'prec'.padStart(7)}${'recall'.padStart(8)}${'F1'.padStart(6)}` +
      `${'rec-A'.padStart(7)}${'actors'.padStart(9)}${'merged'.padStart(8)}${'ms'.padStart(7)}  bar`,
  );
  for (const row of rows) {
    const s = row.scored;
    console.log(
      `  ${row.name.replace(/\.[^.]+$/, '').padEnd(26)}${String(row.found).padStart(7)}${row.thirds.join('/').padStart(14)}` +
        (s
          ? `${String(s.truth).padStart(8)}${`${(s.precision * 100).toFixed(0)}%`.padStart(7)}` +
            `${`${(s.recall * 100).toFixed(0)}%`.padStart(8)}${`${(s.f1 * 100).toFixed(0)}%`.padStart(6)}` +
            `${pc(s.recallWithoutActors).padStart(7)}${`${s.actors.matched}/${s.actors.truth}`.padStart(9)}` +
            `${String(s.merged).padStart(8)}${row.took.toFixed(0).padStart(7)}  ${meetsBar(s) ? 'PASS' : 'FAIL'}`
          : `${'-'.padStart(8)}${'-'.padStart(7)}${'-'.padStart(8)}${'-'.padStart(6)}`),
    );
  }
  // ONE number across every labelled wall, summed over NOTES rather than
  // averaged over photos: a wall of 274 notes counts for more than a wall of
  // 41, because it has more notes to get wrong. It is the number a change is
  // judged by — alongside the per-wall rows, which say whether it was paid
  // for by one wall.
  const scored = rows.map((r) => r.scored).filter((s): s is Score => s !== null);
  const truth = scored.reduce((a, s) => a + s.truth, 0);
  const detected = scored.reduce((a, s) => a + s.detected, 0);
  const matched = scored.reduce((a, s) => a + s.matched, 0);
  const precision = detected ? matched / detected : 0;
  const recall = truth ? matched / truth : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const mergedAll = scored.reduce((a, s) => a + s.merged, 0);
  const passing = scored.filter(meetsBar).length;
  console.log(
    `  ${'TOTAL'.padEnd(26)}${String(rows.reduce((a, r) => a + r.found, 0)).padStart(7)}${''.padStart(14)}` +
      (scored.length
        ? `${String(truth).padStart(8)}${`${(precision * 100).toFixed(0)}%`.padStart(7)}` +
          `${`${(recall * 100).toFixed(0)}%`.padStart(8)}${`${(f1 * 100).toFixed(1)}%`.padStart(7)}`
        : '') +
      (scored.length
        ? `${''.padStart(16)}${String(mergedAll).padStart(8)}${rows
            .reduce((a, r) => a + r.took, 0)
            .toFixed(0)
            .padStart(7)}  ${passing}/${scored.length} walls`
        : '') +
      '\n',
  );
  // THE BAR (plans/0007-event-storming-photo-95.md), stated with the table so a
  // run is never read against a remembered one.
  console.log(
    `  bar: recall without actors >= ${pc(BAR.recall)}, precision >= ${pc(BAR.precision)}, merged boxes = ${BAR.merged}, on every wall\n`,
  );
}

void main();
