// Flashcards hold text only (docs/specs/007-editor/flashcards.md "Text only"): the guard a local
// edit passes through so no element is added onto a card or moved onto one. An element already on a
// card (made before the rule, or by an agent) stays and may move off it. Pure.
import { elementBounds } from './geometry';
import { layOutPages, type LaidOutPage, type Page } from './page';
import type { Element } from './index';

type Point = { x: number; y: number };

const centreOf = (el: Element, all: Element[]): Point => {
  const b = elementBounds(el, all);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

const inside = (p: Point, r: LaidOutPage['rect']) =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

/** `next` (an edit's elements) with nothing new on a card: a new element landing on one is left
 *  out, one moved onto one from off every card is put back as it was. `blocked` says whether
 *  anything was held back. Same array back when nothing was. */
export function guardFlashcards(
  prev: Element[],
  next: Element[],
  nextPages: readonly Page[],
): { elements: Element[]; blocked: boolean } {
  if (prev === next || !nextPages.some((p) => p.kind === 'flashcard'))
    return { elements: next, blocked: false };
  const cards = layOutPages(nextPages)
    .filter((p) => p.kind === 'flashcard')
    .map((p) => p.rect);
  const onCard = (el: Element, all: Element[]) => {
    const c = centreOf(el, all);
    return cards.some((r) => inside(c, r));
  };
  const prevById = new Map(prev.map((el) => [el.id, el]));
  let blocked = false;
  const out: Element[] = [];
  for (const el of next) {
    const was = prevById.get(el.id);
    if (was === el || !onCard(el, next)) {
      out.push(el);
      continue;
    }
    if (!was) {
      blocked = true;
      continue;
    }
    if (onCard(was, prev)) out.push(el);
    else {
      blocked = true;
      out.push(was);
    }
  }
  return blocked ? { elements: out, blocked } : { elements: next, blocked: false };
}
