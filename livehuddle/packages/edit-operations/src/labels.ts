// Labels (docs/specs/024-agents/blueprints/edit-operations.md "Fields and values", EO18, EO22): a
// shape's label over LABEL_CAP_MAX keeps its heading and the rest is cut, with nothing moved into a note (livehuddle
// shows none, Work Tracker 737); any other element's label is its content and stays whole. A shape whose label no
// longer fits grows around its centre, never shrinking.

import { LABEL_CAP_MAX, capLabel, labelBoxSize, type Element } from '@livehuddle/document';

type LabelWrite = { label: string; capped: boolean };

/** What a `label_capped` warning tells the agent after the heading it kept. */
export const LABEL_CUT_ADVICE = `the rest was cut (a label holds ${LABEL_CAP_MAX} characters: put longer text in a text element or a sticky)`;

// The label to store, and whether it was cut to its heading.
export function applyLabel(el: Element, text: string): LabelWrite {
  if (el.type !== 'shape' && el.type !== 'arrow') return { label: text, capped: false };
  const { label, cut } = capLabel(text);
  return { label, capped: cut };
}

export type Fit = { widened?: [number, number]; taller?: [number, number] };

// The shape grown around its centre to hold its new label, and by how much (`labelBoxSize` is what a label
// needs). A box with room beyond its old label's need grows only to the new need; a box smaller than its
// old label's need grows by the difference between the two needs, so a label no longer than the last
// leaves it be. Unchanged when fixed-size or scaling its text to the box; it never shrinks.
export function fitToLabel(before: Element, el: Element): { el: Element; fit: Fit } {
  if (el.type !== 'shape' || before.type !== 'shape' || el.fixedSize || el.textSize === 'scale')
    return { el, fit: {} };
  // A retired kind never gets here: `set` refuses one (Work Tracker 639), and `shape=` takes only kinds livehuddle has.
  const was = labelBoxSize(before.label, before.shape);
  const now = labelBoxSize(el.label, el.shape);
  const grown = (size: number, old: number, needed: number) =>
    Math.max(size, size + needed - Math.max(old, size));
  const width = grown(el.width, was.width, now.width);
  const height = grown(el.height, was.height, now.height);
  if (width === el.width && height === el.height) return { el, fit: {} };
  const fit: Fit = {
    ...(width !== el.width ? { widened: [el.width, width] as [number, number] } : {}),
    ...(height !== el.height ? { taller: [el.height, height] as [number, number] } : {}),
  };
  return {
    el: {
      ...el,
      x: Math.round(el.x - (width - el.width) / 2),
      y: Math.round(el.y - (height - el.height) / 2),
      width,
      height,
    },
    fit,
  };
}
