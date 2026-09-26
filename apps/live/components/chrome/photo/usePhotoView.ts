'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { FIT, clampView, panBy, pinchStep, zoomAt, type PhotoView } from '@/lib/photo-view';

// Zoom and pan on the photograph under review, the way a photo viewer works:
//
//   scroll wheel, trackpad pinch       zoom about the pointer
//   two-finger pinch on a touch screen zoom about the fingers, and pan with them
//   middle-button drag, Space + drag   pan
//   + / − / 0                          zoom in, zoom out, whole photo
//
// The WHEEL zooms here, where on the canvas it pans: the canvas is a board you
// travel across, this is one photograph you look INTO, and the operator asked
// for the wheel to do what it does in every photo viewer.
//
// A plain drag (one finger, left button) is not taken: on this surface it
// draws a box round a missed note, and that stays the gesture it always was.

// One step of the + and − buttons and keys.
const ZOOM_STEP = 1.5;
// The canvas's own wheel rate, so a pinch feels the same on both surfaces.
const WHEEL_ZOOM_RATE = 200;
// A wheel reporting in LINES (Firefox, a notched mouse) rather than pixels:
// roughly how many pixels one line is.
const LINE_PX = 16;

const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

export function usePhotoView(opts: { onGesture?: () => void } = {}) {
  // Told when a two-finger gesture takes over, so a box the first finger
  // started drawing is dropped rather than landed.
  const onGesture = useRef(opts.onGesture);
  onGesture.current = opts.onGesture;
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
      // Every wheel zooms: a mouse wheel, and a trackpad pinch (which arrives
      // as Ctrl + wheel). Up and away is in, as in every photo viewer.
      const dy = e.deltaMode === 1 ? e.deltaY * LINE_PX : e.deltaY;
      zoomBy(Math.exp(-dy / WHEEL_ZOOM_RATE), {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
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

  // Fingers on a touch screen, by pointer id, in frame pixels.
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const fingers = () => {
    const [a, b] = [...touches.current.values()];
    return a && b ? { a, b } : null;
  };
  const inFrame = (e: PointerEvent<HTMLDivElement>) => {
    const rect = viewportRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // Pointer panning, in the CAPTURE phase so it wins over the drag that draws
  // a box: two fingers, the middle button, or Space held make the drag the
  // hand's.
  const onPointerDownCapture = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, inFrame(e));
      if (touches.current.size === 2) {
        // The second finger: this was never a box being drawn.
        e.stopPropagation();
        onGesture.current?.();
        setPanning(true);
      }
      return;
    }
    if (!(spaceHeld || e.button === 1)) return;
    e.preventDefault();
    e.stopPropagation();
    panFrom.current = { x: e.clientX, y: e.clientY };
    setPanning(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMoveCapture = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      const before = fingers();
      touches.current.set(e.pointerId, inFrame(e));
      const after = fingers();
      if (before && after) {
        e.stopPropagation();
        setView((v) => pinchStep(v, size(), before, after));
      }
      return;
    }
    const from = panFrom.current;
    if (!from) return;
    e.stopPropagation();
    panFrom.current = { x: e.clientX, y: e.clientY };
    setView((v) => panBy(v, size(), e.clientX - from.x, e.clientY - from.y));
  };
  const onPointerUpCapture = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      const wasPinch = touches.current.size >= 2;
      touches.current.delete(e.pointerId);
      if (wasPinch) {
        // Lifting one finger of a pinch ends the gesture; it is not the end
        // of a drag that should land a box.
        e.stopPropagation();
        if (touches.current.size < 2) setPanning(false);
      }
      return;
    }
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
    viewportHandlers: {
      onPointerDownCapture,
      onPointerMoveCapture,
      onPointerUpCapture,
      onPointerCancelCapture: onPointerUpCapture,
      // The middle button's own browser habits — autoscroll on Windows, paste
      // on Linux — are not what a drag on the photo means.
      onMouseDownCapture: (e: MouseEvent<HTMLDivElement>) => {
        if (e.button === 1) e.preventDefault();
      },
      onAuxClickCapture: (e: MouseEvent<HTMLDivElement>) => {
        if (e.button === 1) e.preventDefault();
      },
    },
  };
}
