'use client';

// A finger on an article page (docs/specs/007-editor/article-pages.md "On a phone"): a finger that
// travels pans the view, as it would scroll a page of a document; one that lifts where it landed is
// a tap, the writing's. The writing and its paper claim every press so the canvas never marquees
// over them, so the pan is driven from here. A second finger (a pinch) ends the pan: the pinch owns
// the view.
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { beginCanvasGesture } from '@/lib/canvas-gesture';
import { debugLog } from '@/lib/debug-log';

// Screen px a finger travels before its press is a pan rather than a tap.
export const TOUCH_PAN_SLOP = 8;

/** Moves the view by a screen-px drag from where it stood when the pan began. */
export type PanFrom = () => (dx: number, dy: number) => void;

/**
 * Returns a press handler: for a primary touch it arms a pan-or-tap and answers true (the caller
 * leaves the press alone); for a mouse or a pen it answers false.
 */
export function useTouchPagePan(
  panFrom: PanFrom | undefined,
): (e: ReactPointerEvent, onTap?: () => void) => boolean {
  const end = useRef<(() => void) | null>(null);
  useEffect(() => () => end.current?.(), []);
  return (e, onTap) => {
    if (e.pointerType !== 'touch' || !e.isPrimary || !panFrom) return false;
    end.current?.();
    const id = e.pointerId;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let move: ((dx: number, dy: number) => void) | null = null;
    let endGesture: (() => void) | null = null;
    let pending: { dx: number; dy: number } | null = null;
    let raf = 0;
    const flush = () => {
      raf = 0;
      if (pending && move) move(pending.dx, pending.dy);
      pending = null;
    };
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (!move) {
        if (Math.hypot(dx, dy) <= TOUCH_PAN_SLOP) return;
        move = panFrom();
        endGesture = beginCanvasGesture('pan');
        debugLog('[article-touch] pan began');
      }
      pending = { dx, dy };
      if (!raf) raf = requestAnimationFrame(flush);
    };
    const finish = (tap: boolean) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('pointerdown', onOther, true);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      flush();
      endGesture?.();
      end.current = null;
      if (tap && !move) onTap?.();
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId === id) finish(true);
    };
    const onCancel = (ev: PointerEvent) => {
      if (ev.pointerId === id) finish(false);
    };
    // Another finger down: a pinch, which owns the view from here.
    const onOther = (ev: PointerEvent) => {
      if (ev.pointerId !== id) finish(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('pointerdown', onOther, true);
    end.current = () => finish(false);
    return true;
  };
}
