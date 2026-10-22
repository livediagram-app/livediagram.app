'use client';

import { useCallback, useEffect, useRef } from 'react';

// Finger-scrolling for a card face's scrolling body (the collab panels, the
// Comment Panel, the Action Panel), which has to be `touch-none` so the canvas
// can drag the element (docs/specs/008-canvas/canvas-and-palette.md#touch-ios--ipad).
// That turns the browser's own touch scrolling off, so this puts it back by
// hand, but ONLY for a finger that lands on the content: the cards inside
// (a Q&A note, a comment). A finger on the body's own padding or the gaps
// between cards, like one on the header or footer, still drags the element,
// and so does any finger when there is nothing to scroll. Mouse and pen are
// untouched: a wheel already scrolls the body.
//
// Spread the returned props on the scroller.

// Momentum after the finger lifts: px per ms, decayed each frame.
const FRICTION = 0.95;
const MIN_VELOCITY = 0.02;

export function useTouchScrollBody<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onPointerDown = useCallback((e: React.PointerEvent<T>) => {
    const el = ref.current;
    if (!el || e.pointerType !== 'touch') return;
    // The body itself (its padding, the gaps between cards) is a drag handle.
    if (e.target === el) return;
    if (el.scrollHeight <= el.clientHeight + 1) return;
    // Ours now: the element wrapper above must not start a drag.
    e.stopPropagation();
    cancelAnimationFrame(frame.current);
    const pointerId = e.pointerId;
    // The face is drawn at the canvas zoom (and CollabScale's fit), so a
    // screen pixel is not a scroll pixel.
    const scale = el.getBoundingClientRect().height / el.offsetHeight || 1;
    let lastY = e.clientY;
    let lastT = e.timeStamp;
    let velocity = 0;
    el.setPointerCapture?.(pointerId);

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dy = (lastY - ev.clientY) / scale;
      const dt = Math.max(1, ev.timeStamp - lastT);
      el.scrollTop += dy;
      velocity = dy / dt;
      lastY = ev.clientY;
      lastT = ev.timeStamp;
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      // A finger that paused before lifting has no fling left.
      if (ev.timeStamp - lastT > 80) return;
      let prev = performance.now();
      const glide = (now: number) => {
        const dt = now - prev;
        prev = now;
        el.scrollTop += velocity * dt;
        velocity *= Math.pow(FRICTION, dt / 16);
        if (Math.abs(velocity) > MIN_VELOCITY) frame.current = requestAnimationFrame(glide);
      };
      frame.current = requestAnimationFrame(glide);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }, []);

  return { ref, onPointerDown };
}
