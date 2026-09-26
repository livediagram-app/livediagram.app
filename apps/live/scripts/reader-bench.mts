// Benchmarking the IN-BROWSER readers against labelled walls (docs/specs/021-event-storming/event-storming.md Phase 9,
// docs/vision/handwriting-readers.md).
//
// A script, not a test: the photographs and their words are somebody's real
// workshop, kept in the private truths repository, so nothing here runs in CI
// and nothing it prints may be committed. It exists so the choice of the
// in-browser reader, and the guards around it, stay MEASUREMENTS.
//
//   pnpm --filter @livediagram/live exec tsx scripts/reader-bench.mts \
//     --reader smolvlm-256m [--edge 48] [--set words|tiny] [--out /tmp/x.json]
//
// Crops are cut the way the editor cuts them (photo-detect.ts): from the
// FULL-resolution photo, padded 6% a side, at most CROP_MAX_EDGE_PX on the long
// edge, JPEG at 0.85 — but round the LABELLED boxes rather than the detector's,
// so a detector miss never scores as a reader miss. `--edge N` shrinks each
// crop until its SHORT edge is N pixels, which is how the minimum readable
// size is measured on notes whose words are known.
//
// Node runs the models on onnxruntime-node (CPU). The answers match the
// browser's WASM path; the speed does not, so time in-browser separately.
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { CROP_MAX_EDGE_PX } from '@livediagram/api-schema';
import { cropRects, type DetectedSticky } from '../../../packages/sticky-vision/src';
import { photoDir, truthFor } from '../../../packages/sticky-vision/scripts/truth';
import { READERS, type BenchReader } from './reader-bench-readers.mts';
import { sharp } from './reader-bench-sharp.mts';

const arg = (name: string, fallback?: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};

// The walls whose notes carry their true words, and the one whose notes are too
// small for any reader (a whiteboard shot from across the room: ~25 px notes).
const SETS: Record<string, string[]> = {
  words: ['20260920_201707', '20260920_201730'],
  tiny: ['whiteboard-dense'],
};

const CROP_DIR = '/tmp/reader-bench-crops';

export type BenchCrop = {
  wall: string;
  index: number;
  truth: string | null;
  // The crop as sent: its size in pixels, and the JPEG, written to a private
  // temp folder (node's image reader takes paths, not data URLs).
  width: number;
  height: number;
  image: string;
};

async function cropsOf(wall: string, edge: number | undefined): Promise<BenchCrop[]> {
  const truth = truthFor(wall);
  if (!truth) throw new Error(`no label for ${wall}`);
  const photo = sharp(`${photoDir()}/${wall}.jpg`).rotate();
  const { data, info } = await photo.raw().toBuffer({ resolveWithObject: true });
  const full = { width: info.width, height: info.height };
  // The label's boxes, in full-resolution pixels, as the detector's would be.
  const boxes: DetectedSticky[] = truth.notes.map((n, index) => ({
    id: index,
    kind: 'domain-event',
    size: 'square',
    x: n.x * full.width,
    y: n.y * full.height,
    w: n.w * full.width,
    h: n.h * full.height,
    row: 0,
    order: index,
    confidence: 1,
  }));
  const out: BenchCrop[] = [];
  for (const r of cropRects(boxes, 1)) {
    const w = Math.min(r.w, full.width - r.x);
    const h = Math.min(r.h, full.height - r.y);
    let scale = Math.min(1, CROP_MAX_EDGE_PX / Math.max(w, h));
    if (edge !== undefined) scale = Math.min(scale, edge / Math.min(w, h));
    const width = Math.max(1, Math.round(w * scale));
    const height = Math.max(1, Math.round(h * scale));
    const jpeg = await sharp(data, { raw: info })
      .extract({ left: r.x, top: r.y, width: w, height: h })
      .resize(width, height)
      .jpeg({ quality: 85 })
      .toBuffer();
    const note = truth.notes[r.id]!;
    const file = `${CROP_DIR}/${wall}-${r.id}-${edge ?? 'full'}.jpg`;
    // Written aside and renamed in: a second bench cutting the same crops must
    // never truncate one while this one's reader has it open.
    writeFileSync(`${file}.${process.pid}`, jpeg);
    renameSync(`${file}.${process.pid}`, file);
    out.push({
      wall,
      index: r.id,
      truth: typeof note.text === 'string' ? note.text : null,
      width,
      height,
      image: file,
    });
  }
  return out;
}

async function main() {
  const name = arg('reader', 'smolvlm-256m')!;
  const reader: BenchReader | undefined = READERS[name];
  if (!reader) throw new Error(`unknown reader ${name}; one of ${Object.keys(READERS).join(', ')}`);
  const set = arg('set', 'words')!;
  const edgeArg = arg('edge');
  const edge = edgeArg === undefined ? undefined : Number(edgeArg);
  const limit = Number(arg('limit', '100000'));
  const out = arg('out', `/tmp/reader-bench-${name}-${set}${edge ? `-${edge}` : ''}.json`)!;

  mkdirSync(CROP_DIR, { recursive: true });
  const crops: BenchCrop[] = [];
  for (const wall of SETS[set] ?? [set]) crops.push(...(await cropsOf(wall, edge)));
  // The words set scores only notes with words; `tiny` scores every note.
  const chosen = (set === 'words' ? crops.filter((c) => c.truth) : crops).slice(0, limit);

  const loadStart = performance.now();
  const read = await reader.load();
  const loadMs = performance.now() - loadStart;
  const results = [];
  for (const crop of chosen) {
    const start = performance.now();
    const text = await read(crop.image);
    const ms = performance.now() - start;
    results.push({
      wall: crop.wall,
      index: crop.index,
      truth: crop.truth,
      width: crop.width,
      height: crop.height,
      read: text,
      ms,
    });
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  writeFileSync(out, JSON.stringify({ reader: name, set, edge, loadMs, results }, null, 1));
  console.log(`${results.length} crops → ${out}`);
}

await main();
