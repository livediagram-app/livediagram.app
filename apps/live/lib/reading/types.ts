import type { NoteCrop } from '@livediagram/api-schema';

// What a reader gives back for one crop: the words on it, and whether it could
// read them at all. An illegible crop still becomes a note — the PAPER was
// there — so `legible: false` is an answer, not a failure.
export type ReadText = { text: string; legible: boolean };

export type ReadOptions = {
  signal?: AbortSignal;
  // Crops finished so far, for the review's progress bar.
  onProgress?: (readSoFar: number) => void;
};

// Every reader has the same shape, so the photo import does not care which one
// it got: crops in, words out, keyed by the crop id the detector assigned.
export type CropReader = (crops: NoteCrop[], opts: ReadOptions) => Promise<Map<number, ReadText>>;
