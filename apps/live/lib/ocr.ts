// In-browser OCR for the photo review (spec/139 Phase 9).
//
// Tesseract.js runs the OCR model locally in WASM: no API key, no server, no
// upload. The crops never leave the machine at all now. The honest caveat is
// that Tesseract is trained on PRINTED text, so a marker-pen wall reads far
// less than a vision LLM would; the review's editable text fields are what
// make a partial read workable, and an empty read still lands the note.

import { createWorker } from 'tesseract.js';
import type { NoteCrop } from '@livediagram/api-schema';

export type ReadText = { text: string; legible: boolean };

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
    // One at a time: Tesseract is single-threaded per worker, and the onProgress
    // callback is what drives the review's "reading the words" progress.
    for (let i = 0; i < crops.length; i += 1) {
      if (opts.signal?.aborted) break;
      const crop = crops[i]!;
      try {
        const { data } = await worker.recognize(crop.image);
        const text = (data.text ?? '').replace(/\s+/g, ' ').trim();
        out.set(crop.id, { text, legible: text !== '' });
      } catch {
        // A crop Tesseract cannot decode is a blank note, not a broken import.
        out.set(crop.id, { text: '', legible: false });
      }
      opts.onProgress?.(i + 1);
    }
  } finally {
    await worker.terminate();
  }
  return out;
}
