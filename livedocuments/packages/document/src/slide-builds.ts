// Builds within a presented slide (docs/specs/012-collaboration/presentation-mode.md "Builds"): reading an element's
// build leniently, a slide's steps, what a slide shows at a step, and how a step moves through them. Pure, so the
// editor's deck, its menu and its tests share one answer.

import { BUILD_EFFECTS, type BuildEffect, type ElementBuild } from './build-types';
import type { Element } from './element-union';
import type { Tab } from './index';
import { resolveSlide, type Slide } from './slide-deck';

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
function hiddenIds(elements: readonly Element[], orders: readonly number[], shown: number): Set<string> {
  const showing = new Set(orders.slice(0, Math.max(0, shown)));
  const hidden = new Set<string>();
  for (const el of elements) {
    const b = buildOf(el);
    if (b && !showing.has(b.order)) hidden.add(el.id);
  }
  if (hidden.size === 0) return hidden;
  const arrows = elements.filter((el) => el.type === 'arrow');
  const endHidden = (end: { kind: string; elementId?: string; arrowId?: string }) =>
    (end.kind === 'pinned' && end.elementId !== undefined && hidden.has(end.elementId)) ||
    (end.kind === 'on-arrow' && end.arrowId !== undefined && hidden.has(end.arrowId));
  // Each pass hides at least one more arrow or stops, so it ends within one pass per arrow.
  for (let changed = true; changed; ) {
    changed = false;
    for (const a of arrows) {
      if (a.type !== 'arrow' || hidden.has(a.id)) continue;
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
  if (step === 1 && shown < count)
    return { slideId: at.slideId, shown: shown + 1, entering: true };
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
 *  number its badge shows. Empty when nothing on the tab builds, without resolving a slide. */
export function buildStepsOfTab(slides: readonly Slide[], tab: Tab): Map<string, number> {
  const steps = new Map<string, number>();
  if (!tab.elements.some((el) => buildOf(el))) return steps;
  for (const slide of slides) {
    if (slide.tabId !== tab.id) continue;
    const on = resolveSlide(slide, tab);
    const orders = slideBuildOrders(on);
    if (orders.length === 0) continue;
    const place = new Map(orders.map((o, i) => [o, i + 1]));
    for (const el of on) {
      const b = buildOf(el);
      if (b && !steps.has(el.id)) steps.set(el.id, place.get(b.order)!);
    }
  }
  return steps;
}
