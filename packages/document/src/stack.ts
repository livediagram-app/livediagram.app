// The stack (docs/specs/009-elements/stack.md, blueprint stack.md): a container that lays out the elements whose centre
// it holds, in a row, a column or a grid, and hugs them. Settled at the editor's commit point and on read, like the
// badges, so the stored positions are always the laid-out ones.

import { boxCentre, containerContents, deriveContainers, type Box } from './containment';
import type { Element, ElementId, ShapeElement } from './index';

export type StackDirection = 'row' | 'column' | 'grid';
export type StackAlign = 'start' | 'center' | 'end';

export const STACK_DIRECTIONS: readonly StackDirection[] = ['row', 'column', 'grid'];
export const STACK_ALIGNS: readonly StackAlign[] = ['start', 'center', 'end'];
export const STACK_GAP_DEFAULT = 16;
export const STACK_PADDING_DEFAULT = 16;
export const STACK_COLUMNS_DEFAULT = 2;
export const STACK_SPACING_MAX = 64;
export const STACK_COLUMNS_MIN = 2;
export const STACK_COLUMNS_MAX = 6;

type Boxed = Element & Box;

export function isStack(el: Element): el is ShapeElement & { shape: 'stack' } {
  return el.type === 'shape' && el.shape === 'stack';
}

export const isStackDirection = (v: unknown): v is StackDirection =>
  v === 'row' || v === 'column' || v === 'grid';
export const isStackAlign = (v: unknown): v is StackAlign =>
  v === 'start' || v === 'center' || v === 'end';

const intIn = (v: unknown, lo: number, hi: number, fallback: number): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : fallback;

/** A stack's settings, each its own when valid, else the default. */
export function stackSettingsOf(el: ShapeElement): {
  direction: StackDirection;
  align: StackAlign;
  gap: number;
  padding: number;
  columns: number;
} {
  return {
    direction: isStackDirection(el.stackDirection) ? el.stackDirection : 'row',
    align: isStackAlign(el.stackAlign) ? el.stackAlign : 'center',
    gap: intIn(el.stackGap, 0, STACK_SPACING_MAX, STACK_GAP_DEFAULT),
    padding: intIn(el.stackPadding, 0, STACK_SPACING_MAX, STACK_PADDING_DEFAULT),
    columns: intIn(el.stackColumns, STACK_COLUMNS_MIN, STACK_COLUMNS_MAX, STACK_COLUMNS_DEFAULT),
  };
}

const isBoxed = (el: Element): el is Boxed =>
  el.type !== 'arrow' &&
  Number.isFinite((el as Boxed).x) &&
  Number.isFinite((el as Boxed).y) &&
  Number.isFinite((el as Boxed).width) &&
  Number.isFinite((el as Boxed).height);

/** A stack's children in slot order: the elements it directly holds, ordered by their centres. */
export function stackChildren(
  elements: readonly Element[],
  stack: ShapeElement,
  holders: ReadonlyMap<ElementId, ElementId | null> = deriveContainers(elements),
): Boxed[] {
  const kids = elements.filter(
    (el): el is Boxed => isBoxed(el) && el.id !== stack.id && holders.get(el.id) === stack.id,
  );
  const { direction } = stackSettingsOf(stack);
  const c = (b: Box) => boxCentre(b);
  if (direction === 'row') return kids.sort((a, b) => c(a).x - c(b).x || c(a).y - c(b).y);
  if (direction === 'column') return kids.sort((a, b) => c(a).y - c(b).y || c(a).x - c(b).x);
  // Grid: reading order, a row band being centres within half the tallest child's height.
  const band = Math.max(1, ...kids.map((k) => k.height)) / 2;
  return kids.sort((a, b) => {
    const dy = c(a).y - c(b).y;
    return Math.abs(dy) <= band ? c(a).x - c(b).x : dy;
  });
}

/** The band a titled stack keeps above its children for its title (D192). */
export const STACK_TITLE_H = 22;

/** Where each child goes, and the stack's hugged size: a titled stack keeps a title band above its children. */
export function layoutStack(
  stack: ShapeElement,
  children: readonly Box[],
): { width: number; height: number; at: { x: number; y: number }[] } {
  const t = children.length > 0 && stack.label?.trim() ? STACK_TITLE_H : 0;
  if (t === 0) return layoutBody(stack, children);
  const l = layoutBody({ ...stack, y: stack.y + t }, children);
  return { ...l, height: l.height + t };
}

function layoutBody(
  stack: ShapeElement,
  children: readonly Box[],
): { width: number; height: number; at: { x: number; y: number }[] } {
  const { direction, align, gap: g, padding: p, columns } = stackSettingsOf(stack);
  const n = children.length;
  if (n === 0) return { width: stack.width, height: stack.height, at: [] };
  const shift = (free: number) => (align === 'start' ? 0 : align === 'end' ? free : free / 2);
  const at: { x: number; y: number }[] = [];
  if (direction === 'grid') {
    const cols = Math.min(columns, n);
    const rows = Math.ceil(n / cols);
    const cw = Math.max(...children.map((k) => k.width));
    const ch = Math.max(...children.map((k) => k.height));
    children.forEach((k, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      at.push({
        x: Math.round(stack.x + p + col * (cw + g) + shift(cw - k.width)),
        y: Math.round(stack.y + p + row * (ch + g) + shift(ch - k.height)),
      });
    });
    return {
      width: p * 2 + cols * cw + g * (cols - 1),
      height: p * 2 + rows * ch + g * (rows - 1),
      at,
    };
  }
  const row = direction === 'row';
  const cross = Math.max(...children.map((k) => (row ? k.height : k.width)));
  let run = p;
  for (const k of children) {
    const main = row ? k.width : k.height;
    const off = p + shift(cross - (row ? k.height : k.width));
    at.push(
      row
        ? { x: Math.round(stack.x + run), y: Math.round(stack.y + off) }
        : { x: Math.round(stack.x + off), y: Math.round(stack.y + run) },
    );
    run += main + g;
  }
  const along = run - g + p;
  return row
    ? { width: along, height: p * 2 + cross, at }
    : { width: p * 2 + cross, height: along, at };
}

/** How many settling passes one settle may take. A stack that grows can cover a neighbour's centre, which it then
 *  holds, so the settle runs again; each pass that repeats takes one more element in, and chains this long do not
 *  occur on a real board. */
export const STACK_SETTLE_PASSES_MAX = 8;

/** Every stack laid out, innermost first: each child moved to its slot (with whatever it holds), each stack hugging
 *  its children. Passes repeat while a stack grew, so what a grown stack now covers is laid out in the same settle and
 *  settling again changes nothing (I3). The same array when nothing moved. */
export function settleStacks(elements: Element[]): Element[] {
  if (!elements.some(isStack)) return elements;
  let current = elements;
  for (let pass = 0; pass < STACK_SETTLE_PASSES_MAX; pass++) {
    const { next, grew } = settlePass(current);
    current = next;
    if (!grew) break;
  }
  return current;
}

function settlePass(elements: Element[]): { next: Element[]; grew: boolean } {
  const stacks = elements.filter((el) => isStack(el) && isBoxed(el)) as (ShapeElement & Box)[];
  let grew = false;
  let current = elements;
  const order = [...stacks].sort((a, b) => a.width * a.height - b.width * b.height);
  // Who holds what, derived again only after a stack moved something: settling runs at every commit,
  // and the common case (one child moved) changes one stack, so the rest share one derivation.
  let holders = deriveContainers(current);
  let holdersOf = current;
  for (const s of order) {
    const stack = current.find((el) => el.id === s.id) as (ShapeElement & Box) | undefined;
    if (!stack) continue;
    if (holdersOf !== current) {
      holders = deriveContainers(current);
      holdersOf = current;
    }
    const kids = stackChildren(current, stack, holders);
    if (kids.length === 0) continue;
    const l = layoutStack(stack, kids);
    const deltas = new Map<ElementId, { dx: number; dy: number }>();
    kids.forEach((k, i) => {
      const dx = l.at[i]!.x - k.x;
      const dy = l.at[i]!.y - k.y;
      if (dx === 0 && dy === 0) return;
      // The child carries what it holds (a frame's or a nested stack's contents), as a drag would.
      for (const id of containerContents(current, new Set([k.id]), holders)) {
        if (!deltas.has(id)) deltas.set(id, { dx, dy });
      }
    });
    const resized = stack.width !== l.width || stack.height !== l.height;
    if (l.width > stack.width || l.height > stack.height) grew = true;
    if (deltas.size === 0 && !resized) continue;
    current = current.map((el) => {
      if (el.id === stack.id) return resized ? { ...el, width: l.width, height: l.height } : el;
      const d = deltas.get(el.id);
      if (!d || !isBoxed(el)) return el;
      return { ...el, x: el.x + d.dx, y: el.y + d.dy };
    });
  }
  return { next: current, grew };
}

/** A stack's settings written (each bounded; a default value is stored as absent). */
export function withStackSettings<T extends Element>(
  el: T,
  patch: Partial<{
    direction: StackDirection;
    align: StackAlign;
    gap: number;
    padding: number;
    columns: number;
  }>,
): T {
  if (!isStack(el)) return el;
  const next = { ...el } as T & Record<string, unknown>;
  const put = (key: string, v: unknown, fallback: unknown) => {
    if (v === undefined) return;
    if (v === fallback) delete next[key];
    else next[key] = v;
  };
  if (patch.direction && isStackDirection(patch.direction))
    put('stackDirection', patch.direction, 'row');
  if (patch.align && isStackAlign(patch.align)) put('stackAlign', patch.align, 'center');
  const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));
  if (patch.gap !== undefined)
    put('stackGap', clampInt(patch.gap, 0, STACK_SPACING_MAX), STACK_GAP_DEFAULT);
  if (patch.padding !== undefined)
    put('stackPadding', clampInt(patch.padding, 0, STACK_SPACING_MAX), STACK_PADDING_DEFAULT);
  if (patch.columns !== undefined)
    put(
      'stackColumns',
      clampInt(patch.columns, STACK_COLUMNS_MIN, STACK_COLUMNS_MAX),
      STACK_COLUMNS_DEFAULT,
    );
  return next;
}

const NONE: ReadonlySet<ElementId> = new Set();

/** The ids a stack directly holds (the elements that glide to their slots on the canvas); an empty set when the
 *  board has no stack. */
export function stackedElementIds(elements: readonly Element[]): ReadonlySet<ElementId> {
  if (!elements.some(isStack)) return NONE;
  const holders = deriveContainers(elements);
  const stacks = new Set(elements.filter(isStack).map((el) => el.id));
  const out = new Set<ElementId>();
  for (const [id, holder] of holders) if (holder && stacks.has(holder)) out.add(id);
  return out;
}
