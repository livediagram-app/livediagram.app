// A Pages tab split by page (split.ts): each page and the elements on it to livedocuments or livedesign.
import type { SplitHooks } from './contract';
import { PageIndex, type PageRect } from './page-index';
import {
  DESIGN_PAGE_KINDS,
  DOCUMENT_PAGE_KINDS,
  isArticleNote,
  isRec,
  num,
  type Family,
  type Rec,
} from './split-model';

export const familyOf = (page: unknown): Family | null => {
  const kind = isRec(page) ? page.kind : undefined;
  if (DESIGN_PAGE_KINDS.has(kind)) return 'livedesign';
  if (DOCUMENT_PAGE_KINDS.has(kind)) return 'livedocuments';
  return null;
};

// An element's centre, for the page it sits on; an arrow's comes from its ends (below).
function boxCentre(el: Rec): [number, number] | null {
  const { x, y, width, height } = el;
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  return [x + num(width, 0) / 2, y + num(height, 0) / 2];
}

function freePoint(end: unknown): [number, number] | null {
  if (!isRec(end) || end.kind !== 'free') return null;
  return typeof end.x === 'number' && typeof end.y === 'number' ? [end.x, end.y] : null;
}

function translated(el: Rec, dx: number, dy: number): Rec {
  if (el.type === 'arrow') {
    const move = (end: unknown) =>
      isRec(end) && end.kind === 'free' && typeof end.x === 'number' && typeof end.y === 'number'
        ? { ...end, x: end.x + dx, y: end.y + dy }
        : end;
    return { ...el, from: move(el.from), to: move(el.to) };
  }
  if (typeof el.x !== 'number' || typeof el.y !== 'number') return el;
  return { ...el, x: el.x + dx, y: el.y + dy };
}

type Half = { body: Rec; pages: number; elementIds: string[] };

// A Pages tab with pages of both families, split by page: each element goes with the page its centre is on (an arrow
// with the element it is pinned to, else its ends' midpoint), an element on no page, and every article margin note,
// with the documents half. Articles follow their pages. Each half's pages are laid out again by the app's own rule, so
// an element moves by as much as its page did, and keeps its place on the page.
export function splitPagesTab(body: Rec, hooks: SplitHooks): Map<Family, Half> {
  const pages = body.pages as unknown[];
  const pageFamily = new Map<string, Family>();
  for (const page of pages) {
    if (isRec(page) && typeof page.id === 'string')
      pageFamily.set(page.id, familyOf(page) ?? 'livedocuments');
  }
  const oldRects = new Map<string, PageRect>();
  for (const r of hooks.pageRects(body)) oldRects.set(r.pageId, r);
  const index = new PageIndex([...oldRects.values()]);

  const elements = Array.isArray(body.elements) ? (body.elements as unknown[]) : [];
  const pageOf: (string | null)[] = new Array<string | null>(elements.length).fill(null);
  const famOf: Family[] = new Array<Family>(elements.length).fill('livedocuments');
  const byId = new Map<string, number>();
  const resolved: boolean[] = new Array<boolean>(elements.length).fill(false);

  const place = (i: number, page: string | null) => {
    const fam = page ? (pageFamily.get(page) ?? 'livedocuments') : 'livedocuments';
    pageOf[i] = page;
    famOf[i] = fam;
    resolved[i] = true;
  };

  // Boxed elements first: arrows follow what they're pinned to.
  elements.forEach((el, i) => {
    if (!isRec(el)) {
      resolved[i] = true;
      return;
    }
    if (typeof el.id === 'string') byId.set(el.id, i);
    if (el.type === 'arrow') return;
    const c = boxCentre(el);
    const page = c ? index.pageAt(c[0], c[1]) : null;
    if (isArticleNote(el)) {
      // A margin note belongs beside its article, which is the documents half's.
      place(i, page && pageFamily.get(page) === 'livedocuments' ? page : null);
      return;
    }
    place(i, page);
  });
  const anchorOf = (end: unknown): number | undefined => {
    if (!isRec(end)) return undefined;
    const id =
      end.kind === 'pinned' ? end.elementId : end.kind === 'on-arrow' ? end.arrowId : undefined;
    const at = typeof id === 'string' ? byId.get(id) : undefined;
    return at !== undefined && resolved[at] ? at : undefined;
  };
  // Arrows on arrows resolve once the arrow they sit on has; two passes settle any chain the old editor made, and
  // whatever is left goes by its ends' midpoint.
  for (let pass = 0; pass < 2; pass++) {
    elements.forEach((el, i) => {
      if (resolved[i] || !isRec(el)) return;
      const at = anchorOf(el.from) ?? anchorOf(el.to);
      if (at !== undefined) {
        pageOf[i] = pageOf[at]!;
        famOf[i] = famOf[at]!;
        resolved[i] = true;
      }
    });
  }
  elements.forEach((el, i) => {
    if (resolved[i] || !isRec(el)) return;
    const a = freePoint(el.from);
    const b = freePoint(el.to);
    const c = a && b ? ([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const) : (a ?? b);
    place(i, c ? index.pageAt(c[0], c[1]) : null);
  });

  // The row's anchor (where the first page's centre sits) rides on one page; a half that lost it takes it on its own
  // first page, so it starts where the row did.
  const rowAt = (pages.find((p) => isRec(p) && p.rowAt !== undefined) as Rec | undefined)?.rowAt;
  const articles = isRec(body.articles) ? body.articles : undefined;
  // The articles the design pages show (none, in practice: article pages are documents'); every other article, shown
  // or not, stays with the documents half.
  const designFlows = new Set<unknown>();
  for (const p of pages) {
    if (isRec(p) && typeof p.id === 'string' && pageFamily.get(p.id) === 'livedesign')
      designFlows.add(p.flow);
  }
  const halves = new Map<Family, Half>();
  for (const fam of ['livedocuments', 'livedesign'] as const) {
    let halfPages = pages.filter(
      (p) => isRec(p) && typeof p.id === 'string' && pageFamily.get(p.id) === fam,
    );
    if (rowAt !== undefined && !halfPages.some((p) => isRec(p) && p.rowAt !== undefined)) {
      halfPages = [{ ...(halfPages[0] as Rec), rowAt }, ...halfPages.slice(1)];
    }
    const halfArticles: Rec = {};
    let anyArticle = false;
    if (articles) {
      for (const key in articles) {
        if (designFlows.has(key) === (fam === 'livedesign')) {
          halfArticles[key] = articles[key];
          anyArticle = true;
        }
      }
    }
    const halfElements: unknown[] = [];
    const elementIds: string[] = [];
    elements.forEach((el, i) => {
      if (famOf[i] !== fam) return;
      halfElements.push(el);
      if (isRec(el) && typeof el.id === 'string') elementIds.push(el.id);
    });
    const halfBody: Rec = { ...body, pages: halfPages, elements: halfElements };
    if (anyArticle) halfBody.articles = halfArticles;
    else delete halfBody.articles;
    halves.set(fam, { body: halfBody, pages: halfPages.length, elementIds });
  }

  // Each half laid out by itself: move every element on a page by as much as its page moved.
  for (const [fam, half] of halves) {
    const newRects = new Map<string, PageRect>();
    for (const r of hooks.pageRects(half.body)) newRects.set(r.pageId, r);
    const halfElements = half.body.elements as unknown[];
    let k = 0;
    elements.forEach((el, i) => {
      if (famOf[i] !== fam) return;
      const at = k++;
      const page = pageOf[i];
      if (!page || !isRec(el)) return;
      const before = oldRects.get(page);
      const after = newRects.get(page);
      if (!before || !after) return;
      const dx = after.x - before.x;
      const dy = after.y - before.y;
      if (dx !== 0 || dy !== 0) halfElements[at] = translated(el, dx, dy);
    });
  }
  return halves;
}
