// PaddleOCR for the reader bench (PP-OCR mobile det + English CTC rec,
// Apache-2.0, the ONNX exports RapidOCR publishes), on the shared core in
// reader-bench-ocr.mts.

import {
  type Rgb,
  type OrtSession,
  type Ort,
  type Box,
  type Norm,
  type DbOptions,
  resize,
  crop,
  toChw,
  dbBoxes,
  readingOrder,
  scaleBox,
  floats,
  runOne,
} from './reader-bench-ocr.mts';

// ---- PaddleOCR ------------------------------------------------------------

// How a PP-OCR generation is driven: the detector's input brought up to a
// short side of `detShortSide` (never down), each side a multiple of 32, and
// its DB thresholds.
export type PaddleSettings = {
  detShortSide: number;
  db: Pick<DbOptions, 'binThresh' | 'boxThresh' | 'unclip'>;
};

export type Paddle = {
  ort: Ort;
  det: OrtSession;
  rec: OrtSession;
  dict: string[];
  settings: PaddleSettings;
};

// RapidOCR's defaults for the v4/v5 exports it publishes.
export const PADDLE_RAPIDOCR: PaddleSettings = {
  detShortSide: 736,
  db: { binThresh: 0.3, boxThresh: 0.5, unclip: 1.6 },
};
// PP-OCRv6's own (its inference.yml, and PaddleOCR 3's pipeline default of a
// 64 px minimum side).
export const PADDLE_V6: PaddleSettings = {
  detShortSide: 64,
  db: { binThresh: 0.2, boxThresh: 0.45, unclip: 1.4 },
};

// ImageNet normalisation on BGR, as OpenCV reads.
const PADDLE_DET_NORM: Norm = {
  mean: [0.485, 0.456, 0.406],
  std: [0.229, 0.224, 0.225],
  bgr: true,
};
const PADDLE_REC_HEIGHT = 48;
const PADDLE_REC_MIN_WIDTH = 320;
const PADDLE_REC_NORM: Norm = { mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5], bgr: true };
// A line recognised with less mean confidence than this is dropped
// (PaddleOCR's drop_score).
const PADDLE_DROP_SCORE = 0.5;

const to32 = (v: number) => Math.max(32, Math.round(v / 32) * 32);

export type PaddleDetector = Pick<Paddle, 'ort' | 'det' | 'settings'>;

// PP-OCR's text-line detector alone: the boxes, in the image's pixels, in
// reading order.
export async function paddleDetect(p: PaddleDetector, img: Rgb): Promise<Box[][]> {
  const scale = Math.max(1, p.settings.detShortSide / Math.min(img.width, img.height));
  const w = to32(img.width * scale);
  const h = to32(img.height * scale);
  const input = toChw(resize(img, w, h), PADDLE_DET_NORM, w, h);
  const prob = floats(await runOne(p.ort, p.det, input, [1, 3, h, w]));
  const db: DbOptions = { ...p.settings.db, minSize: 3, morphology: 'dilate' };
  const boxes = dbBoxes(prob, w, h, db).map((b) => scaleBox(b, img.width / w, img.height / h));
  if (process.env.READER_BENCH_DEBUG) console.error(`paddle: ${boxes.length} boxes`);
  return readingOrder(boxes);
}

// Detect, then recognise each box with `recognise`, dropping what it is not
// sure of; boxes joined with spaces, line after line.
export async function readLines(
  lines: Box[][],
  img: Rgb,
  recognise: (box: Rgb) => Promise<{ text: string; score: number }>,
  dropScore: number,
): Promise<string> {
  const out: string[] = [];
  for (const line of lines) {
    const words: string[] = [];
    for (const b of line) {
      const read = await recognise(crop(img, b));
      if (read.text && read.score >= dropScore) words.push(read.text);
    }
    if (words.length > 0) out.push(words.join(' '));
  }
  return out.join(' ');
}

export async function paddleRead(p: Paddle, img: Rgb): Promise<string> {
  const lines = await paddleDetect(p, img);
  return readLines(lines, img, (line) => paddleRecognise(p, line), PADDLE_DROP_SCORE);
}

async function paddleRecognise(p: Paddle, line: Rgb) {
  const width = Math.max(1, Math.ceil((PADDLE_REC_HEIGHT * line.width) / line.height));
  const padded = Math.max(PADDLE_REC_MIN_WIDTH, width);
  const input = toChw(
    resize(line, width, PADDLE_REC_HEIGHT),
    PADDLE_REC_NORM,
    padded,
    PADDLE_REC_HEIGHT,
  );
  const out = await runOne(p.ort, p.rec, input, [1, 3, PADDLE_REC_HEIGHT, padded]);
  return ctcDecode(floats(out), out.dims, ['', ...p.dict, ' ']);
}

// PP-OCRv6 ships its character list inside inference.yml, as a YAML list
// under PostProcess.character_dict: plain, 'single-' or "double-quoted".
export function paddleDictFromYaml(yml: string): string[] {
  const lines = yml.split('\n');
  const start = lines.findIndex((l) => l.trim() === 'character_dict:');
  if (start === -1) throw new Error('no character_dict in inference.yml');
  const dict: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const m = /^\s*- (.*)$/.exec(line);
    if (!m) break;
    const v = m[1]!;
    if (v.startsWith("'")) dict.push(v.slice(1, -1).replaceAll("''", "'"));
    else if (v.startsWith('"')) dict.push(JSON.parse(v) as string);
    else dict.push(v);
  }
  return dict;
}

// Greedy CTC: the best class per step, repeats collapsed, blanks (0) dropped.
export function ctcDecode(probs: Float32Array, dims: readonly number[], chars: string[]) {
  const steps = dims[1]!;
  const classes = dims[2]!;
  if (classes !== chars.length) throw new Error(`rec has ${classes} classes, dict ${chars.length}`);
  let text = '';
  let sum = 0;
  let n = 0;
  let last = -1;
  for (let t = 0; t < steps; t += 1) {
    let best = 0;
    for (let c = 1; c < classes; c += 1) {
      if (probs[t * classes + c]! > probs[t * classes + best]!) best = c;
    }
    if (best !== 0 && best !== last) {
      text += chars[best];
      sum += probs[t * classes + best]!;
      n += 1;
    }
    last = best;
  }
  return { text: text.trim(), score: n === 0 ? 0 : sum / n };
}
