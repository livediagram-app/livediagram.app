import type { NoteCrop } from '@livediagram/api-schema';
import type { ModelDownload } from './download-progress';

// What the page and the reading worker say to each other. Only plain data
// crosses: crops in (as data URLs), words and progress out.

export type ReaderBackend = 'webgpu' | 'wasm';

export type ReaderRequest =
  { type: 'read'; id: number; crops: NoteCrop[] } | { type: 'cancel'; id: number };

export type ReaderResponse =
  | { type: 'download'; download: ModelDownload }
  | { type: 'backend'; backend: ReaderBackend }
  // The raw answer for one crop; the page normalises it.
  | { type: 'text'; id: number; cropId: number; text: string }
  | { type: 'done'; id: number }
  // The model could not load (offline, a blocked CDN, no storage).
  | { type: 'failed'; id: number; detail: string };
