'use client';

import { useEffect, useRef, type Ref, type RefObject } from 'react';
import { cloneCanvasLayer } from '@/lib/magnifier-clone';
import { formatMagnification, type MagnifierConfig } from '@/lib/magnifier-config';
import { lensPlacement, wheelChange } from '@/lib/magnifier-lens';
import type { MagnifierStore } from '@/lib/magnifier-store';

// The Magnifier lens's wiring (docs/specs/008-canvas/magnifier.md; blueprint "Behaviour and state"). Everything a
// pointer move does happens here, outside React: the latest point is kept, and one animation frame moves the lens
// and the enlarged copy inside it by their transforms. Nothing renders for a move (invariant I1).
//
// The listeners sit on `window` in the capture phase: the canvas's own capture handlers stop some presses (a press
// on an element under a view tool), and those must still move the lens. Each one checks the event is over the
// canvas surface itself, so the chrome (panels, the palette, menus) hides the lens and keeps its own wheel.

// How often the copy is made again after the elements change, at most (blueprint D132).
export const MAGNIFIER_RECOPY_MS = 250;
// How long the value badge shows after a wheel change (blueprint D135).
export const MAGNIFIER_BADGE_MS = 900;

type Point = { x: number; y: number; touch: boolean };

export function useMagnifierLens({
  mainRef,
  layerRef,
  lensRef,
  stageRef,
  badgeRef,
  store,
  contentKey,
  clone = cloneCanvasLayer,
}: {
  // The canvas surface (<main>); Canvas hands it down as a plain Ref.
  mainRef: Ref<HTMLElement>;
  // The drawn layer the lens copies (`[data-canvas-content]`).
  layerRef: RefObject<HTMLElement | null>;
  lensRef: RefObject<HTMLElement | null>;
  stageRef: RefObject<HTMLElement | null>;
  badgeRef: RefObject<HTMLElement | null>;
  store: MagnifierStore;
  // Changes whenever what is drawn changes (the tab's elements): the copy is made again.
  contentKey: unknown;
  clone?: (layer: HTMLElement) => HTMLElement;
}) {
  // Marks the copy out of date; the running effect below reads it.
  const recopy = useRef<(() => void) | null>(null);

  useEffect(() => {
    const main = mainRef && 'current' in mainRef ? mainRef.current : null;
    if (!main) return;
    let point: Point | null = null;
    let touchId: number | null = null;
    let raf = 0;
    let copy: HTMLElement | null = null;
    let backdrop: HTMLElement | null = null;
    let stale = true;
    let lastCopyAt = -Infinity;
    let copyTimer: ReturnType<typeof setTimeout> | null = null;
    let badgeTimer: ReturnType<typeof setTimeout> | null = null;
    let shown = false;
    let stageW = -1;
    let stageH = -1;

    const makeCopy = () => {
      const layer = layerRef.current;
      const stage = stageRef.current;
      if (!layer || !stage) return;
      copy = clone(layer);
      // The canvas background, so empty canvas reads as canvas under the lens; its pattern rides the same pan and
      // zoom as the copy because the stage maps <main> one to one before it scales.
      backdrop = document.createElement('div');
      backdrop.style.cssText = 'position:absolute;inset:0;';
      const bg = getComputedStyle(main);
      backdrop.style.backgroundColor = bg.backgroundColor;
      backdrop.style.backgroundImage = bg.backgroundImage;
      backdrop.style.backgroundSize = bg.backgroundSize;
      backdrop.style.backgroundPosition = bg.backgroundPosition;
      stage.replaceChildren(backdrop, copy);
      stale = false;
      lastCopyAt = performance.now();
    };

    const frame = () => {
      raf = 0;
      const lens = lensRef.current;
      const stage = stageRef.current;
      const layer = layerRef.current;
      if (!lens || !stage || !layer) return;
      if (!point) {
        if (shown) {
          shown = false;
          lens.style.visibility = 'hidden';
          main.style.removeProperty('cursor');
        }
        return;
      }
      if (stale) makeCopy();
      const rect = main.getBoundingClientRect();
      if (rect.width !== stageW || rect.height !== stageH) {
        stageW = rect.width;
        stageH = rect.height;
        stage.style.width = `${stageW}px`;
        stage.style.height = `${stageH}px`;
      }
      const { zoom, size } = store.get();
      const at = lensPlacement({
        x: point.x - rect.left,
        y: point.y - rect.top,
        size,
        zoom,
        touch: point.touch,
      });
      lens.style.transform = `translate3d(${at.left}px, ${at.top}px, 0)`;
      stage.style.transform = `translate3d(${at.stageX}px, ${at.stageY}px, 0) scale(${zoom})`;
      // A pan or a zoom since the copy was made: follow the live layer's transform, and the pattern's place.
      if (copy && copy.style.transform !== layer.style.transform) {
        copy.style.transform = layer.style.transform;
      }
      if (backdrop) {
        const position = main.style.backgroundPosition;
        if (position && backdrop.style.backgroundPosition !== position) {
          backdrop.style.backgroundPosition = position;
          backdrop.style.backgroundSize = main.style.backgroundSize;
        }
      }
      if (!shown) {
        shown = true;
        lens.style.visibility = 'visible';
        // The crosshair marks the point; the cursor would sit over it.
        main.style.cursor = 'none';
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    // Over the canvas itself: <main> or the drawn layer, never a panel or the palette inside <main>.
    const onSurface = (target: EventTarget | null) => {
      if (!(target instanceof Node) || !main.contains(target)) return false;
      if (target instanceof Element && target.closest('[data-floating-panel]')) return false;
      return target === main || !!layerRef.current?.contains(target);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (e.pointerId !== touchId) return;
        point = { x: e.clientX, y: e.clientY, touch: true };
      } else {
        point = onSurface(e.target) ? { x: e.clientX, y: e.clientY, touch: false } : null;
      }
      schedule();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (touchId !== null) {
        // A second finger: a pinch, not a look.
        touchId = null;
        point = null;
      } else if (onSurface(e.target)) {
        touchId = e.pointerId;
        point = { x: e.clientX, y: e.clientY, touch: true };
      }
      schedule();
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || e.pointerId !== touchId) return;
      touchId = null;
      point = null;
      schedule();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      point = null;
      schedule();
    };

    const showBadge = (text: string) => {
      const badge = badgeRef.current;
      if (!badge) return;
      badge.textContent = text;
      badge.style.opacity = '1';
      if (badgeTimer) clearTimeout(badgeTimer);
      badgeTimer = setTimeout(() => {
        badge.style.opacity = '0';
      }, MAGNIFIER_BADGE_MS);
    };

    // The wheel changes the lens, not the view, while the lens is up; Ctrl / Cmd (and a trackpad pinch, which
    // arrives with Ctrl) still zoom the canvas.
    const onWheel = (e: WheelEvent) => {
      if (!point || point.touch || e.ctrlKey || e.metaKey || !onSurface(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const change = wheelChange(store.get(), e);
      for (const field of Object.keys(change) as (keyof MagnifierConfig)[]) {
        store.set(field, change[field] as never);
      }
      const now = store.get();
      showBadge(change.size !== undefined ? `${now.size}px` : formatMagnification(now.zoom));
    };

    recopy.current = () => {
      stale = true;
      if (!shown) return;
      const wait = lastCopyAt + MAGNIFIER_RECOPY_MS - performance.now();
      if (wait <= 0) {
        schedule();
        return;
      }
      copyTimer ??= setTimeout(() => {
        copyTimer = null;
        schedule();
      }, wait);
    };

    const unsubscribe = store.subscribe(schedule);
    window.addEventListener('pointermove', onMove, { capture: true, passive: true });
    window.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    window.addEventListener('pointerup', onUp, { capture: true, passive: true });
    window.addEventListener('pointercancel', onUp, { capture: true, passive: true });
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    main.addEventListener('pointerleave', onLeave);
    return () => {
      unsubscribe();
      window.removeEventListener('pointermove', onMove, { capture: true });
      window.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('pointerup', onUp, { capture: true });
      window.removeEventListener('pointercancel', onUp, { capture: true });
      window.removeEventListener('wheel', onWheel, { capture: true });
      main.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
      if (copyTimer) clearTimeout(copyTimer);
      if (badgeTimer) clearTimeout(badgeTimer);
      main.style.removeProperty('cursor');
      // The copy's own nodes, whichever stage held them (the ref may point elsewhere by now).
      copy?.parentElement?.replaceChildren();
      recopy.current = null;
    };
  }, [mainRef, layerRef, lensRef, stageRef, badgeRef, store, clone]);

  // What is drawn changed: the copy is made again (throttled, and only while the lens shows).
  useEffect(() => {
    recopy.current?.();
  }, [contentKey]);
}
