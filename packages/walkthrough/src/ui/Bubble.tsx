'use client';

// The presenter's round bubble (liveworkspace/docs/specs/006-media/walkthroughs.md "The bubble"): their camera, live
// while recording and played back after, in the corner they chose. Recorded with no camera, a round mark with their
// initial stands in, pulsing while it plays. And the microphone's level meter beside it while setting up.

import type { LevelMeter } from '@liveworkspace/capture';
import type { WalkthroughCorner } from '@liveworkspace/media/walkthrough';
import { CONTENTS_SIDEBAR_SELECTOR } from '@liveworkspace/workbench/lib/contents-sidebar';
import { MAP_PANEL_SELECTOR } from '@liveworkspace/workbench/lib/fit-clear-of-panel';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

export const BUBBLE_PX = 132;

// Clear of each app's bottom chrome (the tab strip and zoom) and of the header.
const CORNER_CLASS: Record<WalkthroughCorner, string> = {
  'bottom-left': 'bottom-16 left-4',
  'bottom-right': 'bottom-16 right-4',
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
};

// What the bubble keeps clear of, read by the same marks @liveworkspace/workbench measures them by. The Map (livediagram,
// livedocuments, livedesign) is a small panel in any corner that can be moved, so the bubble goes up or down past it.
// Contents docked as a sidebar (Pages mode) runs the canvas's whole left side, so the bubble goes across past it.
const CLEARANCE_PX = 12;
// How often they are looked for again while a bubble shows: either can be moved, opened or closed meanwhile.
const CHECK_MS = 500;
// The corner's inset in px, as CORNER_CLASS places it (bottom-16 is 64, the rest 16).
const INSET = { side: 16, top: 16, bottom: 64 };

type Box = { left: number; top: number; right: number; bottom: number };

/** How far the bubble moves from its corner (screen px) to stay clear of the Map and a docked Contents sidebar. */
export function shiftClearOf(
  corner: WalkthroughCorner,
  frame: Box,
  around: { map: Box | null; sidebar: Box | null },
): { x: number; y: number } {
  const bottom = corner.startsWith('bottom');
  const leftSide = corner.endsWith('left');
  // Across first: the sidebar is always down the left, so a left corner moves out past its right edge.
  let x = 0;
  const { sidebar, map } = around;
  if (sidebar && leftSide && sidebar.right > frame.left + INSET.side) {
    x = sidebar.right + CLEARANCE_PX - (frame.left + INSET.side);
  }
  const left = (leftSide ? frame.left + INSET.side : frame.right - INSET.side - BUBBLE_PX) + x;
  const top = bottom ? frame.bottom - INSET.bottom - BUBBLE_PX : frame.top + INSET.top;
  let y = 0;
  if (
    map &&
    left < map.right &&
    left + BUBBLE_PX > map.left &&
    top < map.bottom &&
    top + BUBBLE_PX > map.top
  ) {
    y = bottom ? map.top - CLEARANCE_PX - (top + BUBBLE_PX) : map.bottom + CLEARANCE_PX - top;
  }
  return { x, y };
}

const NO_SHIFT = { x: 0, y: 0 };
const boxOf = (selector: string): Box | null =>
  document.querySelector(selector)?.getBoundingClientRect() ?? null;

function useClearShift(frame: RefObject<HTMLDivElement | null>, corner: WalkthroughCorner) {
  const [shift, setShift] = useState(NO_SHIFT);
  useEffect(() => {
    const measure = () => {
      const parent = frame.current?.offsetParent;
      if (!parent) return;
      const next = shiftClearOf(corner, parent.getBoundingClientRect(), {
        map: boxOf(MAP_PANEL_SELECTOR),
        sidebar: boxOf(CONTENTS_SIDEBAR_SELECTOR),
      });
      setShift((prev) => (prev.x === next.x && prev.y === next.y ? prev : next));
    };
    measure();
    const timer = setInterval(measure, CHECK_MS);
    window.addEventListener('resize', measure);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', measure);
    };
  }, [frame, corner]);
  return shift;
}

function BubbleFrame({ corner, children }: { corner: WalkthroughCorner; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const shift = useClearShift(frame, corner);
  return (
    <div
      ref={frame}
      data-walkthrough-bubble={corner}
      style={{
        width: BUBBLE_PX,
        height: BUBBLE_PX,
        transform: shift.x || shift.y ? `translate(${shift.x}px, ${shift.y}px)` : undefined,
      }}
      className={`pointer-events-none absolute z-40 overflow-hidden rounded-full bg-slate-900 shadow-xl shadow-slate-900/25 ring-[3px] ring-white transition-[top,left,right,bottom,transform] duration-300 dark:ring-slate-800 ${CORNER_CLASS[corner]}`}
    >
      {children}
    </div>
  );
}

/** The presenter's own camera, mirrored as a mirror shows them, while setting up and recording. */
export function LiveBubble({ stream, corner }: { stream: MediaStream; corner: WalkthroughCorner }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [stream]);
  return (
    <BubbleFrame corner={corner}>
      <video ref={video} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
    </BubbleFrame>
  );
}

/** The recording's camera, played back: the player's own media element, drawn round. */
export function PlaybackBubble({
  corner,
  children,
}: {
  corner: WalkthroughCorner;
  children: ReactNode;
}) {
  return <BubbleFrame corner={corner}>{children}</BubbleFrame>;
}

/** Sound alone: the presenter's initial, pulsing while it plays. */
export function InitialBubble({
  corner,
  name,
  playing,
}: {
  corner: WalkthroughCorner;
  name: string;
  playing: boolean;
}) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <BubbleFrame corner={corner}>
      <span className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700">
        {playing ? (
          <span className="absolute inset-3 animate-ping rounded-full bg-white/20 motion-reduce:animate-none" />
        ) : null}
        <span className="relative text-4xl font-semibold text-white">{initial}</span>
      </span>
    </BubbleFrame>
  );
}

/** The microphone's level as a bar, read every frame from the meter without rendering. */
export function LevelBar({
  meter,
  className = '',
}: {
  meter: RefObject<LevelMeter | null>;
  className?: string;
}) {
  const fill = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    let shown = 0;
    const draw = () => {
      const level = meter.current?.read() ?? 0;
      // Rises at once, falls gently: a voice reads as a voice, not a flicker.
      shown = level > shown ? level : shown * 0.85 + level * 0.15;
      if (fill.current) fill.current.style.transform = `scaleX(${shown.toFixed(3)})`;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [meter]);
  return (
    <span
      role="presentation"
      className={`relative block h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 ${className}`}
    >
      {/* Empty to start through the same `transform` the meter writes: Tailwind's scale-x-0 sets the separate `scale`
          property, which multiplied every reading back to nothing (owner, 2026-11-17: the bar never moved). */}
      <span
        ref={fill}
        style={{ transform: 'scaleX(0)' }}
        className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
      />
    </span>
  );
}
