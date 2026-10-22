import {
  isDrawingElement,
  zoneAnchorOf,
  type Element,
  type LaidOutPage,
} from '@livedesign/document';

/**
 * Whether an element sits in an article's writing (docs/specs/007-editor/article-pages.md "Zones"): an object there
 * (a chart, an image, a table) connects to nothing, so it gets no quick-connect pluses. Undefined when no page holds
 * writing, so the selection derivation skips the check. A drawing is never in the writing.
 */
export function articlePlusBlocked(
  pages: readonly LaidOutPage[] | undefined,
  elements: readonly Element[],
): ((el: Element) => boolean) | undefined {
  if (!pages?.some((p) => p.flow)) return undefined;
  return (el: Element) => {
    if (isDrawingElement(el)) return false;
    const at = zoneAnchorOf(el, elements);
    return pages.some(
      (p) =>
        p.flow &&
        at.x >= p.rect.x &&
        at.x <= p.rect.x + p.rect.width &&
        at.y >= p.rect.y &&
        at.y <= p.rect.y + p.rect.height,
    );
  };
}
