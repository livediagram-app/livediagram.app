// Pages mode's alignment guides keep to one page (docs/specs/007-editor/pages-mode.md "Snapping on a page" in
// livedocuments and livedesign): a box moved, resized or dropped from the palette lines up with, and is spaced
// against, only what is on the page under it, and that page's own edges and margins, never another page's. Each
// editor's door (its lib/page-snap-scope.ts) hands in how it finds a page and an element's box.

export type SnapBox = { x: number; y: number; width: number; height: number };

const centre = (r: SnapBox) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

/** What a move, resize or palette drop snaps to and draws guides from: `spaced` (the elements, for equal spacing)
 *  and `aligned` (those plus the page's own snap boxes, whose ids end `:<page id>`). In Pages mode, only what is on
 *  the page under `rect`'s centre; off every page, only what is off every page. Outside the mode (no `pages`),
 *  everything. O(n log p) a frame: a centre and a page lookup per element. */
export function snapScope<E extends { id: string }, P extends { id: string }>(
  elements: E[],
  pageSnapBoxes: E[] | undefined,
  pages: readonly P[] | undefined,
  rect: SnapBox,
  how: {
    // The page a point is on (each editor's rowPageAt), none off every page.
    pageAt: (pages: readonly P[], point: { x: number; y: number }) => P | undefined;
    // An element's box, none for what has none (an arrow), which no page holds for snapping.
    boxOf: (el: E) => SnapBox | undefined;
  },
): { spaced: E[]; aligned: E[] } {
  if (!pages?.length) {
    const aligned = pageSnapBoxes?.length ? [...elements, ...pageSnapBoxes] : elements;
    return { spaced: elements, aligned };
  }
  const page = how.pageAt(pages, centre(rect));
  const spaced = elements.filter((el) => {
    const box = how.boxOf(el);
    return box !== undefined && how.pageAt(pages, centre(box)) === page;
  });
  if (!page || !pageSnapBoxes?.length) return { spaced, aligned: spaced };
  const own = `:${page.id}`;
  return { spaced, aligned: [...spaced, ...pageSnapBoxes.filter((b) => b.id.endsWith(own))] };
}
