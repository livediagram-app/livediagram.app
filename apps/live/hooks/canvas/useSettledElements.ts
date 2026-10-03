'use client';

// What the Map draws (docs/specs/008-canvas/canvas-performance.md): the elements as they settle, not
// as every frame of a gesture leaves them. Through a move, resize, reshape, stroke or erase it keeps
// its last drawing and catches up the moment the gesture ends; otherwise a change shows at once after
// a quiet spell, and a burst of changes (a peer typing, a remote drag) lands as one trailing redraw
// at most every MAP_REDRAW_MIN_MS (docs/specs/008-canvas/blueprints/DEFAULTS.md D69).

import { useEffect, useRef, useState } from 'react';
import type { Element } from '@livediagram/document';
import { ELEMENT_GESTURES, useCanvasGesture } from '@/lib/canvas-gesture';
import { debugLog } from '@/lib/debug-log';

export const MAP_REDRAW_MIN_MS = 250;

export function useSettledElements(elements: Element[]): Element[] {
  const gesture = useCanvasGesture();
  const frozen = gesture !== 'idle' && ELEMENT_GESTURES.has(gesture);
  const [shown, setShown] = useState(elements);
  // When the drawing last changed; stamped by the first effect, as the mount's drawing.
  const shownAtRef = useRef<number | null>(null);
  const wasFrozenRef = useRef(frozen);
  const latestRef = useRef(elements);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    shownAtRef.current ??= Date.now();
    latestRef.current = elements;
    const justReleased = wasFrozenRef.current && !frozen;
    wasFrozenRef.current = frozen;
    if (frozen) {
      // A trailing redraw that would fall due mid-gesture waits for the release instead.
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }
    if (elements === shown) return;
    const show = (reason: 'gesture-end' | 'change' | 'trailing') => {
      timerRef.current = null;
      shownAtRef.current = Date.now();
      debugLog('[map] redraw', { reason, count: latestRef.current.length });
      setShown(latestRef.current);
    };
    if (justReleased) {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      show('gesture-end');
      return;
    }
    const wait = (shownAtRef.current ?? 0) + MAP_REDRAW_MIN_MS - Date.now();
    if (wait <= 0) {
      show('change');
      return;
    }
    if (timerRef.current === null)
      timerRef.current = window.setTimeout(() => show('trailing'), wait);
  }, [elements, frozen, shown]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return shown;
}
