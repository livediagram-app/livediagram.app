// What the page and the GIF encoder worker say to each other (docs/specs/020-import-export/blueprints/
// animated-gif-export.md "The encoder"). Frames travel as transferred buffers, never copied.

export type GifEncodeRequest =
  | { type: 'start'; width: number; height: number }
  // A page's palette, from sample frames across its hold, kept under `key` for the frames that name it.
  | { type: 'palette'; key: number; samples: ArrayBuffer[] }
  | { type: 'frame'; rgba: ArrayBuffer; delayCs: number; palette?: number }
  | { type: 'finish' };

export type GifEncodeResponse =
  // Started: the module loaded and ran, so the page may hand frames over (a load failure arrives before this).
  | { type: 'ready' }
  | { type: 'done'; bytes: ArrayBuffer; written: number }
  | { type: 'failed'; message: string };
