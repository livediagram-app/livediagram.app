import { landInView, PASTE_OFFSET, pasteBounds } from '@liveworkspace/model-core/paste-placement';
import {
  elementBounds,
  retiredArrowEnds,
  type Element,
  type Rect,
  type RetiredArrowElement,
} from '@livehuddle/document';

// Where a paste lands (docs/specs/008-canvas/canvas-and-palette.md Clipboard). Pure, so the rule is one
// testable answer rather than a pile of conditions inside the clipboard hook.
//
// The copies land 24px down and right of the originals. A paste that would land OUT OF VIEW lands in the
// middle of the view instead: the rule and the measuring are every editor's
// (`@liveworkspace/model-core/paste-placement`), with this model's geometry.

export { PASTE_OFFSET };

// A stored arrow's end resolves as the arrow's line does (retiredArrowEnds), so a copied arrow measures where it draws.
const GEOMETRY = {
  elementBounds,
  endpointPosition: (end: RetiredArrowElement['from'], all: Element[]) =>
    retiredArrowEnds({ from: end, to: end } as RetiredArrowElement, all).from,
};

export function pasteTranslation(
  source: readonly Element[],
  view: Rect | null = null,
): { dx: number; dy: number } {
  return landInView(view && pasteBounds(source, GEOMETRY), PASTE_OFFSET, PASTE_OFFSET, view);
}
