import type { NoteCrop } from '@livediagram/api-schema';
import { BLANK_ANSWERS } from './reader-model';
import type { ReaderRequest, ReaderResponse } from './reader-protocol';
import { normaliseRead, type ReadOptions, type ReadText } from './types';

// Reading the handwriting with a model that runs HERE, in this browser
// (spec/139 Phase 9) — the reader a deployment with no model key gets, which
// is why the photo import needs no key at all. See reader-model.ts for the
// model and why it is this one.
//
// The model runs in a WORKER (reader.worker.ts); this is the page's side: it
// posts the crops and listens. On the page the model took the main thread
// whole — the review's reveal froze mid-way and nothing moved while a wall of
// hundreds of notes was read. Each note's words are handed on AS THEY ARE
// READ, so the photo fills in note by note instead of all at once at the end.

type ReaderWorker = {
  postMessage: (request: ReaderRequest) => void;
  addEventListener: (type: 'message', fn: (e: MessageEvent<ReaderResponse>) => void) => void;
  removeEventListener: (type: 'message', fn: (e: MessageEvent<ReaderResponse>) => void) => void;
};

// One worker for the page, created on first use and kept: it holds the model.
let shared: ReaderWorker | null = null;
let nextId = 1;

export function readCropsInBrowser(
  crops: NoteCrop[],
  opts: ReadOptions = {},
): Promise<Map<number, ReadText>> {
  shared ??= new Worker(new URL('./reader.worker.ts', import.meta.url), {
    type: 'module',
  }) as unknown as ReaderWorker;
  return readCropsWith(shared, crops, opts);
}

// The model's own answer, as a note's words: a line break is layout, and the
// model's "no writing" is a blank note.
function toRead(text: string): ReadText {
  const read = normaliseRead(text);
  return BLANK_ANSWERS.test(read.text) ? { text: '', legible: false } : read;
}

export function readCropsWith(
  worker: ReaderWorker,
  crops: NoteCrop[],
  opts: ReadOptions = {},
): Promise<Map<number, ReadText>> {
  const out = new Map<number, ReadText>();
  if (crops.length === 0) return Promise.resolve(out);
  const id = nextId++;

  return new Promise((resolve) => {
    const finish = () => {
      worker.removeEventListener('message', listen);
      opts.signal?.removeEventListener('abort', cancel);
      resolve(out);
    };
    const cancel = () => worker.postMessage({ type: 'cancel', id });
    const listen = ({ data: message }: MessageEvent<ReaderResponse>) => {
      if (message.type === 'download') {
        opts.onModelDownload?.(message.download);
      } else if (message.type === 'backend') {
        opts.onBackend?.(message.backend);
      } else if (message.id !== id) {
        return;
      } else if (message.type === 'text') {
        const read = toRead(message.text);
        out.set(message.cropId, read);
        opts.onText?.(message.cropId, read);
        opts.onProgress?.(out.size);
      } else if (message.type === 'failed') {
        // The weights could not be fetched (offline, a blocked CDN, no
        // storage). The paper was still found, so every note lands blank for
        // the author to type rather than the whole import failing.
        for (const c of crops) if (!out.has(c.id)) out.set(c.id, { text: '', legible: false });
        opts.onProgress?.(crops.length);
        finish();
      } else if (message.type === 'done') {
        finish();
      }
    };
    worker.addEventListener('message', listen);
    opts.signal?.addEventListener('abort', cancel, { once: true });
    worker.postMessage({ type: 'read', id, crops });
  });
}
