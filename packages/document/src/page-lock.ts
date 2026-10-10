// Locked pages (docs/specs/007-editor/illustrate-pages.md "Locking a page"): a locked page and
// what is on it stay where they are. Which elements a locked page holds (their centre on it), and
// the guard a local edit passes through so nothing is added to, moved onto or moved on a locked
// page. Pure.
import { elementBounds } from './geometry';
import { layOutIllustratePages, type IllustratePage, type LaidOutPage } from './illustrate-page';
import type { Element } from './index';

type Point = { x: number; y: number };

const centreOf = (el: Element, all: Element[]): Point => {
  const b = elementBounds(el, all);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

const inside = (p: Point, r: LaidOutPage['rect']) =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

/** Whether any page is locked. */
export const hasLockedPage = (pages: readonly IllustratePage[]): boolean =>
  pages.some((p) => p.locked === true);

/** The ids of the elements whose centre lies on a locked page. */
export function elementsOnLockedPages(
  elements: Element[],
  pages: readonly LaidOutPage[],
): Set<string> {
  const locked = pages.filter((p) => p.locked === true);
  const ids = new Set<string>();
  if (locked.length === 0) return ids;
  for (const el of elements) {
    const c = centreOf(el, elements);
    if (locked.some((p) => inside(c, p.rect))) ids.add(el.id);
  }
  return ids;
}

// The pages' layout and locks, compared: a guard applies only while neither changed (a page added,
// moved, resized or deleted moves content legitimately; a lock toggled starts or ends a lock).
const layoutKey = (pages: readonly LaidOutPage[]) =>
  pages
    .map(
      (p) => `${p.id}:${p.rect.x},${p.rect.y},${p.rect.width},${p.rect.height}:${p.locked ? 1 : 0}`,
    )
    .join('|');

// Where an element is: its box (arrows resolved) and its turn. A lock holds where things are, not
// how they look: a theme's re-colouring and a comment still reach a locked page.
const placeOf = (el: Element, all: Element[]) => {
  const b = elementBounds(el, all);
  const turn = 'rotation' in el ? (el.rotation ?? 0) : 0;
  return `${b.x},${b.y},${b.width},${b.height},${turn}`;
};

// `next` put back where `prev` was: a box's place and turn (its look kept), any other element as it
// was.
function putBack(prev: Element, next: Element): Element {
  if (!('x' in prev) || !('x' in next)) return prev;
  const p = prev as Element & {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  };
  const back = { ...next, x: p.x, y: p.y, width: p.width, height: p.height } as typeof next & {
    rotation?: number;
  };
  if (p.rotation === undefined) delete back.rotation;
  else back.rotation = p.rotation;
  return back;
}

/** `next` (an edit's elements) with nothing added to, moved onto or moved on a locked page: an
 *  element on one keeps its place (its look may change: a theme, a comment), one that newly lands
 *  on one is left out (a new element) or put back (a moved one). Deletions pass (they come as
 *  cascades: an arrow whose end went, a layer removed). `blocked` says whether anything was held
 *  back. The pages' own changes (their layout or their locks) pass as they are. */
export function guardLockedPages(
  prev: Element[],
  next: Element[],
  prevPages: readonly IllustratePage[],
  nextPages: readonly IllustratePage[],
): { elements: Element[]; blocked: boolean } {
  if (!hasLockedPage(nextPages) || prev === next) return { elements: next, blocked: false };
  const before = layOutIllustratePages(prevPages);
  const after = layOutIllustratePages(nextPages);
  if (layoutKey(before) !== layoutKey(after)) return { elements: next, blocked: false };
  const held = elementsOnLockedPages(prev, before);
  const prevById = new Map(prev.map((el) => [el.id, el]));
  const lockedRects = after.filter((p) => p.locked === true).map((p) => p.rect);
  const landsLocked = (el: Element) => {
    const c = centreOf(el, next);
    return lockedRects.some((r) => inside(c, r));
  };
  let blocked = false;
  const out: Element[] = [];
  for (const el of next) {
    const was = prevById.get(el.id);
    if (!was) {
      // New: not added onto a locked page.
      if (landsLocked(el)) blocked = true;
      else out.push(el);
      continue;
    }
    const moved = was !== el && placeOf(was, prev) !== placeOf(el, next);
    if (moved && (held.has(el.id) || landsLocked(el))) {
      // Moved on a locked page, or onto one: put back.
      blocked = true;
      out.push(putBack(was, el));
    } else {
      out.push(el);
    }
  }
  return blocked ? { elements: out, blocked } : { elements: next, blocked: false };
}
