import type { EventStormingNoteKind } from '@livediagram/diagram';

// Reading a photograph of a sticky-note wall (spec/139 Phase 8). The wire
// contract between the api route that asks the vision model and the editor
// that reconciles the answer against the board.
//
// The split is the whole design: the MODEL is asked only what it can SEE, and
// the matching / placing is ours — pure, deterministic and unit-tested in
// `@livediagram/diagram`. Nothing here asks the model which notes are already
// on the board, because that is a question about our data, not the photo.

// One sticky the model found. Every box field is NORMALISED to the image
// (0..1), so the numbers survive the client's downscale and mean the same
// thing whatever the photo's pixel size.
export type DetectedNote = {
  // Stable within one response, so the review list and the reconciliation can
  // refer to the same note without matching on text.
  id: number;
  // Verbatim, as written on the paper. Never cleaned up, corrected or
  // expanded: the wall is the source, and a "helpful" rewrite would silently
  // rename the domain.
  text: string;
  // Read from the PAPER COLOUR against the notation's own catalogue, or
  // 'unknown' when the colour is not one of them (or cannot be judged).
  kind: EventStormingNoteKind | 'unknown';
  // The colour the model actually saw, as a hex string — kept so a review can
  // show WHY a kind was chosen, and so an unknown is still describable.
  colour: string;
  // The stationery silhouette, which is notation too (spec/139 Phase 4).
  size: 'square' | 'wide' | 'small';
  // Centre + extent, normalised 0..1 against the image.
  cx: number;
  cy: number;
  w: number;
  h: number;
  // Which ROW of the wall it sits in (0 = top), and its position along that
  // row (0 = left-most). The model is far better at this than geometry alone,
  // because it can see a wall that sags.
  row: number;
  order: number;
  // 0..1. A partly-covered sticky is still worth reading — this says how sure
  // the reading is, so a review can flag it rather than hide it.
  confidence: number;
};

export type PhotoNotesRequest = {
  // A data URL: `data:image/jpeg;base64,…`. JPEG / PNG / WebP only.
  image: string;
  // The tab's name, for the prompt's context. Optional and bounded.
  tabName?: string;
};

export type PhotoNotesResponse = {
  notes: DetectedNote[];
  // False when the model judges this is not a photo of a sticky-note wall at
  // all. A 200, not an error: nothing failed, there is simply nothing to add.
  wall: boolean;
  // One short line for the author when something is off ("try filling the
  // frame"), never free-form model prose about the domain.
  hint?: string;
};

// The client downscales to this longest edge before sending, and the route
// caps the decoded bytes. Shared for the same reason the image-upload cap is
// (see image-limits.ts): the editor pre-flights against the number the route
// enforces, so it can never approve a photo the route will refuse.
export const PHOTO_MAX_EDGE_PX = 2048;
export const PHOTO_MAX_BYTES = 6 * 1024 * 1024;
// The most notes one photo may yield. A wall section holds tens, not hundreds;
// the cap bounds the model's output tokens and the review list alike.
export const PHOTO_MAX_NOTES = 120;

// What a photo may be, on the wire. GIF is absent (animation means nothing
// here and the first frame is a trap), and SVG is absent for the same reason
// spec/19 keeps it out of uploads: it is XML that can carry script.
export const PHOTO_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoAcceptedType = (typeof PHOTO_ACCEPTED_TYPES)[number];

export function isPhotoAcceptedType(type: string): type is PhotoAcceptedType {
  return (PHOTO_ACCEPTED_TYPES as readonly string[]).includes(type);
}
