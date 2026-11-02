// The shared core of two classic OCR pipelines for the reader bench (the
// readers themselves are reader-bench-ocr-paddle.mts and -doctr.mts), written against the plain
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

export type Norm = { mean: readonly number[]; std: readonly number[]; bgr: boolean };

// Into a CHW float tensor of `width` x `height`, the image at the top left
// (or at `offset`) and the rest padded with `padValue`, already normalised.
export function toChw(
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

export type DbOptions = {
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

export const scaleBox = (b: Box, sx: number, sy: number, dx = 0, dy = 0): Box => ({
  x0: (b.x0 - dx) * sx,
  y0: (b.y0 - dy) * sy,
  x1: (b.x1 - dx) * sx,
  y1: (b.y1 - dy) * sy,
  score: b.score,
});

export const floats = (t: OrtTensor): Float32Array => t.data as Float32Array;

export async function runOne(ort: Ort, session: OrtSession, data: Float32Array, dims: number[]) {
  const out = await session.run({
    [session.inputNames[0]!]: new ort.Tensor('float32', data, dims),
  });
  return out[session.outputNames[0]!]!;
}
