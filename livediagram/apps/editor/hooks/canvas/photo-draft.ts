// The photo import's state, its review payload, the hook's inputs and outputs, its toasts and the two pure
// builders (detector + reader into notes, additions into draft stickies): everything usePhotoDraft holds that is
// not the gesture itself (docs/specs/021-event-storming/event-storming.md Phase 8, Phase 9).

import {
  eventStormingNoteSize,
  type Element,
  type PhotoAddition,
  type PhotoNote,
  type StickyElement,
  type Tab,
} from '@livediagram/document';
import { toNormalised, type DetectedSticky } from '@livediagram/sticky-vision';
import type { ModelDownload } from '@/lib/reading/download-progress';
import type { ProcessorReason, ReaderBackend } from '@/lib/reading/reader-protocol';
import type { ReaderFallback } from '@/lib/reading/types';
import { buildEventStormingNote } from '@/lib/draw-commit';
import type { PhotoDetection } from '@/lib/photo-detect';

export type PhotoDraftStage =
  | 'idle'
  // Decoding the photo and finding the stickies in it, here in the browser.
  | 'detecting'
  // The wizard: photo + boxes immediately, then the words stream in behind
  // them (a SEPARATE stage, not a gate in front of the photo).
  | 'review'
  | 'draft'
  | 'committing';

export type PhotoDraftState = {
  stage: PhotoDraftStage;
  // How many stickies the detector found, for the progress line.
  found: number;
  // How many crops the reader has finished, for the progress bar.
  readSoFar: number;
  // The reading model's download, while an in-browser reader fetches it
  // (~180 MB, once per device). Absent for a reader with nothing to download.
  modelDownload?: ModelDownload;
  // Where an in-browser reader runs: the graphics card, or the processor.
  readerBackend?: ReaderBackend;
  // Why it runs on the processor, when it does.
  readerWhy?: ProcessorReason;
  // Set when the hosted reader's budget was spent and this device read instead.
  readerFallback?: ReaderFallback;
  // The last failure's token, for the toast. Cleared by the next attempt.
  error: string | null;
};

export const EMPTY: PhotoDraftState = { stage: 'idle', found: 0, readSoFar: 0, error: null };

// What the review overlay shows and, on Add, lands. `detection` carries the
// photo (photoUrl), every detected box and the crops that were read; `textById`
// is the reader's answer keyed by box id. `readError` is set when the reader
// failed but the boxes are still worth showing blank.
export type PhotoReview = {
  // The photograph, shown the INSTANT it is picked: an object URL of the file
  // itself, so there is nothing to wait for. Everything else in this object
  // arrives later, behind it.
  photoUrl: string;
  // The file's own name. Only the ground-truth export uses it (a label file is
  // named after the photograph it describes); it is never shown and never sent.
  photoName: string;
  // Null while the detector is still looking. The overlay is already open and
  // showing the photo by then, which is the whole point: finding the stickies
  // in a 12-megapixel photo takes a moment, and a moment with no feedback is
  // indistinguishable from a broken button.
  detection: PhotoDetection | null;
  textById: Map<number, { text: string; legible: boolean }>;
  readError: string | null;
};
// The detector measured the geometry and the kind; the model read the words.
// Putting the two together is the only place they meet.
export function toPhotoNotes(
  detection: PhotoDetection,
  textById: Map<number, { text: string; legible: boolean }>,
): PhotoNote[] {
  return detection.stickies.map((sticky: DetectedSticky) => ({
    id: sticky.id,
    // An unreadable crop still becomes a note: the PAPER was there, and an
    // empty note the author can type into beats a note that never arrived.
    text: textById.get(sticky.id)?.text ?? '',
    kind: sticky.kind,
    size: sticky.size,
    ...toNormalised(sticky, detection.imageSize),
    row: sticky.row,
    order: sticky.order,
  }));
}

export type PhotoDraftDeps = {
  activeTab: Tab;
  activeId: string;
  ownerId: string;
  // Whether the api has a model configured. Decides WHO reads the handwriting:
  // the server model when there is one, the in-browser model when there is not
  // (docs/specs/021-event-storming/event-storming.md Phase 9). Never a gate on the import itself: both read.
  aiEnabled: boolean;
  createBlocked: boolean;
  // The gesture's three history verbs, exactly as the eraser and the drag use
  // them: arm one checkpoint, write through `tick`, and either leave the step
  // standing or cancel back to it.
  tick: (mapElements: (els: Element[]) => Element[]) => void;
  markCheckpoint: () => void;
  cancelToCheckpoint: () => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  // Frame a rectangle of canvas (the viewport's own helper). The draft calls
  // it so what just arrived (and the notes it was matched against) are on
  // screen, rather than somewhere off to the right under a panel.
  fitToBounds: (
    bbox: { x: number; y: number; w: number; h: number },
    opts?: { maxZoom?: number },
  ) => void;
  toastError: (message: string) => void;
};

export type PhotoDraftApi = {
  state: PhotoDraftState;
  // The review wizard's payload, set while `state.stage === 'review'`.
  review: PhotoReview | null;
  // True while the review wizard is open (nothing landed yet).
  reviewOpen: boolean;
  // True while notes from a photo are awaiting Add or Discard. Derived from
  // the ELEMENTS, so a reload mid-draft still knows.
  draftOpen: boolean;
  startFromFile: (file: File) => Promise<void>;
  // Add the boxes AS THEY STAND in the review (ticked, corrected, drawn) as
  // the on-canvas draft.
  confirm: (kept: DetectedSticky[], texts: Map<number, { text: string; legible: boolean }>) => void;
  // Leave the review without adding anything.
  cancelReview: () => void;
  accept: () => void;
  discard: () => void;
  cancelReading: () => void;
  // Read these boxes again, from their rectangles as they stand now (a box
  // the author moved, resized or drew). Queued behind any read in flight.
  reread: (boxes: DetectedSticky[]) => void;
  // How many boxes are queued or being read again.
  rereading: number;
};

export const ERROR_TOASTS: Record<string, string> = {
  crops_too_large: 'Those stickies came out too large to send. Try a smaller photo.',
  photo_unsupported_heic:
    'That looks like an iPhone HEIC photo. Save or export it as JPEG and try again.',
  photo_unsupported_type: 'That file is not a photo. Use a JPEG, PNG or WebP.',
  photo_unreadable: 'That photo could not be opened. Try another one.',
  photo_too_large: 'That photo is too large, even after resizing. Try a smaller one.',
  photo_invalid: 'That photo could not be read. Try another one.',
  ai_not_configured: 'Reading photos is not enabled on this deployment.',
  sign_in_required: 'Sign in to read a photo of your wall.',
  origin_not_allowed: 'Reading photos is not available from here.',
  rate_limited: 'Too many photos just now. Wait a moment and try again.',
  ai_quota: 'The model key is out of quota. Try later, or raise its limit.',
  ai_error: 'The reader could not finish. Try again in a moment.',
};

// Why a pick was refused. One per reason: "something is in the way" is not
// actionable, and the thing in the way is always on screen already.
export const BUSY_TOASTS = {
  review: 'A photo is already open. Finish or cancel that one first.',
  draft: 'Finish the last photo’s notes first: Add or Discard them.',
  blocked: 'This board cannot take new notes right now.',
} as const;

export const REREAD_FAILED_TOAST =
  'The changed notes could not be read again. Type their words in yourself.';

export const NO_NOTES_TOAST =
  'No stickies found in this photo. Fill the frame with the wall, shoot straight on, and give it good light.';

// Every draft note is minted through the ONE builder, then takes the position
// the reconciliation worked out.
export function buildDraftNotes(additions: PhotoAddition[], activeTab: Tab): StickyElement[] {
  return additions.map((addition) => {
    const size = eventStormingNoteSize(addition.kind);
    const note = buildEventStormingNote(
      addition.kind,
      addition.x + addition.width / 2,
      addition.y + addition.height / 2,
      activeTab,
    );
    const el: StickyElement = {
      ...note,
      label: addition.text,
      width: size.width,
      height: size.height,
      esDraft: true,
    };
    return el;
  });
}
