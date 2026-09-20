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

// One answer shape, whoever read it.
//
// A sticky's line break is LAYOUT, not content. A model reading two lines of
// marker hands back "Machine\nFixed", and a single-line field renders that as
// "MachineFixed" — the words welded together, which is what the review showed
// before this existed. The note wraps to its own width on the canvas anyway,
// so a newline is a space here and the text stays one phrase.
export function normaliseRead(text: string): ReadText {
  const clean = text.replace(/\s+/g, ' ').trim();
  // Whitespace is not a reading. Saying so keeps "legible" meaning what the
  // badge and the blank-note count claim it means.
  return { text: clean, legible: clean !== '' };
}
