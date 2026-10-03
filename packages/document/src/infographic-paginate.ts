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
    groups.set(root, [...(groups.get(root) ?? []), i]);
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

/**
 * The tab laid out into pages, or null when there is nothing to do: no content, pages already
 * stored, or everything already inside the first page. At most MAX_INFOGRAPHIC_PAGES pages: clusters
 * past the last page share it.
 */
export function withContentPaginated<T extends Pick<Tab, 'elements'>>(
  tab: T & { pages?: unknown; pageOrientation?: unknown },
): (T & { pages: InfographicPage[] }) | null {
  if (tab.elements.length === 0 || Array.isArray(tab.pages)) return null;
  // Nothing to do while everything already fits inside the first page (edges included).
  const r = layOutInfographicPages(infographicPagesOf(tab))[0]!.rect;
  const fits = tab.elements.every((el) => {
    const b = boundsOf(el, tab.elements);
    return (
      b.x >= r.x - 1 && b.y >= r.y - 1 && b.r <= r.x + r.width + 1 && b.b <= r.y + r.height + 1
    );
  });
  if (fits) return null;
  const clusters = contentClusters(tab.elements);
  const capped =
    clusters.length <= MAX_INFOGRAPHIC_PAGES
      ? clusters
      : [
          ...clusters.slice(0, MAX_INFOGRAPHIC_PAGES - 1),
          clusters.slice(MAX_INFOGRAPHIC_PAGES - 1).flat(),
        ];
  const byId = new Map(tab.elements.map((el) => [el.id, el]));
  const pages: InfographicPage[] = capped.map((ids, i) => {
    const box = ids
      .map((id) => boundsOf(byId.get(id)!, tab.elements))
      .reduce((a, b) => ({
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        r: Math.max(a.r, b.r),
        b: Math.max(a.b, b.b),
      }));
    const wide = box.r - box.x > (box.b - box.y) * LANDSCAPE_RATIO;
    return { id: `page-${i + 1}`, orientation: wide ? 'landscape' : 'portrait' };
  });
  // The pages stored without moving anything (the content is off them all as yet), then each
  // cluster fitted into its page.
  let out = { ...tab, pages } as T & { pages: InfographicPage[] };
  capped.forEach((ids, i) => {
    out = withContentFittedToPage(out, new Set(ids), pages[i]!.id, { centre: true });
  });
  return out;
}
