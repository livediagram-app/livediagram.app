// What the page and the GIF encoder worker say to each other (docs/specs/020-import-export/blueprints/
// animated-gif-export.md "The encoder"). Frames travel as transferred buffers, never copied.

export type GifEncodeRequest =
  | { type: 'start'; width: number; height: number }
  | { type: 'frame'; rgba: ArrayBuffer; delayCs: number }
  | { type: 'finish' };

export type GifEncodeResponse =
  { type: 'done'; bytes: ArrayBuffer; written: number } | { type: 'failed'; message: string };
