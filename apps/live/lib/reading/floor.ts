// The smallest crop the in-browser reader is asked about (docs/specs/021-event-storming/event-storming.md Phase 9).
//
// Measured on 86 notes with known words (scripts/reader-bench.mts, shrinking
// each crop to a given short edge): see docs/vision/handwriting-readers.md.
// 48 px is where the curve crosses: there, as many answers are invented (CER
// over 60%) as are useful (CER up to 30%); at 56 px useful ones outnumber
// invented three to one, at 32 px inventions win 42 to 2. Below the floor the
// note is left unread instead, and the review's unread tip says a closer
// photo would help. A crop is its note at the photo's FULL resolution, padded
// 6% a side, so this is the note's size in the photo itself.
export const READ_MIN_EDGE_PX = 48;

export function tooSmallToRead(width: number, height: number): boolean {
  return Math.min(width, height) < READ_MIN_EDGE_PX;
}
