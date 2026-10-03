// Laying a tab's content out into Infographic pages (docs/specs/007-editor/infographic-pages.md
// "Into pages"), for a tab entering the mode with content that does not fit inside its first page:
// the content is split into clusters (things joined by arrows, and things close together), the
// clusters are put in reading order, and each gets a page of its own, turned to suit its shape,
// its content scaled down to fit where it must and centred. Pure: tab in, tab out, one edit.
import { endpointPosition } from './geometry';
import {
  infographicPagesOf,
  layOutInfographicPages,
  MAX_INFOGRAPHIC_PAGES,
  nextInfographicPageId,
  type InfographicPage,
} from './infographic-page';
import { withContentFittedToPage } from './infographic-page-content';
import { isBoxed, type Element, type Tab } from './index';

// Two things this close (canvas px, edge to edge) belong together.
export const PAGINATE_CLUSTER_GAP = 120;
// Wider than this many times its height, a cluster takes a landscape page.
const LANDSCAPE_RATIO = 1.1;

type Box = { x: number; y: number; r: number; b: number };

function boundsOf(el: Element, elements: Element[]): Box {
  if (isBoxed(el)) return { x: el.x, y: el.y, r: el.x + el.width, b: el.y + el.height };
  const a = endpointPosition(el.from, elements);
  const c = endpointPosition(el.to, elements);
  return {
    x: Math.min(a.x, c.x),
    y: Math.min(a.y, c.y),
    r: Math.max(a.x, c.x),
    b: Math.max(a.y, c.y),
  };
}

const near = (a: Box, b: Box, gap: number) =>
  a.x - gap <= b.r && b.x - gap <= a.r && a.y - gap <= b.b && b.y - gap <= a.b;

/** The content's clusters, each a set of element ids, in reading order (rows top to bottom, each
 *  row left to right). */
export function contentClusters(elements: Element[], gap = PAGINATE_CLUSTER_GAP): string[][] {
  const n = elements.length;
  const parent = elements.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const join = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  const index = new Map(elements.map((el, i) => [el.id, i]));
  const boxes = elements.map((el) => boundsOf(el, elements));
  elements.forEach((el, i) => {
    if (el.type !== 'arrow') return;
    for (const end of [el.from, el.to]) {
      if (end.kind === 'pinned') {
        const j = index.get(end.elementId);
        if (j !== undefined) join(i, j);
      }
    }
  });
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (near(boxes[i]!, boxes[j]!, gap)) join(i, j);
    }
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(i);
    else groups.set(root, [i]);
  }
  const clusters = [...groups.values()].map((members) => {
    const box = members.reduce<Box>(
      (acc, i) => ({
        x: Math.min(acc.x, boxes[i]!.x),
        y: Math.min(acc.y, boxes[i]!.y),
        r: Math.max(acc.r, boxes[i]!.r),
        b: Math.max(acc.b, boxes[i]!.b),
      }),
      { x: Infinity, y: Infinity, r: -Infinity, b: -Infinity },
    );
    return { ids: members.map((i) => elements[i]!.id), box };
  });
  // Reading order: by top, grouped into rows of clusters that overlap the row's first vertically.
  clusters.sort((a, b) => a.box.y - b.box.y);
  const rows: (typeof clusters)[] = [];
  for (const c of clusters) {
    const row = rows[rows.length - 1];
    if (row && c.box.y < row[0]!.box.b) row.push(c);
    else rows.push([c]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.box.x - b.box.x).map((c) => c.ids));
}

// Under this share of its area on the pages, a cluster counts as stray.
const STRAY_SHARE = 0.5;

const overlapArea = (a: Box, r: { x: number; y: number; width: number; height: number }) =>
  Math.max(0, Math.min(a.r, r.x + r.width) - Math.max(a.x, r.x)) *
  Math.max(0, Math.min(a.b, r.y + r.height) - Math.max(a.y, r.y));

const unionBox = (boxes: Box[]): Box =>
  boxes.reduce((a, b) => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    r: Math.max(a.r, b.r),
    b: Math.max(a.b, b.b),
  }));

/**
 * The tab laid out into pages, or null when there is nothing to do (docs/specs/007-editor/
 * infographic-pages.md "Into pages"):
 * - with no pages stored, content that does not fit inside the first page is laid out afresh;
 * - with pages stored, each cluster less than half on the pages (by area) is stray: stray clusters
 *   go onto new pages after the last, or the tab is laid out afresh when nothing else is on a page.
 * At most MAX_INFOGRAPHIC_PAGES pages: clusters past the last page share it.
 */
export function withContentPaginated<T extends Pick<Tab, 'elements'>>(
  tab: T & { pages?: unknown; pageOrientation?: unknown },
): (T & { pages: InfographicPage[] }) | null {
  if (tab.elements.length === 0) return null;
  const stored = Array.isArray(tab.pages) ? infographicPagesOf(tab) : null;
  const laid = layOutInfographicPages(infographicPagesOf(tab));
  const boxOf = (el: Element) => boundsOf(el, tab.elements);
  if (!stored) {
    // Nothing to do while everything already fits inside the first page (edges included).
    const r = laid[0]!.rect;
    const fits = tab.elements.every((el) => {
      const b = boxOf(el);
      return (
        b.x >= r.x - 1 && b.y >= r.y - 1 && b.r <= r.x + r.width + 1 && b.b <= r.y + r.height + 1
      );
    });
    return fits ? null : paginate(tab, tab.elements, []);
  }
  // A cluster less than half on the pages (by area) is stray: it gets a page of its own.
  const byId = new Map(tab.elements.map((el) => [el.id, el]));
  const strayIds = contentClusters(tab.elements).filter((ids) => {
    // A line (a straight arrow, a rule) has no area: grown a pixel each way, so its share is real.
    const raw = unionBox(ids.map((id) => boxOf(byId.get(id)!)));
    const box = { x: raw.x - 1, y: raw.y - 1, r: raw.r + 1, b: raw.b + 1 };
    const area = (box.r - box.x) * (box.b - box.y);
    const onPages = laid.reduce((sum, p) => sum + overlapArea(box, p.rect), 0);
    return onPages / area < STRAY_SHARE;
  });
  if (strayIds.length === 0) return null;
  const stray = new Set(strayIds.flat());
  const content = tab.elements.filter((el) => stray.has(el.id));
  const pagesEmpty = stray.size === tab.elements.length;
  return pagesEmpty
    ? paginate({ ...tab, pages: undefined }, tab.elements, [])
    : paginate(tab, content, stored);
}

// `content` laid onto new pages after `kept` (the tab's pages that stay).
function paginate<T extends Pick<Tab, 'elements'>>(
  tab: T & { pages?: unknown },
  content: Element[],
  kept: InfographicPage[],
): T & { pages: InfographicPage[] } {
  const room = MAX_INFOGRAPHIC_PAGES - kept.length;
  // No room for another page: the clusters share the last page, centred and fitted there.
  if (room <= 0) {
    const last = kept[kept.length - 1]!;
    const out = { ...tab, pages: kept } as T & { pages: InfographicPage[] };
    return withContentFittedToPage(out, new Set(content.map((el) => el.id)), last.id, {
      centre: true,
    });
  }
  const clusters = contentClusters(content);
  const capped =
    clusters.length <= room
      ? clusters
      : [...clusters.slice(0, room - 1), clusters.slice(room - 1).flat()];
  const byId = new Map(tab.elements.map((el) => [el.id, el]));
  const added: InfographicPage[] = [];
  for (const ids of capped) {
    const box = ids
      .map((id) => boundsOf(byId.get(id)!, tab.elements))
      .reduce((a, b) => ({
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        r: Math.max(a.r, b.r),
        b: Math.max(a.b, b.b),
      }));
    const wide = box.r - box.x > (box.b - box.y) * LANDSCAPE_RATIO;
    added.push({
      id: nextInfographicPageId([...kept, ...added]),
      orientation: wide ? 'landscape' : 'portrait',
    });
  }
  // The pages stored without moving anything (the content is off the new ones as yet), then each
  // cluster fitted into its page.
  let out = { ...tab, pages: [...kept, ...added] } as T & { pages: InfographicPage[] };
  capped.forEach((ids, i) => {
    out = withContentFittedToPage(out, new Set(ids), added[i]!.id, { centre: true });
  });
  return out;
}
