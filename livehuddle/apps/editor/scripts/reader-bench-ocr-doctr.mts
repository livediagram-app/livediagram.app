// docTR via OnnxTR for the reader bench (db_mobilenet_v3_large + PARSeq,
// Apache-2.0), on the shared core in reader-bench-ocr.mts.

import {
  type Rgb,
  type OrtSession,
  type Ort,
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
