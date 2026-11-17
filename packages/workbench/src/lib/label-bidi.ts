// How a label's editor lays out its text's direction (each product's docs/specs/008-canvas/canvas-and-palette.md
// "Labels", canvas-performance.md "Typing in a long label stays light").
//
// A label reads right to left line by line: `unicode-bidi: plaintext` (app/label-bidi.css) gives each line the
// direction of its own first letter. The browser pays for that with the square of a line's length: a
// 100,000-character line took 45 ms to lay out again on every keystroke (Work Tracker 1081). It changes nothing
// unless lines can differ, which takes a right-to-left letter and more than one line; otherwise `isolate` with the
// editor's `dir="auto"` gives the whole text the direction of its first letter, the first line's, and draws the same.

// The strong right-to-left letters: Hebrew, Arabic, Syriac, Thaana, NKo, Samaritan, Mandaic and the Arabic
// extensions (U+0590 to U+08FF), the Hebrew and Arabic presentation forms, and the astral right-to-left blocks
// (Cypriot to Old Turkic, Adlam and the Arabic mathematical letters). One character class, so one left-to-right
// scan with no backtracking. A few marks in these blocks are not strong letters; counting them only keeps the
// line-by-line layout where it was never needed.
const RIGHT_TO_LEFT = /[֐-ࣿיִ-﷿ﹰ-ﻼ\u{10800}-\u{10fff}\u{1e800}-\u{1efff}]/u;

/** Whether `text` holds a right-to-left letter. */
export function hasRightToLeftLetter(text: string): boolean {
  return RIGHT_TO_LEFT.test(text);
}

/**
 * The `unicode-bidi` a label's editor lays `text` out with: `plaintext` (each line in its own direction) when its
 * lines could read in different directions, else `isolate` (the whole text in its first letter's direction, with
 * `dir="auto"`), which draws the same at a cost that does not grow with the square of a line's length.
 */
export function labelEditorBidi(text: string): 'plaintext' | 'isolate' {
  return text.includes('\n') && hasRightToLeftLetter(text) ? 'plaintext' : 'isolate';
}
