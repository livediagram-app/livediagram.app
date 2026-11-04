'use client';

// A column carried by its head (docs/specs/026-plan/plan-board.md "Drag a column"). A press on an Editor's column head
// (not its buttons, not a finger) that moves COLUMN_DRAG_START_PX picks the column up: its parts (the head and each
// swimlane's cell, every `[data-plan-column]` of its id) lift and follow the pointer sideways, and the other columns
// slide aside to open the gap where it will land. Letting go over the board hands the place to `onDrop`; Escape, a
// lost pointer or letting go outside the board puts everything back.
//
// Nothing renders while it is carried: the board's columns are measured once as the drag starts (column-drag.ts does
// the arithmetic), each pointer move is folded into one animation frame, and every position is written as a Web
// Animation (the carried parts' keyframes replaced each frame, a neighbour's glide started only when the landing place
// changes). No style attribute changes either, so nothing watching the board's DOM (Marker's ink, useFaceFinishPass)
// wakes up mid-drag. The column move's own glide (column-move-flip.ts) settles the drop from where it was let go.
import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { clampScrollStep, edgeScrollStep } from '@/hooks/plan/edge-auto-scroll';
import {
  COLUMN_ATTR,
  COLUMN_MOVE_EASING,
  COLUMN_MOVE_MS,
  LIFT_SHADOW,
  playColumnMove,
  type ColumnPositions,
} from './column-move-flip';
import {
  COLUMN_DRAG_RISE_PX,
  COLUMN_DRAG_SCALE,
  clampColumnOffset,
  columnDropIndex,
  columnShift,
  pastColumnDragStart,
  type ColumnSpan,
} from './column-drag';

// While a column is carried, one clear layer over the page shows the closed hand wherever the pointer goes and keeps
// every card's hover still. One element added, not a class on the document: a `.dragging *` rule restyled every card on
// the board as the column was picked up (a 50 ms frame on a 2,000-card board).
export const COLUMN_DRAG_SHIELD_ATTR = 'data-column-drag-shield';

function raiseShield(): HTMLElement {
  const shield = document.createElement('div');
  shield.setAttribute(COLUMN_DRAG_SHIELD_ATTR, '');
  shield.setAttribute('aria-hidden', 'true');
  shield.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:grabbing;';
  document.body.appendChild(shield);
  return shield;
}
// What a press on a head never picks up: its buttons and anything typed into.
const NOT_A_HANDLE = 'button, a, input, select, textarea, [role="dialog"], [data-column-cog]';

type Press = {
  columnId: string;
  pointerId: number;
  startX: number;
  startY: number;
};

type Carry = {
  from: number;
  // Each column's parts, in the board's column order.
  parts: HTMLElement[][];
  spans: ColumnSpan[];
  gridWidth: number;
  // Screen px per layout px (the canvas's zoom).
  scale: number;
  startScroll: number;
  room: number;
  dx: number;
  to: number;
  shifts: number[];
  // The carried parts' animations, their keyframes replaced each frame.
  lifted: Animation[];
  // Each other part's glide toward its current shift.
  glides: Map<HTMLElement, Animation>;
  shield: HTMLElement;
};

export type ColumnDragOptions = {
  grid: RefObject<HTMLElement | null>;
  scroller: RefObject<HTMLElement | null>;
  // The board: letting go outside it cancels.
  board: RefObject<HTMLElement | null>;
  enabled: boolean;
  // The board's columns' ids, left to right.
  columnIds: readonly string[];
  // A column let go at a new place; `at` is where each part was seen, for the settling glide.
  onDrop: (columnId: string, to: number, at: ColumnPositions) => void;
};

const liftFrame = (dx: number): Keyframe => ({
  transform: `translate3d(${dx}px, ${-COLUMN_DRAG_RISE_PX}px, 0) scale(${COLUMN_DRAG_SCALE}, 1)`,
  boxShadow: LIFT_SHADOW,
  // Solid while it rides over its neighbours, whose words would otherwise show through its 85% face.
  backgroundColor: 'var(--plan-col-bg)',
  zIndex: 3,
});

// A part's sideways offset as drawn now (mid-glide included), layout px.
function drawnX(el: HTMLElement): number {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none' || typeof DOMMatrixReadOnly === 'undefined') return 0;
  return new DOMMatrixReadOnly(t).m41;
}

const animates = (el: HTMLElement) => typeof el.animate === 'function';

export function useColumnDrag(opts: ColumnDragOptions): {
  onHeadPointerDown: (columnId: string, e: React.PointerEvent<HTMLElement>) => void;
} {
  const optsRef = useRef(opts);
  useLayoutEffect(() => {
    optsRef.current = opts;
  });
  const pressRef = useRef<Press | null>(null);
  const carryRef = useRef<Carry | null>(null);
  const detachRef = useRef<(() => void) | null>(null);

  // Lets the press go and every listener with it; `restore` glides the columns back first.
  const finish = useCallback((restore: boolean) => {
    const carry = carryRef.current;
    const press = pressRef.current;
    detachRef.current?.();
    detachRef.current = null;
    pressRef.current = null;
    carryRef.current = null;
    if (!carry || !press) return;
    carry.shield.remove();
    const at = seen(carry);
    for (const a of carry.lifted) a.cancel();
    for (const a of carry.glides.values()) a.cancel();
    // The click a let-go makes on the head goes nowhere.
    swallowNextClick();
    if (!restore && carry.to !== carry.from) {
      optsRef.current.onDrop(press.columnId, carry.to, at);
      return;
    }
    if (!prefersReducedMotion()) playColumnMove(at, press.columnId);
  }, []);

  useEffect(() => () => finish(true), [finish]);

  const onHeadPointerDown = useCallback(
    (columnId: string, e: React.PointerEvent<HTMLElement>) => {
      const o = optsRef.current;
      if (!o.enabled || e.button !== 0 || e.pointerType === 'touch' || pressRef.current) return;
      if ((e.target as HTMLElement).closest(NOT_A_HANDLE)) return;
      // No text selected by the press, and the canvas never sees it (the board's body keeps it too).
      e.preventDefault();
      pressRef.current = { columnId, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY };
      let frame = 0;
      let x = e.clientX;
      const tick = () => {
        frame = 0;
        const carry = carryRef.current;
        const press = pressRef.current;
        if (carry && press && step(optsRef.current, press, carry, x)) schedule();
      };
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(tick);
      };
      const onMove = (ev: PointerEvent) => {
        const press = pressRef.current;
        if (!press || ev.pointerId !== press.pointerId) return;
        x = ev.clientX;
        if (!carryRef.current) {
          if (!pastColumnDragStart(ev.clientX - press.startX, ev.clientY - press.startY)) return;
          const carry = pickUp(optsRef.current, press.columnId);
          if (!carry) return finish(true);
          carryRef.current = carry;
        }
        schedule();
      };
      const onUp = (ev: PointerEvent) => {
        const press = pressRef.current;
        if (!press || ev.pointerId !== press.pointerId) return;
        const carry = carryRef.current;
        if (carry) {
          // The last move is stepped now, so the column lands where the pointer let go.
          x = ev.clientX;
          step(optsRef.current, press, carry, x);
        }
        const box = optsRef.current.board.current?.getBoundingClientRect();
        const inside =
          !!box &&
          ev.clientX >= box.left &&
          ev.clientX <= box.right &&
          ev.clientY >= box.top &&
          ev.clientY <= box.bottom;
        finish(!inside);
      };
      const onCancel = () => finish(true);
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== 'Escape' || !pressRef.current) return;
        // Escape only puts the column back: no popover closes, no maximised board restores.
        ev.preventDefault();
        ev.stopPropagation();
        finish(true);
      };
      const scroller = o.scroller.current;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('blur', onCancel);
      window.addEventListener('keydown', onKey, true);
      scroller?.addEventListener('scroll', schedule, { passive: true });
      detachRef.current = () => {
        if (frame) cancelAnimationFrame(frame);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('blur', onCancel);
        window.removeEventListener('keydown', onKey, true);
        scroller?.removeEventListener('scroll', schedule);
      };
    },
    [finish],
  );

  return { onHeadPointerDown };
}

// Measures the board once and lifts the column; null when it is not on the board.
function pickUp(o: ColumnDragOptions, columnId: string): Carry | null {
  const grid = o.grid.current;
  const from = o.columnIds.indexOf(columnId);
  if (!grid || from < 0) return null;
  const byId = new Map<string, HTMLElement[]>();
  for (const el of grid.querySelectorAll<HTMLElement>(`[${COLUMN_ATTR}]`)) {
    const id = el.getAttribute(COLUMN_ATTR)!;
    const list = byId.get(id);
    if (list) list.push(el);
    else byId.set(id, [el]);
  }
  const parts = o.columnIds.map((id) => byId.get(id) ?? []);
  // Each column's span is its head's (the first part drawn): a strip's is its own narrow width.
  const spans = parts.map((list) => ({
    left: list[0]?.offsetLeft ?? 0,
    width: list[0]?.offsetWidth ?? 0,
  }));
  const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
  const gridWidth = grid.offsetWidth;
  const rect = grid.getBoundingClientRect();
  const scale = gridWidth > 0 && rect.width > 0 ? rect.width / gridWidth : 1;
  const lifted = parts[from]!.filter(animates).map((el) =>
    el.animate([liftFrame(0), liftFrame(0)], { duration: 1, fill: 'forwards' }),
  );
  return {
    from,
    parts,
    spans,
    gridWidth,
    scale,
    startScroll: o.scroller.current?.scrollLeft ?? 0,
    room: spans[from]!.width + gap,
    dx: 0,
    to: from,
    shifts: parts.map(() => 0),
    lifted,
    glides: new Map(),
    shield: raiseShield(),
  };
}

// One frame: the column under the pointer, its neighbours aside, the board scrolled at its edges. True while the
// edge keeps scrolling (another frame wanted).
function step(o: ColumnDragOptions, press: Press, carry: Carry, x: number): boolean {
  const scroller = o.scroller.current;
  let scrolling = false;
  if (scroller) {
    const box = scroller.getBoundingClientRect();
    const s = clampScrollStep(edgeScrollStep(x, box, prefersReducedMotion()), scroller);
    if (s) {
      scroller.scrollLeft += s;
      scrolling = true;
    }
  }
  const scrolled = (scroller?.scrollLeft ?? 0) - carry.startScroll;
  carry.dx = clampColumnOffset(
    (x - press.startX) / carry.scale + scrolled,
    carry.spans,
    carry.from,
    carry.gridWidth,
  );
  const frame = liftFrame(carry.dx);
  for (const a of carry.lifted) (a.effect as KeyframeEffect | null)?.setKeyframes([frame, frame]);
  const to = columnDropIndex(carry.spans, carry.from, carry.dx);
  if (to !== carry.to) {
    carry.to = to;
    const still = prefersReducedMotion();
    carry.parts.forEach((list, j) => {
      if (j === carry.from) return;
      const shift = columnShift(j, carry.from, to, carry.room);
      if (shift === carry.shifts[j]) return;
      carry.shifts[j] = shift;
      for (const el of list) {
        if (!animates(el)) continue;
        const now = drawnX(el);
        carry.glides.get(el)?.cancel();
        carry.glides.set(
          el,
          el.animate(
            [{ transform: `translateX(${now}px)` }, { transform: `translateX(${shift}px)` }],
            {
              duration: still ? 0 : COLUMN_MOVE_MS,
              easing: COLUMN_MOVE_EASING,
              fill: 'forwards',
            },
          ),
        );
      }
    });
  }
  return scrolling;
}

// Where each part is seen now: its place in the layout plus the drag's offset (the carried column's) or its glide's.
function seen(carry: Carry): ColumnPositions {
  const at: ColumnPositions = new Map();
  carry.parts.forEach((list, j) => {
    for (const el of list) at.set(el, el.offsetLeft + (j === carry.from ? carry.dx : drawnX(el)));
  });
  return at;
}

// The click the browser sends after a let-go lands on the head (or wherever the pointer is); it is not a press.
function swallowNextClick(): void {
  const eat = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener('click', eat, { capture: true, once: true });
  // A let-go with no click after it (outside the window) must not eat the next real one.
  setTimeout(() => window.removeEventListener('click', eat, true), 0);
}
