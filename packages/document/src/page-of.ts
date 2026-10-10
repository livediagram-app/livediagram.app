// Which Illustrate page an element is on (docs/specs/007-editor/illustrate-pages.md "Arrows stay on
// one page"): the page its centre lies on, else none. Pure.
import { elementBounds } from './geometry';
import type { LaidOutPage } from './illustrate-page';
import type { Element } from './index';

type Point = { x: number; y: number };

/** The id of the page `p` lies on, null when it is on none. */
export function pageIdAt(p: Point, pages: readonly LaidOutPage[]): string | null {
  for (const page of pages) {
    const r = page.rect;
    if (p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height) return page.id;
  }
  return null;
}

/** The id of the page `el` is on (its centre's), null when none. A box reads its own centre; an
 *  arrow resolves its bounds against `all`. */
export function pageIdOf(
  el: Element,
  all: Element[],
  pages: readonly LaidOutPage[],
): string | null {
  if ('x' in el && 'width' in el) {
    return pageIdAt({ x: el.x + el.width / 2, y: el.y + el.height / 2 }, pages);
  }
  const b = elementBounds(el, all);
  return pageIdAt({ x: b.x + b.width / 2, y: b.y + b.height / 2 }, pages);
}

/** Whether joining something on page `a` to something on page `b` would cross between two pages
 *  (on no page, either is free to join). */
export const crossesPages = (a: string | null, b: string | null): boolean =>
  a !== null && b !== null && a !== b;
