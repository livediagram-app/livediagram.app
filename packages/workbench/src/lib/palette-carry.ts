'use client';

import type React from 'react';
import { overFloatingPanel } from './canvas-pointer';
import { createListeners } from './listeners';

// Carrying a palette tile onto the canvas by the pointer (each product's docs/specs/009-elements/furniture-facing.md
// "Turning while placing"). A browser's own drag hears no keys (the HTML drag-and-drop model suppresses them until the
// drop), so Space could never turn a piece being dragged. A tile of a piece that turns is therefore carried instead,
// for a mouse or a pen: the press, the move past a few pixels and the release over the canvas look and feel like the
// drag, publish the same preview (the product's palette-drag-preview.ts, `carried`), so the canvas draws the piece and
// usePaletteDragGuides snaps it, and the release hands the canvas a drop (usePaletteDrop), landing it as a dropped
// tile lands. A touch keeps the browser's drag. One per product, module-level, as the drag preview is: a carry is
// global, one at a time and transient. Which kinds are carried, their size and the preview are the product's.

/** What a carry released over the canvas hands the drop: the kind, the tile's choice, and the release point. */
export type CarryDrop<K extends string> = {
  kind: K;
  choice?: string;
  clientX: number;
  clientY: number;
  // What the release was over: the canvas it lands on is the one holding it.
  target: Element;
};

/** The preview a carry publishes once it starts, and clears (null) when it ends. */
export type CarryPreview<K extends string> = {
  kind: K;
  width: number;
  height: number;
  carried: true;
};

export type PaletteCarryConfig<K extends string> = {
  /** Whether the tile of `kind` is carried by the pointer (its piece turns). */
  carries: (kind: string) => boolean;
  /** A kind's default size, what the preview shows. */
  sizeOf: (kind: K) => { width: number; height: number };
  /** Publish the carry's preview, or clear it. */
  setPreview: (preview: CarryPreview<K> | null) => void;
};

export type PaletteCarry<K extends string> = {
  carriesByPointer: (kind: string) => boolean;
  carryPressed: () => boolean;
  subscribeCarryDrop: (listener: () => void) => () => void;
  lastCarryDrop: () => CarryDrop<K> | null;
  startCarry: (e: React.PointerEvent, kind: K, choice?: string) => void;
  endCarry: () => void;
  cancelDragUnderCarry: (e: React.DragEvent) => boolean;
};

// How far the pointer moves before a press becomes a carry: the browser's own drag threshold, about.
const CARRY_THRESHOLD = 4;

export function createPaletteCarry<K extends string>(
  config: PaletteCarryConfig<K>,
): PaletteCarry<K> {
  let carry: {
    kind: K;
    choice?: string;
    pointerId: number;
    x0: number;
    y0: number;
    started: boolean;
  } | null = null;
  let stop: (() => void) | null = null;
  let dropped: CarryDrop<K> | null = null;
  const drops = createListeners();

  // End the carry in flight, if any, landing nothing.
  const endCarry = (): void => {
    stop?.();
    stop = null;
    const was = carry;
    carry = null;
    if (was?.started) {
      delete document.documentElement.dataset.paletteCarry;
      config.setPreview(null);
    }
  };

  // A tile's pointerdown: starts a carry for a mouse or pen press on a tile whose piece turns. Anything else (a touch,
  // a second button, a kind the browser drags) is left to the tile's own press and drag.
  const startCarry = (e: React.PointerEvent, kind: K, choice?: string): void => {
    if (e.pointerType === 'touch' || e.button !== 0 || !config.carries(kind)) return;
    endCarry();
    carry = { kind, choice, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, started: false };
    const move = (ev: PointerEvent) => {
      if (!carry || ev.pointerId !== carry.pointerId || carry.started) return;
      if (Math.hypot(ev.clientX - carry.x0, ev.clientY - carry.y0) < CARRY_THRESHOLD) return;
      carry.started = true;
      document.documentElement.dataset.paletteCarry = '';
      const { width, height } = config.sizeOf(carry.kind);
      config.setPreview({ kind: carry.kind, width, height, carried: true });
    };
    const up = (ev: PointerEvent) => {
      if (!carry || ev.pointerId !== carry.pointerId) return;
      const was = carry;
      if (was.started) {
        // The click this release makes (on the tile, or on whatever holds both the tile and the canvas) is the
        // carry's, not a press of the tile or the canvas.
        swallowNextClick();
        const target = ev.target instanceof Element ? ev.target : null;
        if (target?.closest('main') && !overFloatingPanel(target)) {
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
  };

  return {
    carriesByPointer: (kind) => config.carries(kind),
    // Whether a press is now down that a carry owns: the tile's own drag must not start under it.
    carryPressed: () => carry !== null,
    // Listen for carries released over the canvas; the latest is read with `lastCarryDrop`.
    subscribeCarryDrop: drops.subscribe,
    // The carry just released over the canvas (read inside a `subscribeCarryDrop` listener).
    lastCarryDrop: () => dropped,
    startCarry,
    endCarry,
    // A tile's dragstart under a carry: the browser's drag is cancelled, as the carry is the drag.
    cancelDragUnderCarry: (e) => {
      if (carry === null) return false;
      e.preventDefault();
      return true;
    },
  };
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
