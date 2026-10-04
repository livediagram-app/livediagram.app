// Labels (docs/specs/024-agents/blueprints/edit-operations.md "Fields and values", EO18, EO22): a
// shape's label over GRAPH_LABEL_MAX keeps its heading and moves the whole text into its note, as
// graph input does; an arrow's is cut; any other element's label is its content and stays whole. A
// shape whose label no longer fits grows around its centre, never shrinking.

import { capLabel, labelBoxSize, type Element } from '@livediagram/document';

export type LabelWrite = { label: string; note?: string; capped: boolean };

// The label to store, and the note it ends with when the whole text moved there. `note` is the note
// the element ends with otherwise.
export function applyLabel(el: Element, text: string, note: string | undefined): LabelWrite {
  if (el.type !== 'shape' && el.type !== 'arrow') return { label: text, capped: false };
  const { label, cut } = capLabel(text);
  if (!cut) return { label, capped: false };
  if (el.type === 'arrow') return { label, capped: true };
  const whole = text.replace(/\s+/g, ' ').trim();
  return { label, note: note ? `${whole}\n\n${note}` : whole, capped: true };
}

export type Fit = { widened?: [number, number]; taller?: [number, number] };

// The shape grown around its centre to hold its new label, and by how much (`labelBoxSize` is what a label
// needs). A box with room beyond its old label's need grows only to the new need; a box smaller than its
// old label's need grows by the difference between the two needs, so a label no longer than the last
// leaves it be. Unchanged when fixed-size or scaling its text to the box; it never shrinks.
export function fitToLabel(before: Element, el: Element): { el: Element; fit: Fit } {
  if (el.type !== 'shape' || before.type !== 'shape' || el.fixedSize || el.textSize === 'scale')
    return { el, fit: {} };
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
