// People arrows (docs/specs/008-canvas/people-arrows.md): the pure rules. Who gets an arrow, whether a person is in
// view, where on the canvas's edge their arrow sits (sliding clear of the controls laid over the canvas), which way it
// points and how bold it is. Screen coordinates throughout are relative to the canvas <main>'s top-left corner.

import type { View } from '@liveworkspace/workbench/lib/viewport-store';
import { AVATAR_HEIGHT } from '@livehuddle/avatar/walk';

export type Point = { x: number; y: number };
export type Box = { left: number; top: number; right: number; bottom: number };

/** At this many other people on the tab, or more, no arrows show ("fewer than 10"). */
export const PEOPLE_ARROWS_MAX_OTHERS = 10;
/** The arrow's square, screen px. */
export const ARROW_SIZE = 38;
/** Between the canvas's edge and the arrow. */
export const EDGE_GAP = 10;
/** Between a control and an arrow slid clear of it. */
export const OBSTACLE_GAP = 6;
/** How far inside the clear canvas a person has to be to count as in view, so the arrow never flickers. */
export const SEEN_INSET = 24;
/** Beyond this many screen px past the edge, an arrow is at its lightest. */
export const FAR_PX = 1600;

/** Whether arrows show at all for this many other humans on the tab: 1 to 9. */
export function peopleArrowsOn(othersOnTab: number): boolean {
  return othersOnTab > 0 && othersOnTab < PEOPLE_ARROWS_MAX_OTHERS;
}

export type ArrowPerson = { id: string; name: string; color: string };

/**
 * The people who get an arrow: every human with a character on the tab, while the tab holds fewer than 10 other
 * humans. `rows` are the characters on the active tab (self already dropped); `humanOnTab` lists the ids of the other
 * humans on the tab whether they walk or not; `isAgent` says whether a presence row stands for an agent.
 */
export function arrowPeopleOf(
  rows: readonly ArrowPerson[],
  humanOnTab: Iterable<string>,
  isAgent: (id: string) => boolean,
): ArrowPerson[] {
  const humans = rows.filter((r) => !isAgent(r.id));
  const everyone = new Set<string>(humans.map((r) => r.id));
  for (const id of humanOnTab) if (!isAgent(id)) everyone.add(id);
  if (!peopleArrowsOn(everyone.size)) return [];
  return humans.map(({ id, name, color }) => ({ id, name, color }));
}

/** Same people, same names, same colours, same order: the layer need not render again. */
export function samePeople(a: readonly ArrowPerson[], b: readonly ArrowPerson[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.id !== y.id || x.name !== y.name || x.color !== y.color) return false;
  }
  return true;
}

/**
 * A canvas point on screen. The canvas wrapper is `scale(zoom) translate(offset)` with the scale centred on the
 * canvas, so a canvas x lands at `w/2 + zoom * (x + offset.x - w/2)` (lib/viewport.ts, computeFitBelow).
 */
export function screenOf(p: Point, view: View, size: { width: number; height: number }): Point {
  return {
    x: size.width / 2 + view.zoom * (p.x + view.offset.x - size.width / 2),
    y: size.height / 2 + view.zoom * (p.y + view.offset.y - size.height / 2),
  };
}

/** The middle of a character, from its feet: what has to be seen for the person to be in view. */
export function bodyOf(feet: Point): Point {
  return { x: feet.x, y: feet.y - AVATAR_HEIGHT / 2 };
}

const inside = (p: Point, b: Box, inset: number) =>
  p.x >= b.left + inset &&
  p.x <= b.right - inset &&
  p.y >= b.top + inset &&
  p.y <= b.bottom - inset;

/**
 * Whether a person is in view: on the canvas and behind no control. Hysteresis: a person whose arrow shows
 * (`wasInView` false) must come SEEN_INSET px inside the canvas, and clear of every control by as much, to lose it; one
 * in view keeps no arrow until they cross the very edge or step behind a control.
 */
export function isInView(
  p: Point,
  area: Box,
  obstacles: readonly Box[],
  wasInView: boolean,
): boolean {
  const margin = wasInView ? 0 : SEEN_INSET;
  if (!inside(p, area, margin)) return false;
  for (const o of obstacles) if (inside(p, o, -margin)) return false;
  return true;
}

/** The rail the arrows' centres travel: the area inset by the gap and half an arrow. */
export function railOf(area: Box): Box {
  const inset = EDGE_GAP + ARROW_SIZE / 2;
  return {
    left: area.left + inset,
    top: area.top + inset,
    right: Math.max(area.left + inset, area.right - inset),
    bottom: Math.max(area.top + inset, area.bottom - inset),
  };
}

// The rail as one loop, measured clockwise from its top-left corner: along the top, down the right, back along the
// bottom, up the left.
function railLength(r: Box): number {
  return 2 * (r.right - r.left) + 2 * (r.bottom - r.top);
}

export function railPoint(r: Box, t: number): Point {
  const w = r.right - r.left;
  const h = r.bottom - r.top;
  const total = 2 * w + 2 * h;
  let s = ((t % total) + total) % total;
  if (s <= w) return { x: r.left + s, y: r.top };
  s -= w;
  if (s <= h) return { x: r.right, y: r.top + s };
  s -= h;
  if (s <= w) return { x: r.right - s, y: r.bottom };
  s -= w;
  return { x: r.left, y: r.bottom - s };
}

/** Where on the rail the line from the rail's centre towards `target` crosses it, as a distance along the loop. */
export function railCrossing(r: Box, target: Point): number {
  const w = r.right - r.left;
  const h = r.bottom - r.top;
  const cx = (r.left + r.right) / 2;
  const cy = (r.top + r.bottom) / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  if (dx === 0 && dy === 0) return 0;
  // Scale the direction until it touches the nearer pair of sides.
  const sx = dx === 0 ? Infinity : w / 2 / Math.abs(dx);
  const sy = dy === 0 ? Infinity : h / 2 / Math.abs(dy);
  const s = Math.min(sx, sy);
  const x = cx + dx * s;
  const y = cy + dy * s;
  if (sy <= sx) {
    // The top or the bottom.
    return dy < 0 ? x - r.left : w + h + (r.right - x);
  }
  return dx > 0 ? w + (y - r.top) : 2 * w + h + (r.bottom - y);
}

type Interval = [number, number];

// The parts of the rail where an arrow's square would overlap a control: each control grown by half an arrow and the
// gap, cut against each side of the rail, as distances along the loop. Merged, sorted, and joined across the start.
export function blockedSpans(r: Box, obstacles: readonly Box[]): Interval[] {
  const w = r.right - r.left;
  const h = r.bottom - r.top;
  const grow = ARROW_SIZE / 2 + OBSTACLE_GAP;
  const spans: Interval[] = [];
  for (const o of obstacles) {
    const g = {
      left: o.left - grow,
      top: o.top - grow,
      right: o.right + grow,
      bottom: o.bottom + grow,
    };
    // Top: x from left to right.
    if (g.top <= r.top && r.top <= g.bottom) {
      const a = Math.max(r.left, g.left);
      const b = Math.min(r.right, g.right);
      if (a <= b) spans.push([a - r.left, b - r.left]);
    }
    // Right: y from top to bottom.
    if (g.left <= r.right && r.right <= g.right) {
      const a = Math.max(r.top, g.top);
      const b = Math.min(r.bottom, g.bottom);
      if (a <= b) spans.push([w + (a - r.top), w + (b - r.top)]);
    }
    // Bottom: x from right to left.
    if (g.top <= r.bottom && r.bottom <= g.bottom) {
      const a = Math.max(r.left, g.left);
      const b = Math.min(r.right, g.right);
      if (a <= b) spans.push([w + h + (r.right - b), w + h + (r.right - a)]);
    }
    // Left: y from bottom to top.
    if (g.left <= r.left && r.left <= g.right) {
      const a = Math.max(r.top, g.top);
      const b = Math.min(r.bottom, g.bottom);
      if (a <= b) spans.push([2 * w + h + (r.bottom - b), 2 * w + h + (r.bottom - a)]);
    }
  }
  spans.sort((p, q) => p[0] - q[0]);
  const merged: Interval[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  // Covered across the loop's start (a control at the top-left corner): one span, running past the end.
  const total = 2 * w + 2 * h;
  const first = merged[0];
  const last = merged[merged.length - 1];
  if (merged.length > 1 && first && last && first[0] <= 0 && last[1] >= total) {
    merged.shift();
    last[1] = total + first[1];
  }
  return merged;
}

// The clear spot on the loop nearest `t`, or null when the controls cover all of it.
export function nearestClear(t: number, spans: readonly Interval[], total: number): number | null {
  if (total <= 0) return null;
  const covered = spans.reduce((n, [a, b]) => n + (b - a), 0);
  if (spans.length > 0 && covered >= total) return null;
  const dist = (a: number, b: number) => {
    const d = Math.abs(a - b) % total;
    return Math.min(d, total - d);
  };
  // A span reaching past the loop's end also covers its start, and the other way round.
  const blocks = (s: number) =>
    spans.some(
      ([a, b]) =>
        (s > a && s < b) || (s + total > a && s + total < b) || (s - total > a && s - total < b),
    );
  if (!blocks(t)) return t;
  let best: number | null = null;
  for (const [a, b] of spans) {
    for (const edge of [a, b]) {
      const s = ((edge % total) + total) % total;
      if (blocks(s)) continue;
      if (best === null || dist(s, t) < dist(best, t)) best = s;
    }
  }
  return best;
}

export type ArrowSlot = { x: number; y: number; angle: number };

/**
 * Where a person's arrow sits and which way it points: on the rail where the line from the centre to them crosses it,
 * slid along the rail to the nearest spot clear of every control, its point aimed from there at them (radians,
 * 0 = right, clockwise as the screen's y grows down). Null when the controls cover the whole rail.
 */
export function arrowSlot(target: Point, area: Box, obstacles: readonly Box[]): ArrowSlot | null {
  return arrowSlots([target], area, obstacles)[0] ?? null;
}

/** Arrows this close along the rail would overlap: the later ones step on by this much. */
export const ARROW_SPACING = ARROW_SIZE + 4;

// The first clear spot at or after `t` going clockwise, or null when the controls cover the whole loop.
function clearFrom(t: number, spans: readonly Interval[], total: number): number | null {
  let s = ((t % total) + total) % total;
  for (let hops = 0; hops <= spans.length; hops++) {
    const hit = spans.find(([a, b]) => (s > a && s < b) || (s + total > a && s + total < b));
    if (!hit) return s;
    s = hit[1] % total;
  }
  return null;
}

/**
 * Every arrow's slot at once ({@link arrowSlot} for each), then spread along the rail so two people in the same
 * direction never sit on top of each other: in rail order, each arrow steps on past the one before it, and past any
 * control it would then cover. Each still points at its own person.
 */
export function arrowSlots(
  targets: readonly Point[],
  area: Box,
  obstacles: readonly Box[],
): (ArrowSlot | null)[] {
  const r = railOf(area);
  const total = railLength(r);
  const spans = blockedSpans(r, obstacles);
  const at = targets.map((target) => nearestClear(railCrossing(r, target), spans, total));
  const order = at
    .map((t, i) => ({ t, i }))
    .filter((e): e is { t: number; i: number } => e.t !== null)
    .sort((p, q) => p.t - q.t);
  for (let k = 1; k < order.length; k++) {
    const prev = order[k - 1]!;
    const cur = order[k]!;
    if (cur.t - prev.t >= ARROW_SPACING) continue;
    const next = clearFrom(prev.t + ARROW_SPACING, spans, total);
    // Past the loop's end it would land on the first arrows again: it keeps its own spot.
    if (next !== null && next >= prev.t) cur.t = next;
    at[cur.i] = cur.t;
  }
  return targets.map((target, i) => {
    const t = at[i];
    if (t === null || t === undefined) return null;
    const p = railPoint(r, t);
    return { x: p.x, y: p.y, angle: Math.atan2(target.y - p.y, target.x - p.x) };
  });
}

/** How far a point lies beyond the area's edge, screen px (0 inside). */
export function distanceOutside(p: Point, area: Box): number {
  const dx = Math.max(area.left - p.x, 0, p.x - area.right);
  const dy = Math.max(area.top - p.y, 0, p.y - area.bottom);
  return Math.hypot(dx, dy);
}

/** Closer is bolder: 1 just past the edge, 0 at FAR_PX or more. */
export function nearness(p: Point, area: Box): number {
  return Math.max(0, 1 - distanceOutside(p, area) / FAR_PX);
}

/** The arrow's resting scale and opacity for a nearness. */
export function emphasisOf(near: number): { scale: number; opacity: number } {
  return { scale: 0.84 + 0.16 * near, opacity: 0.72 + 0.28 * near };
}
