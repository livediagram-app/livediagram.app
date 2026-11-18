// The ground under a text, remembered while what makes it stays the same (each product's
// docs/specs/004-interface-design/blueprints/colour-picker.md "Performance and limits"). Hovering a text colour
// previews it live, so the tab changes on every hover; working the ground out again walks every element in paint
// order (about 2.4 ms at 5,000). The ground depends only on the pages or canvas, the layers, the boxes under the text
// and the text's own box and fill, never on its text colour, so a hover reuses it. Pure but for its cache.
import type { CanvasSurface } from './colour-math';
import { isBoxed, type BoxedElement, type Element } from './element';
import type { TextGround } from './text-contrast';

/** What a ground is read off: the tab's elements, and what lies under them (pages, layers, a canvas colour). */
export type ProbeTab = {
  elements: readonly Element[];
  layers?: unknown;
  pages?: unknown;
  pageOrientation?: unknown;
  backgroundColor?: unknown;
};

// `B` is a product's own boxed element, which the shared one is the structural shape of.
export type GroundOf<T extends ProbeTab = ProbeTab, B extends BoxedElement = BoxedElement> = (
  el: B,
  tab: T,
  surface: CanvasSurface,
) => TextGround | null;

// What a text colour changes, which the ground never reads.
const TEXT_COLOUR_KEYS = new Set(['textColor', 'penTextColour']);
// The tab's fields a ground reads besides its elements.
const TAB_KEYS = ['pages', 'pageOrientation', 'layers', 'backgroundColor'] as const;

type Entry = {
  el: Element;
  at: number;
  under: Element[];
  surface: CanvasSurface;
  tab: readonly unknown[];
  ground: TextGround | null;
};

// Every box other than the text's holding its centre, in the tab's order, and where the text sits in it: a ground
// reads no other element.
function boxesUnder(el: BoxedElement, elements: readonly Element[]) {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const under: Element[] = [];
  let at = -1;
  for (let i = 0; i < elements.length; i += 1) {
    const e = elements[i]!;
    if (e.id === el.id) {
      at = i;
      continue;
    }
    if (!isBoxed(e)) continue;
    if (cx >= e.x && cx <= e.x + e.width && cy >= e.y && cy <= e.y + e.height) under.push(e);
  }
  return { under, at };
}

// The same element but for its text colour.
function sameBox(a: Element, b: Element): boolean {
  if (a === b) return true;
  const ak = Object.keys(a).filter((k) => !TEXT_COLOUR_KEYS.has(k));
  const bk = Object.keys(b).filter((k) => !TEXT_COLOUR_KEYS.has(k));
  if (ak.length !== bk.length) return false;
  return ak.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]);
}

const sameList = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((e, i) => e === b[i]);

/**
 * A ground cache for one picker. Each `batch()` gives a `GroundOf` that reuses the ground `compute` worked out for the
 * same element in the batch before, while nothing it reads has changed; it keeps only the elements asked for in the
 * latest batch, so it never outgrows the selection.
 */
export function textGroundMemo<T extends ProbeTab, B extends BoxedElement = BoxedElement>(
  compute: GroundOf<T, B>,
) {
  let entries = new Map<string, Entry>();
  return {
    batch(): GroundOf<T, B> {
      const prev = entries;
      entries = new Map();
      return (el, tab, surface) => {
        const { under, at } = boxesUnder(el, tab.elements);
        const fields = TAB_KEYS.map((k) => tab[k]);
        const was = prev.get(el.id) ?? entries.get(el.id);
        const kept =
          was &&
          was.surface === surface &&
          sameList(was.tab, fields) &&
          was.at === at &&
          sameBox(was.el, el) &&
          sameList(was.under, under);
        const ground = kept ? was.ground : compute(el, tab, surface);
        entries.set(el.id, { el, at, under, surface, tab: fields, ground });
        return ground;
      };
    },
  };
}
