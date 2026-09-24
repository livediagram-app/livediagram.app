import type { NoteCrop } from '@livediagram/api-schema';
import type { ModelDownload } from './download-progress';

// What the page and the reading worker say to each other. Only plain data
// crosses: crops in (as data URLs), words and progress out.

export type ReaderBackend = 'webgpu' | 'wasm';

export type ReaderRequest =
  // `backend` forces one engine; absent, the worker picks (see reader.worker.ts).
  | { type: 'read'; id: number; crops: NoteCrop[]; backend?: ReaderBackend }
  | { type: 'cancel'; id: number };

export type ReaderResponse =
  | { type: 'download'; download: ModelDownload }
  | { type: 'backend'; backend: ReaderBackend }
  // The raw answer for one crop; the page normalises it.
  | { type: 'text'; id: number; cropId: number; text: string }
  | { type: 'done'; id: number }
  // The model could not load (offline, a blocked CDN, no storage).
  // `backend` says which engine failed, so the page can try the other.
  | { type: 'failed'; id: number; detail: string; backend: ReaderBackend };
