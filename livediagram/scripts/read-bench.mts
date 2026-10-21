// Benchmarking the HANDWRITING READERS against a real wall (docs/specs/021-event-storming/event-storming.md Phase 9).
//
// A script, not a test: real photographs are somebody's actual workshop and
// never enter the repo, so nothing here can run in CI. It exists so the choice
// of reader stays a MEASUREMENT rather than a memory — when in-browser models
// get better (and they will), re-run this and see whether the answer moved.
//
//   pnpm bench:readers --photo <wall.png> --truth <labels.json> [--model <id>]
//
// `--photo` is a PNG of the wall (export one from the phone JPEG; PNG keeps the
// script dependency-free). `--truth` holds one entry per crop, labelled by eye
// from the contact sheet the first run writes, with `""` for a blank crop.
// Crops are cut by the REAL detector at the resolution production uses, so
// every reader is scored on identical input.
//
// Labels are keyed by WHERE the note is (its centre, as a fraction of the
// image), never by the crop's index. Index keys look fine and rot silently: the
// moment the detector finds one more sticky than it did last time, every label
// after it shifts by one and the score becomes fiction — which is exactly the
// run where you are trying to learn whether a change helped. A centre survives
// renumbering, and a label that no longer matches any detection is REPORTED
// rather than quietly scored against the wrong note.
//
// Results are appended to the truth file's folder as `read-bench-results.md`.
// Record what you learn in docs/research/vision/handwriting-readers.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import { cropRects, detectStickies, type DetectedSticky } from '../packages/sticky-vision/src';
import type { ImageBuffer } from '../packages/sticky-vision/src/colour';
import { READ_NOTES_SCHEMA } from '../apps/api/src/routes/ai-read-prompt';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

// Where the detector works, and where production works: the same 1000px.
const WORKING_EDGE = 1000;

// ---------------------------------------------------------------------------
// PNG in, with node's zlib and nothing else (the same trick calibrate.ts uses).

function decodePng(path: string): ImageBuffer {
  const buf = readFileSync(path);
  let pos = 8;
  let width = 0;
  let height = 0;
  let colourType = 2;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colourType = data[9]!;
    }
    if (type === 'IDAT') idat.push(Buffer.from(data));
    pos += 12 + len;
    if (type === 'IEND') break;
  }
  const channels = colourType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8ClampedArray(width * height * 4);
  const stride = width * channels;
  const prev = new Uint8Array(stride);
  const line = new Uint8Array(stride);
  let p = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[p];
    p += 1;
    for (let i = 0; i < stride; i += 1) {
      const x = raw[p + i]!;
      const a = i >= channels ? line[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      let value = x;
      if (filter === 1) value = x + a;
      else if (filter === 2) value = x + b;
      else if (filter === 3) value = x + ((a + b) >> 1);
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        value = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      line[i] = value & 0xff;
    }
    p += stride;
    for (let x = 0; x < width; x += 1) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      out[d] = line[s]!;
      out[d + 1] = line[s + 1]!;
      out[d + 2] = line[s + 2]!;
      out[d + 3] = channels === 4 ? line[s + 3]! : 255;
    }
    prev.set(line);
  }
  return { width, height, data: out };
}

// Box-filter downscale. The detector is calibrated at 1000px, and an ALIASED
// downscale shatters paper edges — averaging the source pixels is what keeps a
// sticky's border a border (the same finding the browser path encodes as
// `imageSmoothingQuality: 'high'`).
function downscale(image: ImageBuffer, maxEdge: number): { image: ImageBuffer; scale: number } {
  const longest = Math.max(image.width, image.height);
  if (longest <= maxEdge) return { image, scale: 1 };
  const scale = longest / maxEdge;
  const width = Math.max(1, Math.round(image.width / scale));
  const height = Math.max(1, Math.round(image.height / scale));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor(y * scale);
    const y1 = Math.min(image.height, Math.max(y0 + 1, Math.floor((y + 1) * scale)));
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x * scale);
      const x1 = Math.min(image.width, Math.max(x0 + 1, Math.floor((x + 1) * scale)));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy += 1) {
        for (let xx = x0; xx < x1; xx += 1) {
          const i = (yy * image.width + xx) * 4;
          r += image.data[i]!;
          g += image.data[i + 1]!;
          b += image.data[i + 2]!;
          n += 1;
        }
      }
      const d = (y * width + x) * 4;
      data[d] = r / n;
      data[d + 1] = g / n;
      data[d + 2] = b / n;
      data[d + 3] = 255;
    }
  }
  return { image: { width, height, data }, scale };
}

// ---------------------------------------------------------------------------
// Crops, cut from the FULL-resolution image exactly as the browser does.

function cropsOf(full: ImageBuffer, stickies: DetectedSticky[], scale: number) {
  return cropRects(stickies, scale).map((r) => {
    const w = Math.min(r.w, full.width - r.x);
    const h = Math.min(r.h, full.height - r.y);
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y += 1) {
      const src = ((r.y + y) * full.width + r.x) * 4;
      data.set(full.data.subarray(src, src + w * 4), y * w * 4);
    }
    return { id: r.id, image: { width: w, height: h, data } as ImageBuffer };
  });
}

// ---------------------------------------------------------------------------
// Scoring. Case- and punctuation-insensitive: what a note MEANS is the point,
// not whether the model capitalised it the way the pen did.

export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function levenshtein(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...new Array<number>(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j += 1) d[0]![j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return d[a.length]![b.length]!;
}

// A label and where it sat, as fractions of the image.
export type TruthNote = { at: [number, number]; text: string };

// How far a detection may drift from its label and still be the same note:
// a few percent of the frame, which is well inside one sticky.
const MATCH_TOLERANCE = 0.04;

// Pair each label with the detection nearest it. Unmatched labels are handed
// back so the caller can say so out loud instead of scoring around them.
export function matchByPosition(
  truth: TruthNote[],
  detected: { id: number; at: [number, number] }[],
): { pairs: { note: TruthNote; id: number }[]; unmatched: TruthNote[] } {
  const taken = new Set<number>();
  const pairs: { note: TruthNote; id: number }[] = [];
  const unmatched: TruthNote[] = [];
  for (const note of truth) {
    let best: { id: number; distance: number } | null = null;
    for (const d of detected) {
      if (taken.has(d.id)) continue;
      const distance = Math.hypot(d.at[0] - note.at[0], d.at[1] - note.at[1]);
      if (best === null || distance < best.distance) best = { id: d.id, distance };
    }
    if (best && best.distance <= MATCH_TOLERANCE) {
      taken.add(best.id);
      pairs.push({ note, id: best.id });
    } else {
      unmatched.push(note);
    }
  }
  return { pairs, unmatched };
}

export function score(truth: Record<string, string>, got: Record<string, string>) {
  let chars = 0;
  let errors = 0;
  let exact = 0;
  let notes = 0;
  let words = 0;
  let wordsHit = 0;
  let inventedOnBlank = 0;
  let blanks = 0;
  for (const [id, label] of Object.entries(truth)) {
    const want = norm(label);
    const answer = norm(got[id] ?? '');
    if (want === '') {
      blanks += 1;
      // A reader that invents words on blank paper is worse than one that says
      // nothing: the author has to notice and delete it.
      if (answer !== '') inventedOnBlank += 1;
      continue;
    }
    notes += 1;
    chars += want.length;
    errors += levenshtein(answer, want);
    if (answer === want) exact += 1;
    const answerWords = new Set(answer.split(' '));
    for (const w of want.split(' ')) {
      words += 1;
      if (answerWords.has(w)) wordsHit += 1;
    }
  }
  return {
    exact,
    notes,
    wordAccuracy: words === 0 ? 0 : wordsHit / words,
    cer: chars === 0 ? 0 : errors / chars,
    inventedOnBlank,
    blanks,
  };
}

// ---------------------------------------------------------------------------
// The one reader this script can drive without a browser: any OpenAI-compatible
// endpoint, through the api worker's OWN prompt and request shape, so the
// number describes what ships. The in-browser readers are measured in a browser
// (see docs/research/vision/handwriting-readers.md) — node cannot stand in for WebGPU.

const PROMPT_SOURCE = 'apps/api/src/routes/ai-read-prompt.ts';

function workerPrompt(): string {
  const src = readFileSync(resolve(import.meta.dirname, '..', PROMPT_SOURCE), 'utf8');
  return src
    .split('\n')
    .filter((l) => /^\s+'/.test(l))
    .map((l) => l.trim().replace(/^'|',?$/g, ''))
    .join('\n');
}

function pngDataUrl(image: ImageBuffer): string {
  // Reuse the encoder shape from calibrate.ts: a single IDAT of filtered rows.
  const { width, height, data } = image;
  const raw = Buffer.alloc(height * (width * 3 + 1));
  let p = 0;
  for (let y = 0; y < height; y += 1) {
    raw[p] = 0;
    p += 1;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      raw[p] = data[i]!;
      raw[p + 1] = data[i + 1]!;
      raw[p + 2] = data[i + 2]!;
      p += 3;
    }
  }
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const byte of b) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, body: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc(typed));
    return Buffer.concat([len, typed, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function readViaEndpoint(
  crops: { id: number; image: ImageBuffer }[],
  opts: { baseUrl: string; model: string; key?: string; batch: number; strict: boolean },
): Promise<{ texts: Record<string, string>; failedBatches: number; batches: number }> {
  const prompt = workerPrompt();
  const out: Record<string, string> = {};
  let failedBatches = 0;
  let batches = 0;
  for (let i = 0; i < crops.length; i += opts.batch) {
    const batch = crops.slice(i, i + opts.batch);
    batches += 1;
    const content: unknown[] = [];
    for (const crop of batch) {
      content.push({ type: 'text', text: `Crop id ${crop.id}:` });
      content.push({ type: 'image_url', image_url: { url: pngDataUrl(crop.image) } });
    }
    const res = await fetch(`${opts.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(opts.key ? { authorization: `Bearer ${opts.key}` } : {}),
      },
      body: JSON.stringify({
        model: opts.model,
        // The worker's own budget. A thinking model spends part of it on
        // reasoning, so a tight one truncates the answer (finish_reason=length).
        max_tokens: 2000,
        // The worker's own choice per provider (docs/specs/007-editor/ai-assistance.md): a strict schema for
        // the known ones, JSON mode for a generic endpoint.
        response_format: opts.strict
          ? { type: 'json_schema', json_schema: READ_NOTES_SCHEMA }
          : { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content },
        ],
      }),
    });
    const body = (await res.json()) as {
      choices?: { finish_reason?: string; message?: { content?: string } }[];
    };
    const choice = body.choices?.[0];
    if (choice?.finish_reason === 'length') {
      console.warn(`  batch ${i / opts.batch}: TRUNCATED (raise max_tokens or shrink the batch)`);
    }
    try {
      const parsed = JSON.parse((choice?.message?.content ?? '').replace(/```json|```/g, '')) as {
        texts?: { id: number; text?: string; legible?: boolean }[];
      };
      for (const t of parsed.texts ?? []) {
        out[String(t.id)] = t.legible === false ? '' : (t.text ?? '');
      }
    } catch {
      failedBatches += 1;
      console.warn(`  batch ${i / opts.batch}: unparseable answer`);
    }
  }
  return { texts: out, failedBatches, batches };
}

// ---------------------------------------------------------------------------

async function main() {
  const photo = arg('photo');
  if (!photo) {
    console.error(
      'usage: pnpm bench:readers --photo <wall.png> [--truth <labels.json>] [--model <id>] [--base <url>] [--key-var <ENV>] [--batch 6]',
    );
    process.exit(1);
  }
  console.log(`photo: ${photo}`);
  const full = decodePng(photo);
  const { image: working, scale } = downscale(full, WORKING_EDGE);
  const stickies = detectStickies(working);
  console.log(`detected ${stickies.length} stickies at ${working.width}x${working.height}`);
  const crops = cropsOf(full, stickies, scale);

  const outDir = dirname(arg('truth') ?? photo);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const truthPath = arg('truth');
  if (!truthPath || !existsSync(truthPath)) {
    // First run: write every crop out so the labels can be typed by eye, and a
    // skeleton truth file to type them into.
    const dir = `${outDir}/crops`;
    mkdirSync(dir, { recursive: true });
    const skeleton: TruthNote[] = [];
    for (const crop of crops) {
      writeFileSync(
        `${dir}/${String(crop.id).padStart(2, '0')}.png`,
        Buffer.from(pngDataUrl(crop.image).split(',')[1]!, 'base64'),
      );
      const s = stickies[crop.id]!;
      skeleton.push({
        at: [
          Number(((s.x + s.w / 2) / working.width).toFixed(4)),
          Number(((s.y + s.h / 2) / working.height).toFixed(4)),
        ],
        text: '',
      });
    }
    const skeletonPath = truthPath ?? `${outDir}/truth.json`;
    writeFileSync(skeletonPath, JSON.stringify(skeleton, null, 1));
    console.log(`\nwrote ${crops.length} crops to ${dir}`);
    console.log(
      `and a skeleton to ${skeletonPath} — type each note's words into "text" ("" for a blank crop), then re-run.`,
    );
    return;
  }

  const truth = JSON.parse(readFileSync(truthPath, 'utf8')) as TruthNote[];
  const centres = stickies.map((s) => ({
    id: s.id,
    at: [(s.x + s.w / 2) / working.width, (s.y + s.h / 2) / working.height] as [number, number],
  }));
  const { pairs, unmatched } = matchByPosition(truth, centres);
  if (unmatched.length > 0) {
    // Say it loudly: these labels describe notes the detector no longer finds
    // here, so the run is measuring a different wall than the labels do.
    console.warn(`\n${unmatched.length} label(s) matched no detection — the detector moved:`);
    for (const n of unmatched) console.warn(`  at ${n.at.join(', ')}: "${n.text}"`);
  }
  // Score against the ids the labels actually landed on.
  const truthById: Record<string, string> = {};
  for (const { note, id } of pairs) truthById[String(id)] = note.text;
  const model = arg('model') ?? 'gemini-2.5-flash-lite';
  const base = arg('base') ?? 'https://generativelanguage.googleapis.com/v1beta/openai';
  const keyVar = arg('key-var') ?? 'GOOGLE_AI_STUDIO_API_KEY';
  const key = process.env[keyVar];
  const batch = Number(arg('batch') ?? 6);
  // `--schema json` reproduces JSON mode; the default is the worker's strict
  // schema for a known provider.
  const strict = (arg('schema') ?? 'strict') !== 'json';

  console.log(`reading ${crops.length} crops with ${model} (batches of ${batch})…`);
  const started = Date.now();
  const read = await readViaEndpoint(
    crops.filter((c) => String(c.id) in truthById),
    { baseUrl: base, model, key, batch, strict },
  );
  const got = read.texts;
  console.log(
    `schema=${strict ? 'strict' : 'json'} unparseable batches: ${read.failedBatches}/${read.batches}`,
  );
  const seconds = (Date.now() - started) / 1000;
  const s = score(truthById, got);
  const line =
    `| ${model} | ${s.exact}/${s.notes} | ${(100 * s.wordAccuracy).toFixed(0)}% | ` +
    `${(100 * s.cer).toFixed(1)}% | ${s.inventedOnBlank}/${s.blanks} | ${seconds.toFixed(1)}s |`;
  console.log(`\n| reader | exact | words | CER | invented on blank | time |`);
  console.log(`| --- | --- | --- | --- | --- | --- |`);
  console.log(line);

  for (const [id, label] of Object.entries(truthById)) {
    if (norm(label) === norm(got[id] ?? '')) continue;
    console.log(`  #${id.padStart(2)} want: ${label}\n       got:  ${got[id] ?? ''}`);
  }

  const results = `${outDir}/read-bench-results.md`;
  const previous = existsSync(results) ? readFileSync(results, 'utf8') : '';
  writeFileSync(results, `${previous}${new Date().toISOString().slice(0, 10)} ${line}\n`);
  console.log(`\nappended to ${results}`);
}

if (process.argv[1]?.endsWith('read-bench.mts')) await main();
