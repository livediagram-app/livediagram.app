'use client';

import type React from 'react';
import { SHAPE_DEFAULT_SIZE, turnsWithFacing, type ShapeKind } from '@livehuddle/document';
import { overFloatingPanel } from '@liveworkspace/workbench/lib/canvas-pointer';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import { setPaletteDragPreview } from '@/lib/palette-drag-preview';

// Carrying a palette tile onto the canvas by the pointer (docs/specs/009-elements/furniture-facing.md "Turning while
// placing"). A browser's own drag hears no keys (the HTML drag-and-drop model suppresses them until the drop), so
// Space could never turn a piece being dragged. A tile of a piece that turns is therefore carried instead, for a mouse
// or a pen: the press, the move past a few pixels and the release over the canvas look and feel like the drag, publish
// the same preview (palette-drag-preview.ts, `carried`), so PlacementPreview draws the piece and usePaletteDragGuides
// snaps it, and the release hands the canvas a drop (usePaletteDrop), landing it as a dropped tile lands. A touch
// keeps the browser's drag. Module-level, as the drag preview is: a carry is global, one at a time and transient.

/** What a carry released over the canvas hands the drop: the kind, the tile's choice, and the release point. */
export type CarryDrop = {
  kind: ShapeKind;
  choice?: string;
  clientX: number;
  clientY: number;
  // What the release was over: the canvas it lands on is the one holding it.
  target: Element;
};

// How far the pointer moves before a press becomes a carry: the browser's own drag threshold, about.
const CARRY_THRESHOLD = 4;

type Carry = {
  kind: ShapeKind;
  choice?: string;
  pointerId: number;
  x0: number;
  y0: number;
  started: boolean;
};

let carry: Carry | null = null;
let stop: (() => void) | null = null;
let dropped: CarryDrop | null = null;
const drops = createListeners();

/** Whether the tile of `kind` is carried by the pointer rather than dragged by the browser. */
export function carriesByPointer(kind: string): boolean {
  return turnsWithFacing(kind);
}

/** Whether a press is now down that a carry owns: the tile's own drag must not start under it. */
export function carryPressed(): boolean {
  return carry !== null;
}

/** Listen for carries released over the canvas; the latest is read with `lastCarryDrop`. */
export const subscribeCarryDrop = drops.subscribe;

/** The carry just released over the canvas (read inside a `subscribeCarryDrop` listener). */
export function lastCarryDrop(): CarryDrop | null {
  return dropped;
}

/**
 * A tile's pointerdown: starts a carry for a mouse or pen press on a tile whose piece turns. Anything else (a touch, a
 * second button, a kind the browser drags) is left to the tile's own press and drag.
 */
export function startCarry(e: React.PointerEvent, kind: ShapeKind, choice?: string): void {
  if (e.pointerType === 'touch' || e.button !== 0 || !carriesByPointer(kind)) return;
  endCarry();
  carry = { kind, choice, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, started: false };
  const move = (ev: PointerEvent) => {
    if (!carry || ev.pointerId !== carry.pointerId || carry.started) return;
    if (Math.hypot(ev.clientX - carry.x0, ev.clientY - carry.y0) < CARRY_THRESHOLD) return;
    carry.started = true;
    document.documentElement.dataset.paletteCarry = '';
    const { width, height } = SHAPE_DEFAULT_SIZE[carry.kind];
    setPaletteDragPreview({ kind: carry.kind, width, height, carried: true });
  };
  const up = (ev: PointerEvent) => {
    if (!carry || ev.pointerId !== carry.pointerId) return;
    const was = carry;
    if (was.started) {
      // The click this release makes (on the tile, or on whatever holds both the tile and the canvas) is the
      // carry's, not a press of the tile or the canvas.
      swallowNextClick();
      const target = ev.target as Element | null;
      if (target?.closest?.('main') && !overFloatingPanel(target)) {
        dropped = {
          kind: was.kind,
          choice: was.choice,
          clientX: ev.clientX,
          clientY: ev.clientY,
          target,
        };
        drops.notify();
        dropped = null;
      }
    }
    endCarry();
  };
  const cancel = (ev: PointerEvent) => {
    if (carry && ev.pointerId === carry.pointerId) endCarry();
  };
  const key = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape' || !carry?.started) return;
    // Escape puts the piece down: nothing lands, and nothing else hears the key (a menu would close, a selection
    // clear).
    ev.preventDefault();
    ev.stopImmediatePropagation();
    endCarry();
  };
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', cancel, true);
  window.addEventListener('keydown', key, true);
  window.addEventListener('blur', endCarry);
  stop = () => {
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true);
    window.removeEventListener('pointercancel', cancel, true);
    window.removeEventListener('keydown', key, true);
    window.removeEventListener('blur', endCarry);
  };
}

/** End the carry in flight, if any, landing nothing. */
export function endCarry(): void {
  stop?.();
  stop = null;
  const was = carry;
  carry = null;
  if (was?.started) {
    delete document.documentElement.dataset.paletteCarry;
    setPaletteDragPreview(null);
  }
}

/** A tile's dragstart under a carry: the browser's drag is cancelled, as the carry is the drag. */
export function cancelDragUnderCarry(e: React.DragEvent): boolean {
  if (!carryPressed()) return false;
  e.preventDefault();
  return true;
}

function swallowNextClick(): void {
  const swallow = (ev: MouseEvent) => {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    done();
  };
  const done = () => {
    window.removeEventListener('click', swallow, true);
    clearTimeout(timer);
  };
  window.addEventListener('click', swallow, true);
  // A release with no click after it (the pointer left the window) must not eat a later one.
  const timer = setTimeout(done, 0);
}
