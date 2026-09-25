// Two classic OCR pipelines for the reader bench, written against the plain
// onnxruntime API so the SAME code runs on onnxruntime-node (the bench) and
// onnxruntime-web (the in-browser timing page): detect text boxes with a DB
// (differentiable binarisation) model, then recognise each box, and join the
// boxes line by line, top to bottom.
//
// - PaddleOCR (PP-OCR mobile det + English CTC rec), Apache-2.0, the ONNX
//   exports RapidOCR publishes.
// - docTR via OnnxTR (db_mobilenet_v3_large + PARSeq), Apache-2.0.
//
// Pure TypeScript and no image library: an image is raw RGB bytes, so a
// browser page can hand in canvas pixels and node can hand in sharp's.

export type Rgb = { data: Uint8Array; width: number; height: number };

// The slice of onnxruntime both runtimes share.
export type OrtTensor = { data: unknown; dims: readonly number[] };
export type OrtSession = {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run: (feeds: Record<string, OrtTensor>) => Promise<Record<string, OrtTensor>>;
};
export type Ort = {
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => OrtTensor;
};

export type Box = { x0: number; y0: number; x1: number; y1: number; score: number };

// Bilinear, with pixel centres aligned (as PIL and OpenCV resize).
export function resize(src: Rgb, width: number, height: number): Rgb {
  const out = new Uint8Array(width * height * 3);
  const sx = src.width / width;
  const sy = src.height / height;
  for (let y = 0; y < height; y += 1) {
    const fy = Math.min(src.height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(src.height - 1, y0 + 1);
    const dy = fy - y0;
    for (let x = 0; x < width; x += 1) {
      const fx = Math.min(src.width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(src.width - 1, x0 + 1);
      const dx = fx - x0;
      for (let c = 0; c < 3; c += 1) {
        const a = src.data[(y0 * src.width + x0) * 3 + c]!;
        const b = src.data[(y0 * src.width + x1) * 3 + c]!;
        const d = src.data[(y1 * src.width + x0) * 3 + c]!;
        const e = src.data[(y1 * src.width + x1) * 3 + c]!;
        const top = a + (b - a) * dx;
        const bottom = d + (e - d) * dx;
        out[(y * width + x) * 3 + c] = Math.round(top + (bottom - top) * dy);
      }
    }
  }
  return { data: out, width, height };
}

export function crop(src: Rgb, box: { x0: number; y0: number; x1: number; y1: number }): Rgb {
  const x0 = Math.max(0, Math.floor(box.x0));
  const y0 = Math.max(0, Math.floor(box.y0));
  const x1 = Math.min(src.width, Math.ceil(box.x1));
  const y1 = Math.min(src.height, Math.ceil(box.y1));
  const width = Math.max(1, x1 - x0);
  const height = Math.max(1, y1 - y0);
  const out = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    const from = ((y0 + y) * src.width + x0) * 3;
    out.set(src.data.subarray(from, from + width * 3), y * width * 3);
  }
  return { data: out, width, height };
}

type Norm = { mean: readonly number[]; std: readonly number[]; bgr: boolean };

// Into a CHW float tensor of `width` x `height`, the image at the top left
// (or at `offset`) and the rest padded with `padValue`, already normalised.
function toChw(
  img: Rgb,
  norm: Norm,
  width: number,
  height: number,
  offset = { x: 0, y: 0 },
  padValue = 0,
): Float32Array {
  const out = new Float32Array(3 * width * height).fill(padValue);
  const plane = width * height;
  for (let c = 0; c < 3; c += 1) {
    const src = norm.bgr ? 2 - c : c;
    const mean = norm.mean[c]!;
    const std = norm.std[c]!;
    for (let y = 0; y < img.height; y += 1) {
      for (let x = 0; x < img.width; x += 1) {
        const v = img.data[(y * img.width + x) * 3 + src]! / 255;
        out[c * plane + (y + offset.y) * width + (x + offset.x)] = (v - mean) / std;
      }
    }
  }
  return out;
}

type DbOptions = {
  binThresh: number;
  boxThresh: number;
  unclip: number;
  minSize: number;
  // docTR opens the binary map (3x3) to drop specks; PP-OCR dilates it (2x2)
  // to join a line's broken strokes.
  morphology: 'open' | 'dilate';
};

// One pass of a k x k minimum (erode) or maximum (dilate) over a binary map;
// the window starts at -floor((k-1)/2), as OpenCV anchors it.
function morph(bin: Uint8Array, width: number, height: number, k: number, max: boolean) {
  const out = new Uint8Array(bin.length);
  const lo = -Math.floor((k - 1) / 2);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let v = max ? 0 : 1;
      for (let dy = lo; dy < lo + k; dy += 1) {
        for (let dx = lo; dx < lo + k; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const b = bin[ny * width + nx]!;
          v = max ? v | b : v & b;
        }
      }
      out[y * width + x] = v;
    }
  }
  return out;
}

// DB post-processing: binarise the probability map, take each 8-connected
// region's bounding box, score it by the mean probability inside, and grow it
// by the DB "unclip" distance (area * ratio / perimeter). Axis-aligned boxes:
// a sticky note's writing is close enough to level.
export function dbBoxes(prob: Float32Array, width: number, height: number, o: DbOptions): Box[] {
  let bin = new Uint8Array(width * height);
  for (let i = 0; i < bin.length; i += 1) bin[i] = prob[i]! > o.binThresh ? 1 : 0;
  bin =
    o.morphology === 'open'
      ? morph(morph(bin, width, height, 3, false), width, height, 3, true)
      : morph(bin, width, height, 2, true);
  const seen = new Uint8Array(width * height);
  const boxes: Box[] = [];
  const stack: number[] = [];
  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] || !bin[start]) continue;
    seen[start] = 1;
    stack.push(start);
    let x0 = width;
    let y0 = height;
    let x1 = 0;
    let y1 = 0;
    while (stack.length > 0) {
      const p = stack.pop()!;
      const px = p % width;
      const py = (p - px) / width;
      x0 = Math.min(x0, px);
      x1 = Math.max(x1, px);
      y0 = Math.min(y0, py);
      y1 = Math.max(y1, py);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const q = ny * width + nx;
          if (seen[q] || !bin[q]) continue;
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    if (Math.min(w, h) < o.minSize) continue;
    let sum = 0;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) sum += prob[y * width + x]!;
    }
    const score = sum / (w * h);
    if (score < o.boxThresh) continue;
    const d = (w * h * o.unclip) / (2 * (w + h));
    boxes.push({
      x0: Math.max(0, x0 - d),
      y0: Math.max(0, y0 - d),
      x1: Math.min(width, x1 + 1 + d),
      y1: Math.min(height, y1 + 1 + d),
      score,
    });
  }
  return boxes;
}

// Reading order: a box joins the line whose vertical span it shares by half
// its own height; lines top to bottom, boxes left to right.
export function readingOrder<T extends Box>(boxes: T[]): T[][] {
  const lines: { y0: number; y1: number; boxes: T[] }[] = [];
  for (const b of [...boxes].sort((a, c) => a.y0 + a.y1 - (c.y0 + c.y1))) {
    const h = b.y1 - b.y0;
    const line = lines.find(
      (l) => Math.min(l.y1, b.y1) - Math.max(l.y0, b.y0) >= 0.5 * Math.min(h, l.y1 - l.y0),
    );
    if (line) {
      line.boxes.push(b);
      line.y0 = Math.min(line.y0, b.y0);
      line.y1 = Math.max(line.y1, b.y1);
    } else lines.push({ y0: b.y0, y1: b.y1, boxes: [b] });
  }
  return lines
    .sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1))
    .map((l) => l.boxes.sort((a, b) => a.x0 - b.x0));
}

const scaleBox = (b: Box, sx: number, sy: number, dx = 0, dy = 0): Box => ({
  x0: (b.x0 - dx) * sx,
  y0: (b.y0 - dy) * sy,
  x1: (b.x1 - dx) * sx,
  y1: (b.y1 - dy) * sy,
  score: b.score,
});

const floats = (t: OrtTensor): Float32Array => t.data as Float32Array;

async function runOne(ort: Ort, session: OrtSession, data: Float32Array, dims: number[]) {
  const out = await session.run({
    [session.inputNames[0]!]: new ort.Tensor('float32', data, dims),
  });
  return out[session.outputNames[0]!]!;
}

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

// ---- docTR (OnnxTR) -------------------------------------------------------

export type Doctr = { ort: Ort; det: OrtSession; rec: OrtSession };

const DOCTR_DET_SIZE = 1024;
const DOCTR_DET_NORM: Norm = {
  mean: [0.798, 0.785, 0.772],
  std: [0.264, 0.2749, 0.287],
  bgr: false,
};
const DOCTR_DB: DbOptions = {
  binThresh: 0.3,
  boxThresh: 0.1,
  unclip: 1.5,
  minSize: 2,
  morphology: 'open',
};
const DOCTR_REC_W = 128;
const DOCTR_REC_H = 32;
const DOCTR_REC_NORM: Norm = {
  mean: [0.694, 0.695, 0.693],
  std: [0.299, 0.296, 0.301],
  bgr: false,
};
// VOCABS["french"] in docTR: digits, ASCII letters, ASCII punctuation, °,
// currency, and the French accented letters. PARSeq's classes are these, then
// <eos>.
export const DOCTR_VOCAB =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~' +
  '°£€¥¢฿àâéèêëîïôùûüçÀÂÉÈÊËÎÏÔÙÛÜÇ';

// Resize to fit a box, keeping the aspect ratio: the scaled size.
const fit = (img: Rgb, w: number, h: number) => {
  const s = Math.min(w / img.width, h / img.height);
  return {
    width: Math.max(1, Math.round(img.width * s)),
    height: Math.max(1, Math.round(img.height * s)),
  };
};

export async function doctrRead(d: Doctr, img: Rgb): Promise<string> {
  const size = fit(img, DOCTR_DET_SIZE, DOCTR_DET_SIZE);
  const offset = {
    x: Math.ceil((DOCTR_DET_SIZE - size.width) / 2),
    y: Math.ceil((DOCTR_DET_SIZE - size.height) / 2),
  };
  // docTR pads with black BEFORE normalising.
  const input = padNormalised(
    resize(img, size.width, size.height),
    DOCTR_DET_NORM,
    DOCTR_DET_SIZE,
    DOCTR_DET_SIZE,
    offset,
  );
  const logits = floats(await runOne(d.ort, d.det, input, [1, 3, DOCTR_DET_SIZE, DOCTR_DET_SIZE]));
  const prob = logits.map((v) => 1 / (1 + Math.exp(-v)));
  const boxes = dbBoxes(prob, DOCTR_DET_SIZE, DOCTR_DET_SIZE, DOCTR_DB).map((b) =>
    scaleBox(b, img.width / size.width, img.height / size.height, offset.x, offset.y),
  );
  if (process.env.READER_BENCH_DEBUG) console.error(`docTR: ${boxes.length} boxes`);
  const lines: string[] = [];
  for (const line of readingOrder(boxes)) {
    const words: string[] = [];
    for (const b of line) {
      const text = await parseqRecognise(d, crop(img, b));
      if (text) words.push(text);
    }
    if (words.length > 0) lines.push(words.join(' '));
  }
  return lines.join(' ');
}

function padNormalised(
  img: Rgb,
  norm: Norm,
  width: number,
  height: number,
  offset = { x: 0, y: 0 },
): Float32Array {
  const out = toChw(img, norm, width, height, offset);
  const plane = width * height;
  for (let c = 0; c < 3; c += 1) {
    const black = (0 - norm.mean[c]!) / norm.std[c]!;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const inside =
          x >= offset.x && x < offset.x + img.width && y >= offset.y && y < offset.y + img.height;
        if (!inside) out[c * plane + y * width + x] = black;
      }
    }
  }
  return out;
}

async function parseqRecognise(d: Doctr, word: Rgb): Promise<string> {
  const size = fit(word, DOCTR_REC_W, DOCTR_REC_H);
  const input = padNormalised(
    resize(word, size.width, size.height),
    DOCTR_REC_NORM,
    DOCTR_REC_W,
    DOCTR_REC_H,
  );
  const out = await runOne(d.ort, d.rec, input, [1, 3, DOCTR_REC_H, DOCTR_REC_W]);
  const logits = floats(out);
  const [, steps, classes] = out.dims as [number, number, number];
  const eos = DOCTR_VOCAB.length;
  if (classes < eos + 1) throw new Error(`parseq has ${classes} classes, vocab ${eos}`);
  const chars = [...DOCTR_VOCAB];
  let text = '';
  for (let t = 0; t < steps; t += 1) {
    let best = 0;
    for (let c = 1; c < classes; c += 1) {
      if (logits[t * classes + c]! > logits[t * classes + best]!) best = c;
    }
    if (best >= eos) break;
    text += chars[best];
  }
  return text;
}
