import type { NoteCrop } from '@livediagram/api-schema';
import type { ModelDownload } from './download-progress';

// What the page and the reading worker say to each other. Only plain data
// crosses: crops in (as data URLs), words and progress out.

export type ReaderBackend = 'webgpu' | 'wasm';

// Why the reader runs on the processor rather than the graphics card: the
// browser has no WebGPU, no adapter is available, the adapter cannot run
// half-precision maths, or the graphics card failed to start the model.
export type ProcessorReason = 'no-webgpu' | 'no-adapter' | 'no-f16' | 'gpu-failed';

export type ReaderRequest =
  // `backend` forces one engine, and `why` says why it was forced; absent,
  // the worker picks (see pick-backend.ts).
  | { type: 'read'; id: number; crops: NoteCrop[]; backend?: ReaderBackend; why?: ProcessorReason }
  | { type: 'cancel'; id: number };

export type ReaderResponse =
  | { type: 'download'; download: ModelDownload }
  // `why` is present exactly when the engine is the processor.
  | { type: 'backend'; backend: ReaderBackend; why?: ProcessorReason }
  // The raw answer for one crop; the page normalises it.
  | { type: 'text'; id: number; cropId: number; text: string }
  | { type: 'done'; id: number }
  // The model could not load (offline, a blocked CDN, no storage).
  // `backend` says which engine failed, so the page can try the other.
  | { type: 'failed'; id: number; detail: string; backend: ReaderBackend };
