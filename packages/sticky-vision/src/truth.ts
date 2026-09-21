// GROUND TRUTH: the notes a human says are on a wall.
//
// A detection COUNT cannot tell a fix from a regression once false positives
// are in play — a change that finds two more notes and invents five scores
// higher on "how many did we find" and is a loss. So the detector is scored
// against labels, and this module owns what a label IS. The scorer that
// consumes them lives with the sweep (`scripts/truth.ts`), because measuring
// is a tool's job; the FORMAT lives here, because two callers write it: the
// sweep reads labels, and the editor's review surface produces them.
//
// Every box is a FRACTION of the image, so labels survive any working size:
// the detector runs at 1000px today and the labels would still be true at
// 4000. The labels themselves never enter this repository — they describe
// somebody's real workshop wall, exactly like the photographs do.

export type TruthNote = { x: number; y: number; w: number; h: number; kind: string };

export type Truth = {
  // The photograph's file name without its extension, which is also the
  // label file's own name.
  photo: string;
  // What the boxes were read off. Not used in scoring (the fractions are
  // size-free); recorded so a label can be checked against the thing it
  // describes later.
  labelledOn: { width: number; height: number };
  notes: TruthNote[];
};

// Three decimals is a fifth of a note at a 1000px working size, which is finer
// than anyone reads a centre off a photograph by eye. More places would only
// make a diff between two labellings noisy.
const PLACES = 3;

const round = (value: number) => Number(value.toFixed(PLACES));

// Corrected boxes in working-image PIXELS become labels in fractions.
export function truthFrom(
  fileName: string,
  size: { width: number; height: number },
  boxes: readonly { x: number; y: number; w: number; h: number; kind: string }[],
): Truth {
  if (size.width <= 0 || size.height <= 0) {
    throw new Error(`truthFrom needs a real image size, got ${size.width}x${size.height}`);
  }
  const notes = boxes
    .map((box) => ({
      x: round(box.x / size.width),
      y: round(box.y / size.height),
      w: round(box.w / size.width),
      h: round(box.h / size.height),
      kind: box.kind,
    }))
    // Down the wall, then across it: the same wall labelled twice produces the
    // same file, so a diff between two labellings is a real disagreement
    // rather than a reshuffle.
    .sort((a, b) => a.y - b.y || a.x - b.x);
  return { photo: fileName.replace(/\.[^.]+$/, ''), labelledOn: size, notes };
}
