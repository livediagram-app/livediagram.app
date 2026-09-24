import type { NoteCrop } from '@livediagram/api-schema';
import type { ModelDownload } from './download-progress';
import type { ReaderBackend } from './reader-protocol';

// What a reader gives back for one crop: the words on it, and whether it could
// read them at all. An illegible crop still becomes a note — the PAPER was
// there — so `legible: false` is an answer, not a failure.
export type ReadText = { text: string; legible: boolean };

export type ReadOptions = {
  signal?: AbortSignal;
  // Crops finished so far, for the review's progress bar.
  onProgress?: (readSoFar: number) => void;
  // The reading model's download, for a reader that fetches one (the
  // in-browser reader: ~160 MB, once per device). See download-progress.ts.
  onModelDownload?: (download: ModelDownload) => void;
  // Where a reader that runs HERE runs: the graphics card or the processor —
  // a minute or half an hour on a big wall, which the author should be told.
  onBackend?: (backend: ReaderBackend) => void;
  // One note's words, as soon as they are read, so the photo fills in note by
  // note rather than all at once at the end.
  onText?: (cropId: number, read: ReadText) => void;
};

// What a reader hands back: the words keyed by the crop id the detector
// assigned, and — when part of the run did not answer — how many crops went
// unread and why. A reader THROWS only when it read nothing at all; a wall
// that lost one batch of six keeps the other ninety words and says so.
export type ReadResult = {
  textById: Map<number, ReadText>;
  unread?: number;
  failure?: string;
};

// Every reader has the same shape, so the photo import does not care which one
// it got: crops in, words out.
export type CropReader = (crops: NoteCrop[], opts: ReadOptions) => Promise<ReadResult>;

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
