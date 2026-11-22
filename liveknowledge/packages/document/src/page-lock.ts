// Locked pages (docs/specs/007-editor/pages-mode.md "Locking a page"): one copy for every product with pages,
// @liveworkspace/element-model/page-lock, its guard bound to this model's page layout.
import { guardLockedPages as guard } from '@liveworkspace/element-model/page-lock';
import { layOutPages, type Page } from './page';
import type { Element } from './index';

export { elementsOnLockedPages, hasLockedPage } from '@liveworkspace/element-model/page-lock';

/** `next` (an edit's elements) with nothing added to, moved onto or moved on a locked page. */
export function guardLockedPages(
  prev: Element[],
  next: Element[],
  prevPages: readonly Page[],
  nextPages: readonly Page[],
): { elements: Element[]; blocked: boolean } {
  return guard(layOutPages, prev, next, prevPages, nextPages);
}
