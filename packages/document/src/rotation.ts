// Which elements can be rotated (docs/specs/008-canvas/canvas-and-palette.md, the Rotation category).
// Every boxed element carries `rotation` except an annotation marker: it is a round numbered pin, so
// turning it only turns its number (docs/specs/009-elements/blueprints/annotations.md [QD8]). One
// predicate gates the element menu's Rotation category, the Rotate commands and the rotation write,
// so no surface can offer what another refuses.

import { isBoxed, type BoxedElement, type Element } from './index';

export function supportsRotation(el: Element): el is BoxedElement {
  return isBoxed(el) && el.type !== 'annotation';
}
