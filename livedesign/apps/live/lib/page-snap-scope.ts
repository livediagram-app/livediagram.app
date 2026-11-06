// Pages mode's alignment guides keep to one page (docs/specs/007-editor/pages-mode.md "Snapping on a page"): the
// shared rule (@liveworkspace/workbench/lib/page-snap-scope) with this editor's pages and boxes.
import { isBoxed, rowPageAt, type Element, type LaidOutPage } from '@livedesign/design';
import {
  snapScope as sharedSnapScope,
  type SnapBox,
} from '@liveworkspace/workbench/lib/page-snap-scope';

const how = {
  pageAt: rowPageAt,
  boxOf: (el: Element): SnapBox | undefined => (isBoxed(el) ? el : undefined),
};

/** What a move, resize or palette drop snaps to in Pages mode: only what is on the page under `rect`. */
export function snapScope(
  elements: Element[],
  pageSnapBoxes: Element[] | undefined,
  pages: readonly LaidOutPage[] | undefined,
  rect: SnapBox,
): { spaced: Element[]; aligned: Element[] } {
  return sharedSnapScope(elements, pageSnapBoxes, pages, rect, how);
}
