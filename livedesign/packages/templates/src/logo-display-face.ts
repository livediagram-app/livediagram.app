// A template's words set in a display face (docs/specs/004-interface-design/fonts.md "The display library"): the
// face's id on the element, and a one-weight face drawn at its own weight rather than a synthesised bold.
import { displayFontById, type Element } from '@livedesign/design';

/** True when a display face ships one weight (its Google spec names no weights). */
export function isOneWeightFace(id: string): boolean {
  const face = displayFontById(id);
  return !!face && !face.google.includes(':wght@');
}

/** A text element set in a display face; any other element as it is. */
export function inDisplayFace(el: Element, face: string): Element {
  if (el.type !== 'text') return el;
  if (!isOneWeightFace(face)) return { ...el, font: face };
  const { textBold: _bold, ...rest } = el;
  return { ...rest, font: face, fontWeight: 400 };
}
