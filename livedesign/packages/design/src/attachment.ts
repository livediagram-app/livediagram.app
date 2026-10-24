// Attachment (docs/specs/009-elements/badge.md "Attachment"): a badge or a step number held on one of eight points of
// a host element, travelling with it. Pure, and run at ONE place: the editor's commit choke point (and an agent's
// write), as `settleChips(prev, next)`. Every way a host moves, resizes, turns or is deleted reaches that point, so no
// gesture needs attachment code of its own; the stored x / y it keeps true is all any reader needs.

import { badgeSize, isChip, nextStepNumber, stepFontPx } from './chip';
import { isPointerNote, pointerTipOf } from './pointer-note';
import type { Point, Rect } from '@liveworkspace/model-core/geometry-primitives';
import type { Element, ElementId, ShapeElement } from './index';

export type AttachPoint =
  'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left';

export const ATTACH_POINTS: readonly AttachPoint[] = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
];

/** How close (element px) a chip's centre has to come to a point to take it, or stray to leave it. */
export const ATTACH_SNAP_PX = 16;

export function isAttachPoint(v: unknown): v is AttachPoint {
  return typeof v === 'string' && (ATTACH_POINTS as readonly string[]).includes(v);
}

type Boxed = Element & Rect & { rotation?: number };

function isBoxedEl(el: Element): el is Boxed {
  return (
    el.type !== 'arrow' &&
    Number.isFinite((el as Rect).x) &&
    Number.isFinite((el as Rect).y) &&
    Number.isFinite((el as Rect).width) &&
    Number.isFinite((el as Rect).height)
  );
}

// Too far from what they hold for a corner to read as a mark on it, or a mark themselves.
const NOT_HOSTS = new Set([
  'badge',
  'step',
  'annotation',
  'frame',
  // Containers too: a mark belongs on what a stack holds, not on the stack's outline, which reflows under it.
  'stack',
]);

/** Whether an element can hold a badge or a step number. */
export function canHost(el: Element): boolean {
  if (!isBoxedEl(el) || el.type === 'annotation') return false;
  return !(el.type === 'shape' && NOT_HOSTS.has(el.shape));
}

/** A point on the host's box, turned with the host about its centre. */
export function attachPointXY(host: Rect & { rotation?: number }, point: AttachPoint): Point {
  const fx = point.endsWith('left') ? 0 : point.endsWith('right') ? 1 : 0.5;
  const fy = point.startsWith('top') ? 0 : point.startsWith('bottom') ? 1 : 0.5;
  const cx = host.x + host.width / 2;
  const cy = host.y + host.height / 2;
  const px = host.x + host.width * fx;
  const py = host.y + host.height * fy;
  const deg = host.rotation ?? 0;
  if (!deg) return { x: px, y: py };
  const r = (deg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * Math.cos(r) - dy * Math.sin(r),
    y: cy + dx * Math.sin(r) + dy * Math.cos(r),
  };
}

const centreOf = (el: Rect): Point => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const sameBox = (a: Boxed, b: Boxed) =>
  a.x === b.x &&
  a.y === b.y &&
  a.width === b.width &&
  a.height === b.height &&
  (a.rotation ?? 0) === (b.rotation ?? 0);

/** The nearest host point within reach of `p`, the topmost host winning a tie; null when none is. */
function nearestPoint(
  p: Point,
  hosts: readonly Boxed[],
  self: ElementId,
): { host: Boxed; point: AttachPoint } | null {
  let best: { host: Boxed; point: AttachPoint; d: number } | null = null;
  for (const host of hosts) {
    if (host.id === self) continue;
    // Every point of a box, turned any way, lies within half its diagonal of its centre: a host whose circle the
    // point is not near cannot have a point in reach, so the cheap test skips the eight-point one (a board's loose
    // chips each scan every host).
    const dx = p.x - (host.x + host.width / 2);
    const dy = p.y - (host.y + host.height / 2);
    const reach = Math.hypot(host.width, host.height) / 2 + ATTACH_SNAP_PX;
    if (dx * dx + dy * dy > reach * reach) continue;
    for (const point of ATTACH_POINTS) {
      const d = dist(p, attachPointXY(host, point));
      if (d <= ATTACH_SNAP_PX && (!best || d <= best.d)) best = { host, point, d };
    }
  }
  return best ? { host: best.host, point: best.point } : null;
}

function detached<T extends ShapeElement>(el: T): T {
  const { attachedTo: _host, attachAt: _at, ...rest } = el;
  return rest as T;
}

function centredOn<T extends ShapeElement>(el: T, p: Point): T {
  const x = p.x - el.width / 2;
  const y = p.y - el.height / 2;
  return Math.abs(x - el.x) < 0.5 && Math.abs(y - el.y) < 0.5 ? el : { ...el, x, y };
}

/**
 * Settle every badge and step number after a change from `prev` to `next` (docs/specs/009-elements/blueprints/
 * badge.md "Settling"): fit each badge to its text, number each new step, keep each attached chip on its host's point
 * (removing it when its host was deleted, detaching it when its host is unknown or it was dragged away), and attach a
 * new or moved chip that lands on a point. Returns `next` itself when nothing changes.
 */
export function settleChips(
  prev: readonly Element[],
  next: Element[],
  // Whether a new or moved chip that lands on a point attaches to it. Off when settling a stored board on read:
  // there nothing was just dropped, and a loose badge near a corner is where its author left it.
  { attachLoose = true }: { attachLoose?: boolean } = {},
): Element[] {
  if (!next.some((el) => isChip(el) || isPointerNote(el))) return next;
  const prevById = new Map(prev.map((el) => [el.id, el]));
  const byId = new Map(next.map((el) => [el.id, el]));
  let hosts: Boxed[] | null = null;
  const hostList = () => (hosts ??= next.filter((el): el is Boxed => canHost(el)));
  let changed = false;
  const out: Element[] = [];
  // The number the next new unnumbered step takes, counted on as each is numbered, so several new in one write (an
  // agent's create) are 1, 2, 3 rather than all one number.
  let nextNumber: number | null = null;
  const takeStepNumber = () => {
    nextNumber ??= Number(nextStepNumber(next));
    return String(nextNumber++);
  };
  for (const el of next) {
    if (isPointerNote(el)) {
      // A pointer note (docs/specs/009-elements/blueprints/pointer-note.md "Settling"): its tip, not its box, holds.
      const settled = settlePointerNote(el, prevById, byId);
      if (settled === null) {
        changed = true;
        continue;
      }
      if (settled !== el) changed = true;
      out.push(settled);
      continue;
    }
    if (!isChip(el)) {
      out.push(el);
      continue;
    }
    let chip: ShapeElement = el;
    const before = prevById.get(el.id) as ShapeElement | undefined;
    // 1. A badge fits its text.
    if (chip.shape === 'badge') {
      const size = badgeSize(chip.label ?? '', chip.textSize);
      if (size.width !== chip.width || size.height !== chip.height) {
        const c = centreOf(chip);
        chip = {
          ...chip,
          width: size.width,
          height: size.height,
          x: c.x - size.width / 2,
          y: c.y - size.height / 2,
        };
      }
    }
    // 2. A new step takes the next number, and every step's number is half its disc.
    if (chip.shape === 'step') {
      if (!before && !chip.label?.trim()) chip = { ...chip, label: takeStepNumber() };
      const px = stepFontPx(Math.min(chip.width, chip.height));
      if (chip.textSize !== px) chip = { ...chip, textSize: px };
    }
    // 3. An attached chip stays on its point, follows its host away, or leaves it.
    const moved = !!before && isBoxedEl(before) && (before.x !== el.x || before.y !== el.y);
    if (chip.attachedTo !== undefined || chip.attachAt !== undefined) {
      const host = chip.attachedTo ? byId.get(chip.attachedTo) : undefined;
      if (!host || !canHost(host) || !isAttachPoint(chip.attachAt) || host.id === chip.id) {
        if (chip.attachedTo && prevById.has(chip.attachedTo) && !host) {
          // Deleted with its host.
          changed = true;
          continue;
        }
        chip = detached(chip);
      } else {
        const target = attachPointXY(host as Boxed, chip.attachAt);
        const hostBefore = prevById.get(host.id);
        const hostStill =
          !!hostBefore && isBoxedEl(hostBefore) && sameBox(hostBefore, host as Boxed);
        if (moved && hostStill && dist(centreOf(chip), target) > ATTACH_SNAP_PX)
          chip = detached(chip);
        // A locked chip already placed is not moved, its host's move included, as a drag leaves it where it is.
        else if (!(chip.locked === true && before)) chip = centredOn(chip, target);
      }
    }
    // 4. A new or moved chip that lands on a point takes it.
    if (attachLoose && chip.attachedTo === undefined && (!before || moved)) {
      const hit = nearestPoint(centreOf(chip), hostList(), chip.id);
      if (hit)
        chip = centredOn(
          { ...chip, attachedTo: hit.host.id, attachAt: hit.point },
          attachPointXY(hit.host, hit.point),
        );
    }
    if (chip !== el) changed = true;
    out.push(chip);
  }
  return changed ? out : next;
}

/** One pointer note settled: on its host's point when attached, carried when its host moved, null when its host was
 *  deleted, detached when its host is unknown. */
function settlePointerNote(
  note: ShapeElement,
  prevById: ReadonlyMap<ElementId, Element>,
  byId: ReadonlyMap<ElementId, Element>,
): ShapeElement | null {
  if (note.attachedTo === undefined && note.attachAt === undefined) return note;
  const host = note.attachedTo ? byId.get(note.attachedTo) : undefined;
  if (!host || !canHost(host) || !isAttachPoint(note.attachAt) || host.id === note.id) {
    if (note.attachedTo && prevById.has(note.attachedTo) && !host) return null;
    return detached(note);
  }
  const target = attachPointXY(host as Boxed, note.attachAt);
  const before = prevById.get(note.id);
  const hostBefore = prevById.get(host.id);
  const hostStill = !!hostBefore && isBoxedEl(hostBefore) && sameBox(hostBefore, host as Boxed);
  const tip = pointerTipOf(note);
  if (!before || !hostStill) {
    // The host moved (or the note is new): carry the note so its tip lands on the point.
    const x = target.x - tip.x;
    const y = target.y - tip.y;
    return Math.abs(x - note.x) < 0.5 && Math.abs(y - note.y) < 0.5 ? note : { ...note, x, y };
  }
  // The note moved (or nothing did): keep it, re-aim the tip at the point.
  const nx = target.x - note.x;
  const ny = target.y - note.y;
  return Math.abs(nx - tip.x) < 0.05 && Math.abs(ny - tip.y) < 0.05
    ? note
    : { ...note, pointerTip: { x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 } };
}

/** `ids` and every chip attached to an element in it: what travels with a dragged, nudged, copied or duplicated
 *  host. `ids` itself when nothing is attached to any of them. */
export function withAttached(
  elements: readonly Element[],
  ids: ReadonlySet<ElementId>,
): ReadonlySet<ElementId> {
  let out: Set<ElementId> | null = null;
  for (const el of elements) {
    if (
      !(isChip(el) || isPointerNote(el)) ||
      !el.attachedTo ||
      !ids.has(el.attachedTo) ||
      ids.has(el.id)
    )
      continue;
    (out ??= new Set(ids)).add(el.id);
  }
  return out ?? ids;
}

/** A chip let go of its host, where it is. Any other element comes back unchanged. */
export function detachChip<T extends Element>(el: T): T {
  if (
    !(isChip(el) || isPointerNote(el)) ||
    (el.attachedTo === undefined && el.attachAt === undefined)
  )
    return el;
  return detached(el as ShapeElement & T);
}
