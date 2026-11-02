// What a boundary model saw in the working image, as plain arrays: the
// contract between a learned model (run elsewhere, lazily, by whoever has one)
// and the classical detector, which stays free of any ML dependency and only
// ever reads numbers (see `hybrid.ts`).
//
// The model labels every pixel note CORE, SEAM round a note's edge, or
// BACKGROUND. Each connected blob of core is one note; touching notes' cores
// are always a seam apart, which is exactly what a colour mask cannot see.

export type CueRect = { x: number; y: number; w: number; h: number };

export type ModelNote = CueRect & {
  // The core blob alone (the box above is the core flooded back through the
  // seam round it).
  core: CueRect;
  corePixels: number;
  // The model's mean core probability over the blob, 0..1.
  confidence: number;
};

export type ModelCues = {
  // The working image the cues were read from; they must match the image the
  // detector is given.
  width: number;
  height: number;
  notes: ModelNote[];
  // The model's background probability per pixel, scaled to 0..255.
  background: Uint8Array;
};
