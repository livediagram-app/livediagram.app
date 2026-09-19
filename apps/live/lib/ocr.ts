// In-browser OCR for the photo review (spec/139 Phase 9).
//
// Tesseract.js runs the OCR model locally in WASM: no API key, no server, no
// upload. The crops never leave the machine at all. It is trained on PRINTED
// text, so marker handwriting reads only partly — the review's editable text
// fields are what make a partial read workable, and an empty read still lands
// the note. The crops are upscaled and greyed before recognition so the small
// glyphs reach a size the model can resolve.

import { createWorker, PSM } from 'tesseract.js';
import type { NoteCrop } from '@livediagram/api-schema';

export type ReadText = { text: string; legible: boolean };

// The shortest side a crop is brought up to before recognition, and the most
// it is allowed to grow. Marker glyphs under ~30px are below what the LSTM can
// tell apart; a 77px note's writing is ~15px, so it is scaled up fourfold.
const TARGET_MIN_SIDE = 320;
const MAX_UPSCALE = 4;

// Decode the crop, upscale it to a readable size, and grey it. Tesseract's own
// greying is fine on clean print, but a pastel sticky with thin marker strokes
// benefits from the contrast being settled before the model sees it.
async function prepare(cropImage: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = cropImage;
  await img.decode();
  const scale = Math.max(
    1,
    Math.min(MAX_UPSCALE, TARGET_MIN_SIDE / Math.min(img.naturalWidth, img.naturalHeight)),
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < data.length; i += 4) {
    const v = (0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!) | 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  ctx.putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0);
  return canvas;
}

export async function readCropsInBrowser(
  crops: NoteCrop[],
  opts: { signal?: AbortSignal; onProgress?: (done: number) => void } = {},
): Promise<Map<number, ReadText>> {
  const out = new Map<number, ReadText>();
  if (crops.length === 0) return out;

  const blank = () => {
    for (const c of crops) out.set(c.id, { text: '', legible: false });
    opts.onProgress?.(crops.length);
    return out;
  };

  let worker: Awaited<ReturnType<typeof createWorker>>;
  try {
    worker = await createWorker('eng');
  } catch {
    // The model could not load (offline, a blocked CDN): every crop is blank.
    // The paper was still found, so the notes land empty rather than failing.
    return blank();
  }

  try {
    // A single block: a sticky holds one short phrase, not a page. Asking for
    // a whole page made Tesseract hallucinate lines around the one real line.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    // One at a time: Tesseract is single-threaded per worker, and the onProgress
    // callback is what drives the review's "reading the words" progress.
    for (let i = 0; i < crops.length; i += 1) {
      if (opts.signal?.aborted) break;
      const crop = crops[i]!;
      try {
        const canvas = await prepare(crop.image);
        const { data } = await worker.recognize(canvas);
        const text = (data.text ?? '').replace(/\s+/g, ' ').trim();
        out.set(crop.id, { text, legible: text !== '' });
      } catch {
        // A crop the model cannot decode is a blank note, not a broken import.
        out.set(crop.id, { text: '', legible: false });
      }
      opts.onProgress?.(i + 1);
    }
  } finally {
    await worker.terminate();
  }
  return out;
}
