'use client';

// The presenter's round bubble (liveworkspace/docs/specs/006-media/walkthroughs.md "The bubble"): their camera, live
// while recording and played back after, in the corner they chose. Recorded with no camera, the voice chip stands in:
// a small pill with their initial, name and level bars, never a camera-sized circle that reads as an empty camera
// ("Recording without a camera"). And the microphone's level meter beside it while setting up.

import type { LevelMeter } from '@liveworkspace/capture';
import type { WalkthroughCorner } from '@liveworkspace/media/walkthrough';
import { GlyphDisc } from '@liveworkspace/ui';
import { CONTENTS_SIDEBAR_SELECTOR } from '@liveworkspace/workbench/lib/contents-sidebar';
import { MAP_PANEL_SELECTOR } from '@liveworkspace/workbench/lib/fit-clear-of-panel';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

export const BUBBLE_PX = 132;
// The voice chip's height: a label beside the canvas, not a picture.
export const VOICE_CHIP_PX = 40;
// The player's bar (Player.tsx), which a bottom corner's mark keeps clear of on a narrow window.
export const PLAYER_BAR_SELECTOR = '[data-walkthrough-bar]';

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
type Size = { w: number; h: number };
const BUBBLE_SIZE: Size = { w: BUBBLE_PX, h: BUBBLE_PX };

/**
 * How far the bubble (or the voice chip, by its own `size`) moves from its corner (screen px) to stay clear of the Map,
 * a docked Contents sidebar and the player's bar.
 */
export function shiftClearOf(
  corner: WalkthroughCorner,
  frame: Box,
  // `bar`: the player's bar, centred along the bottom; absent while recording.
  around: { map: Box | null; sidebar: Box | null; bar?: Box | null },
  size: Size = BUBBLE_SIZE,
): { x: number; y: number } {
  const bottom = corner.startsWith('bottom');
  const leftSide = corner.endsWith('left');
  // Across first: the sidebar is always down the left, so a left corner moves out past its right edge.
  let x = 0;
  const { sidebar, map } = around;
  if (sidebar && leftSide && sidebar.right > frame.left + INSET.side) {
    x = sidebar.right + CLEARANCE_PX - (frame.left + INSET.side);
  }
  const left = (leftSide ? frame.left + INSET.side : frame.right - INSET.side - size.w) + x;
  const top = bottom ? frame.bottom - INSET.bottom - size.h : frame.top + INSET.top;
  let y = 0;
  if (
    map &&
    left < map.right &&
    left + size.w > map.left &&
    top < map.bottom &&
    top + size.h > map.top
  ) {
    y = bottom ? map.top - CLEARANCE_PX - (top + size.h) : map.bottom + CLEARANCE_PX - top;
  }
  // On a narrow window a bottom corner reaches under the centred player bar: it goes up above the bar too.
  const bar = around.bar;
  if (
    bar &&
    bottom &&
    left < bar.right &&
    left + size.w > bar.left &&
    top + y < bar.bottom &&
    top + y + size.h > bar.top
  ) {
    y = bar.top - CLEARANCE_PX - (top + size.h);
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
      const el = frame.current;
      const parent = el?.offsetParent;
      if (!el || !parent) return;
      const next = shiftClearOf(
        corner,
        parent.getBoundingClientRect(),
        {
          map: boxOf(MAP_PANEL_SELECTOR),
          sidebar: boxOf(CONTENTS_SIDEBAR_SELECTOR),
          bar: boxOf(PLAYER_BAR_SELECTOR),
        },
        // Its own size, untouched by the shift's transform: the bubble's, or the chip's as its name sets it.
        { w: el.offsetWidth || BUBBLE_PX, h: el.offsetHeight || BUBBLE_PX },
      );
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

// What sits in the presenter's corner, kept clear of the Map and a docked sidebar: the camera bubble or the voice chip.
function CornerFrame({
  corner,
  className,
  attrs,
  children,
}: {
  corner: WalkthroughCorner;
  className: string;
  attrs?: Record<string, string>;
  children: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const shift = useClearShift(frame, corner);
  return (
    <div
      ref={frame}
      {...attrs}
      style={{
        transform: shift.x || shift.y ? `translate(${shift.x}px, ${shift.y}px)` : undefined,
      }}
      className={`pointer-events-none absolute z-40 transition-[top,left,right,bottom,transform] duration-300 ${CORNER_CLASS[corner]} ${className}`}
    >
      {children}
    </div>
  );
}

function BubbleFrame({ corner, children }: { corner: WalkthroughCorner; children: ReactNode }) {
  return (
    <CornerFrame
      corner={corner}
      attrs={{ 'data-walkthrough-bubble': corner }}
      className="h-[132px] w-[132px] overflow-hidden rounded-full bg-slate-900 shadow-xl shadow-slate-900/25 ring-[3px] ring-white dark:ring-slate-800"
    >
      {children}
    </CornerFrame>
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

// The voice chip's level bars: each a quarter of a cycle behind the last, so together they read as a voice.
const VOICE_BARS = [0, 0.225, 0.45, 0.675] as const;

/**
 * Sound alone: the voice chip, a small pill with the presenter's initial, their name (when known) and four level bars
 * that move while it plays and rest while paused. Far smaller than the camera bubble and not round, so it never reads
 * as a camera with no picture.
 */
export function VoiceChip({
  corner,
  name,
  fallback,
  playing,
}: {
  corner: WalkthroughCorner;
  // The presenter as the list names them ("You" for one's own), or null when it has no name for them.
  name: string | null;
  // What the initial comes from without a name: the walkthrough's title.
  fallback: string;
  playing: boolean;
}) {
  const initial = ((name ?? fallback).trim()[0] ?? '?').toUpperCase();
  return (
    <CornerFrame
      corner={corner}
      attrs={{ 'data-walkthrough-voice': corner }}
      className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white/95 py-1 pl-1 pr-3 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/30"
    >
      <GlyphDisc
        aria-hidden
        size={32}
        className="bg-gradient-to-br from-brand-500 to-brand-700 text-[13px] font-semibold text-white"
      >
        {initial}
      </GlyphDisc>
      {name ? (
        <span className="text-optical-line max-w-[9rem] truncate text-[12px] font-medium text-slate-700 dark:text-slate-200">
          {name}
        </span>
      ) : null}
      <VoiceBars playing={playing} />
    </CornerFrame>
  );
}

/** The voice chip's four level bars: moving while it plays, resting while paused. */
function VoiceBars({ playing }: { playing: boolean }) {
  return (
    <span
      aria-hidden
      data-voice-bars={playing ? 'moving' : 'resting'}
      className="flex h-4 items-center gap-[3px]"
    >
      {VOICE_BARS.map((delay) => (
        <span
          key={delay}
          // Rests at a third of its height; while playing it rises and falls, started part-way through its cycle.
          style={{
            transform: 'scaleY(0.35)',
            animation: playing
              ? `walkthrough-voice 0.9s ease-in-out -${delay}s infinite alternate`
              : undefined,
          }}
          className="h-4 w-[3px] origin-center rounded-full bg-brand-600 motion-reduce:!animate-none dark:bg-brand-400"
        />
      ))}
    </span>
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
