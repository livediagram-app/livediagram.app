// Every page's own elements, found in one walk over the tab (docs/specs/007-editor/pages-mode.md
// "Contents" "Cost"): what each page's thumbnail draws from, rather than every page scanning the whole
// tab (which made a 100-page tab's pictures cost pages × elements). An element is on the page its
// anchor point lies on, exactly as elementIdsOnPage reads it. A page's arrows bring the elements
// their ends are pinned to (from any page, an arrow pinned to an arrow bringing that one's too), so
// an arrow still draws between its ends' real positions.
import {
  buildElementIndex,
  elementAnchorPoint,
  rowPageAt,
  type Element,
  type LaidOutPage,
} from '@livedesign/design';

export function pageElementBuckets(
  elements: readonly Element[],
  pages: readonly LaidOutPage[],
): Map<string, Element[]> {
  const index = buildElementIndex(elements as Element[]);
  const order = new Map(elements.map((el, i) => [el.id, i]));
  const own = new Map<string, Set<string>>(pages.map((p) => [p.id, new Set<string>()]));
  for (const el of elements) {
    const page = rowPageAt(pages, elementAnchorPoint(el, index));
    if (page) own.get(page.id)!.add(el.id);
  }
  const out = new Map<string, Element[]>();
  for (const [pageId, ids] of own) {
    // The ends an arrow on the page needs, followed through arrows pinned to arrows.
    const queue = [...ids];
    while (queue.length) {
      const el = index.get(queue.pop()!);
      if (el?.type !== 'arrow') continue;
      for (const end of [el.from, el.to]) {
        const ref =
          end.kind === 'pinned' ? end.elementId : end.kind === 'on-arrow' ? end.arrowId : undefined;
        if (ref !== undefined && index.has(ref) && !ids.has(ref)) {
          ids.add(ref);
          queue.push(ref);
        }
      }
    }
    // In the tab's order, so the paint order is the canvas's.
    out.set(
      pageId,
      [...ids].sort((a, b) => order.get(a)! - order.get(b)!).map((id) => index.get(id)!),
    );
  }
  return out;
}
