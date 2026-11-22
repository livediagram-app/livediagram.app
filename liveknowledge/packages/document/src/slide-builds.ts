// Builds within a presented slide (docs/specs/012-collaboration/presentation-mode.md "Builds"): reading an element's
// build leniently, a slide's steps, what a slide shows at a step, and how a step moves through them. Pure, so the
// editor's deck, its menu and its tests share one answer.

import { BUILD_EFFECTS, type BuildEffect, type ElementBuild } from './build-types';
import type { ArrowElement } from './arrow-types';
import type { Element } from './element-union';
import type { Tab } from './index';
import { resolveSlide, type Slide } from './slide-deck';
import { layOutPages, pageAt } from './page-layout';
import { pagesOf } from './page';

export { BUILD_EFFECTS, type BuildEffect, type ElementBuild } from './build-types';

/** The element's build, or undefined: an order that is not a whole number from 1 is no build, and an unknown effect
 *  reads as Appear (the field is cosmetic and lenient, like the animation fields). Arrows never build. */
export function buildOf(el: Element): ElementBuild | undefined {
  if (el.type === 'arrow' || el.type === 'article-note') return undefined;
  const raw = (el as { build?: unknown }).build;
  if (!raw || typeof raw !== 'object') return undefined;
  const { order, effect } = raw as { order?: unknown; effect?: unknown };
  if (typeof order !== 'number' || !Number.isInteger(order) || order < 1) return undefined;
  const known = (BUILD_EFFECTS as readonly unknown[]).includes(effect);
  return { order, effect: known ? (effect as BuildEffect) : 'appear' };
}

/** Whether an element can carry a build at all: every boxed element but a margin note. */
export function takesBuild(el: Element): boolean {
  return el.type !== 'arrow' && el.type !== 'article-note';
}

/** A slide's steps: its built elements' distinct orders, lowest first. Their count is the slide's builds. */
export function slideBuildOrders(elements: readonly Element[]): number[] {
  const orders = new Set<number>();
  for (const el of elements) {
    const b = buildOf(el);
    if (b) orders.add(b.order);
  }
  return [...orders].sort((a, b) => a - b);
}

/** The order a new build takes: one after the slide's highest, else 1. */
export function nextBuildOrder(elements: readonly Element[]): number {
  const orders = slideBuildOrders(elements);
  return orders.length === 0 ? 1 : orders[orders.length - 1]! + 1;
}

/** The element with its build set, or removed (`null`). Elements that take no build are returned as they are. */
export function withBuild<E extends Element>(el: E, build: ElementBuild | null): E {
  if (!takesBuild(el)) return el;
  const next = { ...el } as E & { build?: ElementBuild };
  if (build) next.build = { order: build.order, effect: build.effect };
  else delete next.build;
  return next;
}

// The ids hidden when `shown` steps of `orders` are showing: every element whose order is past them, then every
// arrow with an end on something hidden (repeated, so an arrow pinned to a hidden arrow hides too).
function hiddenIds(
  elements: readonly Element[],
  orders: readonly number[],
  shown: number,
): Set<string> {
  const showing = new Set(orders.slice(0, Math.max(0, shown)));
  const hidden = new Set<string>();
  for (const el of elements) {
    const b = buildOf(el);
    if (b && !showing.has(b.order)) hidden.add(el.id);
  }
  if (hidden.size === 0) return hidden;
  const arrows = elements.filter((el): el is ArrowElement => el.type === 'arrow');
  const endHidden = (end: { kind: string; elementId?: string; arrowId?: string }) =>
    (end.kind === 'pinned' && end.elementId !== undefined && hidden.has(end.elementId)) ||
    (end.kind === 'on-arrow' && end.arrowId !== undefined && hidden.has(end.arrowId));
  // Each pass hides at least one more arrow or stops, so it ends within one pass per arrow.
  for (let changed = true; changed;) {
    changed = false;
    for (const a of arrows) {
      if (hidden.has(a.id)) continue;
      if (endHidden(a.from) || endHidden(a.to)) {
        hidden.add(a.id);
        changed = true;
      }
    }
  }
  return hidden;
}

/**
 * What a slide shows with `shown` of its builds showing (clamped to its steps): its elements less those still to
 * come, in their order, and the ones the step `shown` itself brought in (empty at 0).
 */
export function presentedBuild(
  elements: readonly Element[],
  shown: number,
): { shown: Element[]; entering: Element[] } {
  const orders = slideBuildOrders(elements);
  if (orders.length === 0) return { shown: [...elements], entering: [] };
  const at = Math.min(Math.max(0, shown), orders.length);
  const hidden = hiddenIds(elements, orders, at);
  const before = at > 0 ? hiddenIds(elements, orders, at - 1) : null;
  const visible = elements.filter((el) => !hidden.has(el.id));
  return {
    shown: visible,
    entering: before ? visible.filter((el) => before.has(el.id)) : [],
  };
}

/** Where a presenting slide's builds stand: how many show, and whether the last one is coming in (a forward step). */
export type PresentingBuild = { slideId: string; shown: number; entering: boolean };

/**
 * A step within a slide of `count` builds, from `at`: the next build forward, the last one back, or null when the step
 * leaves the slide (every build played going forward, none showing going back).
 */
export function stepBuild(
  at: { slideId: string; shown: number },
  count: number,
  step: 1 | -1,
): PresentingBuild | null {
  const shown = Math.min(Math.max(0, at.shown), count);
  if (step === 1 && shown < count) return { slideId: at.slideId, shown: shown + 1, entering: true };
  if (step === -1 && shown > 0) return { slideId: at.slideId, shown: shown - 1, entering: false };
  return null;
}

/** Every element on the first of the tab's slides (hidden ones too) that holds `elementId`, or null when the element is
 *  on none of them: the slide whose steps an element's build counts among. */
export function slideElementsOf(
  slides: readonly Slide[],
  tab: Tab,
  elementId: string,
): Element[] | null {
  for (const slide of slides) {
    if (slide.tabId !== tab.id) continue;
    const on = resolveSlide(slide, tab);
    if (on.some((el) => el.id === elementId)) return on;
  }
  return null;
}

/** Each built element's place among the steps of the first of the tab's slides it is on (1 for the first step): the
 *  number its badge shows. Empty when nothing on the tab builds. Runs on every edit of a tab that builds, so it walks
 *  only the built elements: once to file them by page (a built element is a box, on the page under its centre, as
 *  `resolveSlide` reads a page), then each slide's own members, O(built + the slides' element lists). */
export function buildStepsOfTab(slides: readonly Slide[], tab: Tab): Map<string, number> {
  const steps = new Map<string, number>();
  const built = tab.elements.filter((el) => buildOf(el));
  if (built.length === 0) return steps;
  const byId = new Map(built.map((el) => [el.id, el]));
  let byPage: Map<string, Element[]> | null = null;
  const onPage = (pageId: string) => {
    if (!byPage) {
      const pages = layOutPages(pagesOf(tab));
      const filed = new Map<string, Element[]>();
      for (const el of built) {
        const box = el as { x: number; y: number; width: number; height: number };
        const page = pageAt(pages, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
        if (!page) continue;
        const list = filed.get(page.id);
        if (list) list.push(el);
        else filed.set(page.id, [el]);
      }
      byPage = filed;
    }
    return byPage.get(pageId) ?? [];
  };
  for (const slide of slides) {
    if (slide.tabId !== tab.id) continue;
    const on = slide.pageId
      ? onPage(slide.pageId)
      : slide.elementIds.flatMap((id) => byId.get(id) ?? []);
    const orders = slideBuildOrders(on);
    const place = new Map(orders.map((o, i) => [o, i + 1]));
    for (const el of on) if (!steps.has(el.id)) steps.set(el.id, place.get(buildOf(el)!.order)!);
  }
  return steps;
}

type Box = { x: number; y: number; width: number; height: number };
const BADGE_CELL = 256;
// A box covering more cells than this is checked against every box rather than filed cell by cell.
const BADGE_MAX_CELLS = 64;

/** The steps whose badge shows: an element overlapping one drawn before it at the same step (an icon in its circle)
 *  comes in with it, so it shows no badge of its own and the pair reads as one numbered thing. Linear in the built
 *  elements for boxes of ordinary size: each kept box is filed in a 256-unit grid, and only its neighbours are
 *  compared. */
export function badgedBuildSteps(
  steps: ReadonlyMap<string, number>,
  elements: readonly Element[],
): Map<string, number> {
  const shown = new Map<string, number>();
  if (steps.size === 0) return shown;
  const grids = new Map<number, { cells: Map<string, Box[]>; big: Box[] }>();
  const cellsOf = (b: Box): [number, number, number, number] => [
    Math.floor(b.x / BADGE_CELL),
    Math.floor(b.y / BADGE_CELL),
    Math.floor((b.x + b.width) / BADGE_CELL),
    Math.floor((b.y + b.height) / BADGE_CELL),
  ];
  const meets = (a: Box, b: Box) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  for (const el of elements) {
    const step = steps.get(el.id);
    if (step === undefined) continue;
    const box = el as unknown as Box;
    let grid = grids.get(step);
    if (!grid) grids.set(step, (grid = { cells: new Map(), big: [] }));
    const [x0, y0, x1, y1] = cellsOf(box);
    const huge = (x1 - x0 + 1) * (y1 - y0 + 1) > BADGE_MAX_CELLS;
    let covered = grid.big.some((b) => meets(b, box));
    if (!covered && huge) {
      for (const list of grid.cells.values()) if (list.some((b) => meets(b, box))) covered = true;
    }
    for (let cx = x0; !covered && !huge && cx <= x1; cx++)
      for (let cy = y0; !covered && cy <= y1; cy++)
        covered = grid.cells.get(`${cx},${cy}`)?.some((b) => meets(b, box)) ?? false;
    if (covered) continue;
    shown.set(el.id, step);
    if (huge) grid.big.push(box);
    else
      for (let cx = x0; cx <= x1; cx++)
        for (let cy = y0; cy <= y1; cy++) {
          const key = `${cx},${cy}`;
          const list = grid.cells.get(key);
          if (list) list.push(box);
          else grid.cells.set(key, [box]);
        }
  }
  return shown;
}
