// People arrows (docs/specs/008-canvas/people-arrows.md "Performance"): the one frame loop that moves every arrow.
// Each frame reads the view, the characters and (now and then) the controls' rects, steps every arrow's motion and
// writes only its node's transform and opacity. It runs while anything moves and stops once everything has settled;
// the stores it follows wake it again. React renders the arrows' buttons; this never renders anything.

import type { View } from '@liveworkspace/workbench/lib/viewport-store';
import {
  ARROW_SIZE,
  arrowSlots,
  bodyOf,
  emphasisOf,
  isInView,
  nearness,
  screenOf,
  type Box,
  type Point,
} from './people-arrows-geometry';
import { restingMotion, stepArrow, type ArrowGoal, type ArrowMotion } from './people-arrows-motion';

/**
 * What an arrow must never cover, measured from the page: anything marked as a canvas obstacle, every floating panel
 * (the menu card, the toolbar strip, the banners, the Map, the Call dock), every region root over the canvas (the zoom
 * cluster), and any open non-modal dialog or menu (a popover, a flyout), wherever it was portalled.
 */
export const OBSTACLE_SELECTOR = [
  '[data-canvas-obstacle]',
  '[data-floating-panel]',
  '[data-region]:not([data-region="canvas"])',
  '[role="dialog"]:not([aria-modal="true"])',
  '[role="menu"]',
].join(', ');

/** How often the controls are measured while the loop runs, and while it is idle with an arrow showing. */
export const MEASURE_EVERY_MS = 250;
export const IDLE_MEASURE_EVERY_MS = 500;

/**
 * The controls' rects over `host` (the canvas), in the host's coordinates. Hidden, empty and off-canvas ones are
 * skipped, as is anything holding the arrows' own layer or inside it.
 */
export function measureObstacles(host: HTMLElement, layer: HTMLElement | null): Box[] {
  const origin = host.getBoundingClientRect();
  const marked = [...host.ownerDocument.querySelectorAll<HTMLElement>(OBSTACLE_SELECTOR)].filter(
    (el) => !layer || (!layer.contains(el) && !el.contains(layer)),
  );
  const boxes: Box[] = [];
  for (const el of marked) {
    // An outer region holding a marked one is measured through its parts: the toolbar's region spans the canvas's
    // whole width to centre the strip, but only the strip and the menu card in it are controls.
    if (marked.some((other) => other !== el && el.contains(other))) continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (
      r.right <= origin.left ||
      r.left >= origin.right ||
      r.bottom <= origin.top ||
      r.top >= origin.bottom
    )
      continue;
    boxes.push({
      left: r.left - origin.left,
      top: r.top - origin.top,
      right: r.right - origin.left,
      bottom: r.bottom - origin.top,
    });
  }
  return boxes;
}

function sameBoxes(a: readonly Box[], b: readonly Box[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      Math.abs(x.left - y.left) > 0.5 ||
      Math.abs(x.top - y.top) > 0.5 ||
      Math.abs(x.right - y.right) > 0.5 ||
      Math.abs(x.bottom - y.bottom) > 0.5
    )
      return false;
  }
  return true;
}

export type ArrowNode = { root: HTMLElement; tip: HTMLElement };

type Arrow = {
  node: ArrowNode;
  motion: ArrowMotion;
  inView: boolean;
  /** Whether the node is currently exposed (focusable, pressable, read out). */
  exposed: boolean | null;
};

export type PeopleArrowsSource = {
  /** The canvas's view now. */
  view: () => View;
  /** Where a person's character stands now (its feet, canvas px), or null when it has gone. */
  feetOf: (id: string) => Point | null;
  /** Whether motion is reduced (the OS setting or the app's). */
  reduced: () => boolean;
};

export type PeopleArrowsEngine = {
  attach: (id: string, node: ArrowNode | null) => void;
  wake: () => void;
  /** The canvas or its controls changed size: measure again on the next frame. */
  remeasure: () => void;
  dispose: () => void;
  /** The arrows' current motion, by id (tests and the performance probe read it). */
  motionOf: (id: string) => Readonly<ArrowMotion> | undefined;
  /** Runs one frame now, at `now` ms (tests drive the loop with it). Answers whether it is still moving. */
  frame: (now: number) => boolean;
};

export function createPeopleArrowsEngine(
  // The layer the arrows draw in: it covers the canvas exactly, and its parent (the canvas <main>) holds the controls.
  layer: HTMLElement,
  source: PeopleArrowsSource,
  schedule: {
    raf: (cb: (now: number) => void) => number;
    cancel: (id: number) => void;
    setInterval: (cb: () => void, ms: number) => number;
    clearInterval: (id: number) => void;
  } = {
    raf: (cb) => requestAnimationFrame(cb),
    cancel: (id) => cancelAnimationFrame(id),
    setInterval: (cb, ms) => window.setInterval(cb, ms),
    clearInterval: (id) => window.clearInterval(id),
  },
): PeopleArrowsEngine {
  const arrows = new Map<string, Arrow>();
  let raf = 0;
  let last = 0;
  let reduced = false;
  let area: Box = { left: 0, top: 0, right: 0, bottom: 0 };
  let obstacles: Box[] = [];
  let measuredAt = -Infinity;
  let idleTimer = 0;

  const host = () => layer.parentElement ?? layer;
  const measure = (now: number) => {
    area = { left: 0, top: 0, right: layer.clientWidth, bottom: layer.clientHeight };
    obstacles = measureObstacles(host(), layer);
    measuredAt = now;
  };

  const expose = (a: Arrow, shown: boolean) => {
    if (a.exposed === shown) return;
    a.exposed = shown;
    const { root } = a.node;
    root.dataset.shown = shown ? 'true' : 'false';
    root.style.pointerEvents = shown ? 'auto' : 'none';
    if (shown) root.removeAttribute('aria-hidden');
    else root.setAttribute('aria-hidden', 'true');
    root.tabIndex = shown ? 0 : -1;
  };

  const write = (a: Arrow) => {
    const m = a.motion;
    const half = ARROW_SIZE / 2;
    a.node.root.style.transform = `translate3d(${(m.x - half).toFixed(2)}px, ${(m.y - half).toFixed(2)}px, 0) scale(${m.scale.toFixed(4)})`;
    a.node.root.style.opacity = m.opacity.toFixed(3);
    a.node.tip.style.transform = `rotate(${m.angle.toFixed(4)}rad)`;
  };

  // Every arrow's goal this frame: who is out of view, then their slots together, so two in the same direction
  // spread along the edge rather than stack.
  const goalsOf = (view: View): Map<Arrow, ArrowGoal> => {
    const goals = new Map<Arrow, ArrowGoal>();
    const out: { a: Arrow; p: Point }[] = [];
    for (const [id, a] of arrows) {
      goals.set(a, {
        x: a.motion.x,
        y: a.motion.y,
        angle: a.motion.angle,
        scale: 1,
        opacity: 0,
        shown: false,
      });
      const feet = source.feetOf(id);
      if (!feet) continue;
      const p = screenOf(bodyOf(feet), view, { width: area.right, height: area.bottom });
      a.inView = isInView(p, area, obstacles, a.inView);
      if (!a.inView) out.push({ a, p });
    }
    const slots = arrowSlots(
      out.map((o) => o.p),
      area,
      obstacles,
    );
    out.forEach(({ a, p }, i) => {
      const slot = slots[i];
      if (slot) goals.set(a, { ...slot, ...emphasisOf(nearness(p, area)), shown: true });
    });
    return goals;
  };

  const idleCheck = () => {
    if (raf) return;
    const before = obstacles;
    measure(performance.now());
    if (!sameBoxes(before, obstacles)) wake();
  };

  const setIdleWatch = (on: boolean) => {
    if (on && !idleTimer) idleTimer = schedule.setInterval(idleCheck, IDLE_MEASURE_EVERY_MS);
    else if (!on && idleTimer) {
      schedule.clearInterval(idleTimer);
      idleTimer = 0;
    }
  };

  const frame = (now: number): boolean => {
    raf = 0;
    if (last === 0) reduced = source.reduced();
    const dt = last === 0 ? 16 : now - last;
    last = now;
    if (now - measuredAt >= MEASURE_EVERY_MS) measure(now);
    const view = source.view();
    let moving = false;
    let anyShown = false;
    for (const [a, goal] of goalsOf(view)) {
      if (stepArrow(a.motion, goal, dt, reduced)) moving = true;
      write(a);
      expose(a, goal.shown);
      if (goal.shown) anyShown = true;
    }
    if (moving) raf = schedule.raf(frame);
    else last = 0;
    setIdleWatch(anyShown && !moving);
    return moving;
  };

  const wake = () => {
    if (!raf) raf = schedule.raf(frame);
  };

  return {
    attach(id, node) {
      if (node) {
        arrows.set(id, { node, motion: restingMotion(), inView: false, exposed: null });
        node.root.style.opacity = '0';
        wake();
      } else arrows.delete(id);
    },
    wake,
    remeasure() {
      measuredAt = -Infinity;
      wake();
    },
    dispose() {
      if (raf) schedule.cancel(raf);
      raf = 0;
      setIdleWatch(false);
      arrows.clear();
    },
    motionOf: (id) => arrows.get(id)?.motion,
    frame,
  };
}
