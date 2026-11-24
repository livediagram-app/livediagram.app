'use client';

import { useRef, useSyncExternalStore, type Ref, type RefObject } from 'react';
import { useMagnifierLens } from '@/hooks/canvas/useMagnifierLens';
import { magnifierStore, type MagnifierStore } from '@/lib/magnifier-store';

// The Magnifier's lens (docs/specs/008-canvas/magnifier.md "The lens"): a pane of glass on the cursor showing the
// canvas under it enlarged. Rendered by Canvas after the drawn layer while the mode is on; useMagnifierLens moves
// it and fills its stage with a copy of the layer, so this component renders only when a setting changes.
//
// No z-index: as a later sibling of the drawn layer it paints over the canvas, while the chrome (palette, panels,
// popovers) stays above it, as the Spotlight's shroud does.
export function MagnifierLens({
  mainRef,
  layerRef,
  contentKey,
  store = magnifierStore,
}: {
  mainRef: Ref<HTMLElement>;
  layerRef: RefObject<HTMLElement | null>;
  contentKey: unknown;
  store?: MagnifierStore;
}) {
  const config = useSyncExternalStore(store.subscribe, store.get, store.get);
  const lensRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  useMagnifierLens({ mainRef, layerRef, lensRef, stageRef, badgeRef, store, contentKey });
  const round = config.shape === 'round';
  return (
    <div
      ref={lensRef}
      data-magnifier-lens=""
      data-shape={config.shape}
      aria-hidden
      inert
      // A white ring (slate in dark mode), a hairline and a soft drop shadow: glass over the canvas, never part of
      // the drawing (blueprint D135). Shadows, not a border, so the lens's inside is its full size.
      className="pointer-events-none absolute left-0 top-0 overflow-hidden bg-white shadow-[0_0_0_3px_#ffffff,0_0_0_4px_rgba(15,23,42,0.22),0_18px_40px_-12px_rgba(15,23,42,0.5)] will-change-transform dark:bg-slate-900 dark:shadow-[0_0_0_3px_#1e293b,0_0_0_4px_rgba(148,163,184,0.35),0_18px_40px_-12px_rgba(0,0,0,0.7)]"
      style={{
        width: config.size,
        height: config.size,
        borderRadius: round ? '9999px' : '14px',
        visibility: 'hidden',
      }}
    >
      <div
        ref={stageRef}
        data-magnifier-stage=""
        className="absolute left-0 top-0 origin-top-left"
      />
      {/* The point under the pointer: two short hairlines with a white halo, readable on any canvas. */}
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-slate-900/60 shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
      />
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-slate-900/60 shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
      />
      {/* The value a wheel turn just set ("3x", "300px"), for a moment (useMagnifierLens). */}
      <span
        ref={badgeRef}
        className="absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-white opacity-0 transition-opacity duration-150 motion-reduce:transition-none"
      />
    </div>
  );
}
