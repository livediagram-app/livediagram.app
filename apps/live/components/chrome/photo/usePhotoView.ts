'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { FIT, clampView, panBy, zoomAt, type PhotoView } from '@/lib/photo-view';

// Zoom and pan on the photograph under review, with the canvas's own gestures
// so nothing has to be learnt twice (see useCanvasPinchZoom):
//
//   Ctrl/Cmd + wheel, trackpad pinch   zoom about the pointer
//   wheel, two-finger drag             pan (Shift + wheel pans sideways)
//   Space + drag, middle-button drag   pan
//   + / − / 0                          zoom in, zoom out, whole photo
//
// A plain drag is not taken: on this surface it draws a box round a missed
// note, and that stays the gesture it always was.

// One step of the + and − buttons and keys.
const ZOOM_STEP = 1.5;
// The canvas's own wheel rate, so a pinch feels the same on both surfaces.
const WHEEL_ZOOM_RATE = 200;

const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

export function usePhotoView() {
  const [view, setView] = useState<PhotoView>(FIT);
  // The frame the picture sits in. Its size IS the fitted picture's size.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const panFrom = useRef<{ x: number; y: number } | null>(null);

  const size = () => ({
    width: viewportRef.current?.clientWidth ?? 0,
    height: viewportRef.current?.clientHeight ?? 0,
  });
  const centre = () => ({ x: size().width / 2, y: size().height / 2 });

  const zoomBy = useCallback((factor: number, at?: { x: number; y: number }) => {
    setView((v) => zoomAt(v, size(), factor, at ?? centre()));
  }, []);
  const zoomIn = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / ZOOM_STEP), [zoomBy]);
  const fit = useCallback(() => setView(FIT), []);

  // The wheel, registered by hand: React's onWheel is passive, and a passive
  // listener cannot stop the browser zooming the whole PAGE on Ctrl + wheel.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomBy(Math.exp(-e.deltaY / WHEEL_ZOOM_RATE), {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        return;
      }
      // A mouse wheel only scrolls one way; Shift turns it sideways.
      const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
      const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
      setView((v) => panBy(v, size(), -dx, -dy));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  // Space held = the hand. Keys belong to the words being typed, never to the
  // view, while a note's words are being edited.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (typingIn(e.target)) return;
      if (e.key === ' ') {
        // Not the page scroll, and not the focused tick box's toggle.
        e.preventDefault();
        setSpaceHeld(true);
      } else if (e.key === '+' || e.key === '=') zoomIn();
      else if (e.key === '-' || e.key === '_') zoomOut();
      else if (e.key === '0') fit();
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== ' ') return;
      if (!typingIn(e.target)) e.preventDefault();
      setSpaceHeld(false);
    };
    // Letting go of Space in another window must not leave the hand stuck on.
    const onBlur = () => setSpaceHeld(false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [zoomIn, zoomOut, fit]);

  // A window resized while zoomed can leave the photo past its own edge.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setView((v) => clampView(v, size())));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Pointer panning, in the CAPTURE phase so it wins over the drag that draws
  // a box: with Space held or the middle button down, the drag is the hand's.
  const onPointerDownCapture = (e: PointerEvent<HTMLDivElement>) => {
    if (!(spaceHeld || e.button === 1)) return;
    e.preventDefault();
    e.stopPropagation();
    panFrom.current = { x: e.clientX, y: e.clientY };
    setPanning(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMoveCapture = (e: PointerEvent<HTMLDivElement>) => {
    const from = panFrom.current;
    if (!from) return;
    e.stopPropagation();
    panFrom.current = { x: e.clientX, y: e.clientY };
    setView((v) => panBy(v, size(), e.clientX - from.x, e.clientY - from.y));
  };
  const onPointerUpCapture = (e: PointerEvent<HTMLDivElement>) => {
    if (!panFrom.current) return;
    e.stopPropagation();
    panFrom.current = null;
    setPanning(false);
  };

  return {
    view,
    viewportRef,
    zoomIn,
    zoomOut,
    fit,
    // What the pointer is about to do, for the cursor.
    hand: panning ? ('grabbing' as const) : spaceHeld ? ('grab' as const) : null,
    viewportHandlers: { onPointerDownCapture, onPointerMoveCapture, onPointerUpCapture },
  };
}
