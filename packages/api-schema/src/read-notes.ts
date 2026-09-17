// Reading the text on sticky-note crops (spec/139 Phase 8). The wire contract
// between the api route that asks the model and the editor that cut the crops.
//
// The split is the whole design: the stickies are FOUND in the browser, by
// measurement (`@livediagram/sticky-vision`), and the model is asked one
// question about each one — what does it say. So the geometry never depends on
// a model's coordinate sense, and the whole photograph never leaves the
// machine it was taken on: only the crops do.

// One sticky's picture, cut out of the full-resolution photo and re-encoded.
export type NoteCrop = {
  // The detector's id for this sticky, echoed back so the answer can be
  // matched to the paper without matching on text.
  id: number;
  // A data URL: `data:image/jpeg;base64,…`. JPEG / PNG / WebP only.
  image: string;
};

export type ReadNotesRequest = { crops: NoteCrop[] };

export type NoteText = {
  id: number;
  // Verbatim, as written on the paper. Never corrected, expanded or tidied:
  // these are domain terms, and a helpful rewrite renames somebody's business.
  text: string;
  // False when the model could not read it. That is a real answer, not a
  // failure — the paper WAS there, so the note still lands, empty, for the
  // author to fill in.
  legible: boolean;
};

export type ReadNotesResponse = { texts: NoteText[] };

// How many crops go in one request. Small enough that one unreadable image
// cannot cost a whole run, big enough that a wall section is a handful of
// calls rather than fifty.
//
// SIX, measured, not guessed: against a real hosted flash model a 16-image
// request answered 503 "this model is currently experiencing high demand"
// every single time while the 5-image request beside it succeeded every time.
// A 503 from a busy-sounding message is easy to read as bad luck; it was the
// weight of the payload. Six keeps a wall section to a handful of calls and
// stopped the failures dead.
export const READ_MAX_CROPS_PER_REQUEST = 6;
// A sticky is a square of paper with a few words on it: 512px on the longest
// edge is more than enough to read marker handwriting, and a fraction of the
// bytes of the photo it came from.
export const CROP_MAX_EDGE_PX = 512;
export const CROP_MAX_BYTES = 512 * 1024;
// The working image the detector runs on.
//
// ONE THOUSAND, deliberately: the detector was calibrated at this size and
// finds the most notes here. At 2048 the working image is noisier after the
// browser's downscale and detection DROPS (8 found where 1000px found 35).
// This only ever feeds detection — the handwriting crops are cut from the
// full-resolution bitmap, so reading loses nothing.
export const PHOTO_MAX_EDGE_PX = 1000;
// The most notes one photo may yield. A wall section holds tens, not hundreds.
export const PHOTO_MAX_NOTES = 120;

// What a crop may be, on the wire. GIF is absent (animation means nothing here
// and the first frame is a trap), and SVG is absent for the same reason
// spec/19 keeps it out of uploads: it is XML that can carry script.
export const PHOTO_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoAcceptedType = (typeof PHOTO_ACCEPTED_TYPES)[number];

export function isPhotoAcceptedType(type: string): type is PhotoAcceptedType {
  return (PHOTO_ACCEPTED_TYPES as readonly string[]).includes(type);
}
