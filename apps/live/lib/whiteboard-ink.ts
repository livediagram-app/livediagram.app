// The whiteboard's projection over a whole element list (docs/specs/023-whiteboard/whiteboard.md
// "Appearance", "The colour picker"): every unpainted element in the board's ink and every named
// marker colour in its version for the viewer's board, cached per source object so an unchanged
// element keeps its identity between renders and the memoised element views stay quiet.
import { projectWhiteboardElement, type Appearance, type Element } from '@livediagram/document';

export function createInkProjector(): (elements: Element[], board: Appearance) => Element[] {
  let cacheBoard: Appearance | null = null;
  let cache = new WeakMap<Element, Element>();
  return (elements, board) => {
    if (board !== cacheBoard) {
      cacheBoard = board;
      cache = new WeakMap();
    }
    let changed = false;
    const out = elements.map((el) => {
      let projected = cache.get(el);
      if (!projected) {
        projected = projectWhiteboardElement(el, board);
        cache.set(el, projected);
      }
      if (projected !== el) changed = true;
      return projected;
    });
    return changed ? out : elements;
  };
}
