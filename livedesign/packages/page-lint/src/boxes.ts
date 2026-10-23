// What the lint calls a box (blueprint "The checks", LN2): a boxed element that is not a container, text,
// annotation, stroke or path, with a usable rect.

import { type BoxedElement, type Element, isBoxed, isContainer } from '@livedesign/design';

const NOT_BOXES: ReadonlySet<string> = new Set(['text', 'annotation', 'freehand', 'path']);

export const finiteRect = (el: Pick<BoxedElement, 'x' | 'y' | 'width' | 'height'>) =>
  [el.x, el.y, el.width, el.height].every((v) => Number.isFinite(v));

export function isLintBox(el: Element): el is BoxedElement {
  return isBoxed(el) && !isContainer(el) && !NOT_BOXES.has(el.type) && finiteRect(el);
}
