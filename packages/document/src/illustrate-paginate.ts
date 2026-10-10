// Putting a tab's content onto Illustrate pages (docs/specs/007-editor/illustrate-pages.md "Into
// pages"). Entering the mode never moves, resizes or scales an element: a board that does not fit
// its first page gets one page made around it, where it is (withContentOnAPage). Split Into Pages
// is the explicit action that breaks a Fit to Content page into one page per cluster (things
// joined by arrows, and things close together), in reading order, each cluster moved onto its own
// page and never scaled (withPageSplit). Pure: tab in, tab out, one edit.
import { elementIndexFor, endpointPosition } from './geometry';
import {
  illustratePageAt,
  illustratePagesOf,
  layOutIllustratePages,
  MAX_ILLUSTRATE_PAGES,
  nextIllustratePageId,
  pageDimensions,
  pageMargin,
  PAGE_NAME_MAX,
  withIllustratePages,
  type IllustratePage,
} from './illustrate-page';
import {
  elementAnchorPoint,
  elementIdsOnPage,
  withContentFittedToPage,
} from './illustrate-page-content';
import { clampPageSide, FIT_PAGE_MAX_SIDE } from './illustrate-page-fit';
import { isBoxed, type Element, type Tab } from './index';

// Two things this close (canvas px, edge to edge) belong together.
export const PAGINATE_CLUSTER_GAP = 120;
// The most pages Split Into Pages makes (docs/specs/007-editor/illustrate-pages.md "Into pages").
export const PAGINATE_MAX_PAGES = 20;
// Wider than this many times its height, content takes a landscape page.
export const LANDSCAPE_RATIO = 1.1;

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

const unionBox = (boxes: Box[]): Box =>
  boxes.reduce((a, b) => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    r: Math.max(a.r, b.r),
    b: Math.max(a.b, b.b),
  }));

/**
 * The page made around content with these bounds (docs/specs/007-editor/illustrate-pages.md "Into
 * pages"): an infographic page, landscape when the content is wider than LANDSCAPE_RATIO times its
 * height; A4 when the content fits A4's margin box that way round, else Fit to Content, the
 * content's bounds plus the page's margin all round (within the Fit to Content limits).
 */
export function pageAround(box: Box, id: string): IllustratePage {
  const w = Math.max(0, box.r - box.x);
  const h = Math.max(0, box.b - box.y);
  const orientation = w > h * LANDSCAPE_RATIO ? 'landscape' : 'portrait';
  const a4: IllustratePage = { id, orientation, kind: 'infographic' };
  const paper = pageDimensions(a4);
  const am = pageMargin(a4);
  if (w <= paper.width - 2 * am && h <= paper.height - 2 * am) return a4;
  // The margin is a share of the page's short side, which the margin itself grows: start from the
  // content's short side and widen until the page's own margin is no more than what was left.
  let m = Math.ceil(Math.min(w, h) * 0.07);
  for (;;) {
    const page: IllustratePage = {
      id,
      orientation,
      size: 'fit',
      fit: {
        width: clampPageSide(Math.ceil(w + 2 * m)),
        height: clampPageSide(Math.ceil(h + 2 * m)),
      },
      kind: 'infographic',
    };
    const own = pageMargin(page);
    // Past the largest side nothing more is gained: the content runs off the page, unscaled.
    const capped = page.fit!.width === FIT_PAGE_MAX_SIDE || page.fit!.height === FIT_PAGE_MAX_SIDE;
    if (own <= m || capped) return page;
    m = own;
  }
}

const contentBox = (tab: Pick<Tab, 'elements'>, ids?: ReadonlySet<string>): Box | null => {
  const els = ids ? tab.elements.filter((el) => ids.has(el.id)) : tab.elements;
  if (els.length === 0) return null;
  return unionBox(els.map((el) => boundsOf(el, tab.elements)));
};

/**
 * The tab with its content put onto a page on entering Illustrate mode, or null when there is
 * nothing to do (docs/specs/007-editor/illustrate-pages.md "Into pages"). No element moves:
 * - with no pages stored, content that does not fit inside the first page gets one page made
 *   around all of it, anchored on its centre (the row anchor);
 * - with pages stored, none an article page or locked and nothing on any page, the stored pages
 *   are replaced by that one page;
 * - otherwise null: content off the pages stays where it is.
 */
export function withContentOnAPage<T extends Pick<Tab, 'elements'>>(
  tab: T & { pages?: unknown; pageOrientation?: unknown },
): (T & { pages: IllustratePage[] }) | null {
  const box = contentBox(tab);
  if (!box) return null;
  const stored = Array.isArray(tab.pages) ? illustratePagesOf(tab) : null;
  const laid = layOutIllustratePages(illustratePagesOf(tab));
  if (!stored) {
    // Nothing to do while everything already fits inside the first page (edges included).
    const r = laid[0]!.rect;
    const fits =
      box.x >= r.x - 1 &&
      box.y >= r.y - 1 &&
      box.r <= r.x + r.width + 1 &&
      box.b <= r.y + r.height + 1;
    if (fits) return null;
  } else {
    // Only pages nobody has made anything of are replaced: a page with a kind of its own (an
    // article, a slide, a logo), a name, a paint or a lock is kept, and the content stays where it is.
    if (
      stored.some(
        (p) => p.flow || p.locked || (p.kind && p.kind !== 'infographic') || p.name || p.background,
      )
    )
      return null;
    const index = elementIndexFor(tab.elements);
    const onAPage = tab.elements.some((el) =>
      illustratePageAt(laid, elementAnchorPoint(el, index)),
    );
    if (onAPage) return null;
  }
  const page: IllustratePage = {
    ...pageAround(box, nextIllustratePageId(stored ?? [])),
    rowAt: { x: Math.round((box.x + box.r) / 2), y: Math.round((box.y + box.b) / 2) },
  };
  const { pageOrientation: _legacy, ...rest } = tab;
  void _legacy;
  return { ...(rest as T), pages: [page] };
}

/**
 * The tab with a Fit to Content page split into one page per cluster of its content, or null when
 * there is nothing to split (docs/specs/007-editor/illustrate-pages.md "Split Into Pages"): the
 * page is replaced, in its place in the row, by a page made around each cluster in reading order,
 * the cluster moved onto it, centred and never scaled; the pages after it move along. At most
 * PAGINATE_MAX_PAGES pages (and never past MAX_ILLUSTRATE_PAGES): clusters past the last share it.
 */
export function withPageSplit<T extends Pick<Tab, 'elements'>>(
  tab: T & { pages?: unknown; pageOrientation?: unknown },
  pageId: string,
): (T & { pages: IllustratePage[] }) | null {
  const pages = illustratePagesOf(tab);
  const index = pages.findIndex((p) => p.id === pageId);
  const target = pages[index];
  if (!target || target.size !== 'fit' || target.locked) return null;
  const ids = elementIdsOnPage(tab.elements, layOutIllustratePages(pages), pageId);
  const content = tab.elements.filter((el) => ids.has(el.id));
  const clusters = contentClusters(content);
  if (clusters.length < 2) return null;
  const room = Math.min(MAX_ILLUSTRATE_PAGES - (pages.length - 1), PAGINATE_MAX_PAGES);
  if (room < 2) return null;
  const capped =
    clusters.length <= room
      ? clusters
      : [...clusters.slice(0, room - 1), clusters.slice(room - 1).flat()];
  // Each new page keeps the split page's paint (its content was re-inked for it) and its name,
  // numbered after the first ("Overview", "Overview 2", ...).
  const added: IllustratePage[] = [];
  capped.forEach((group, i) => {
    const box = contentBox(tab, new Set(group))!;
    const name = target.name
      ? i === 0
        ? target.name
        : `${target.name.slice(0, PAGE_NAME_MAX - 4)} ${i + 1}`
      : undefined;
    added.push({
      ...pageAround(box, nextIllustratePageId([...pages, ...added])),
      ...(target.background ? { background: target.background } : {}),
      ...(name ? { name } : {}),
    });
  });
  // The new pages take the split page's place first: its content stays put (its page is gone) while
  // the pages after move along with theirs, and the row anchor stays (withIllustratePages). Then
  // each cluster is moved onto its page, centred, at its own size.
  let out = withIllustratePages(tab, [
    ...pages.slice(0, index),
    ...added,
    ...pages.slice(index + 1),
  ]);
  capped.forEach((group, i) => {
    out = withContentFittedToPage(out, new Set(group), added[i]!.id, {
      centre: true,
      keepSize: true,
    });
  });
  return out;
}
