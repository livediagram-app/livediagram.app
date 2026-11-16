'use client';

// The presenter's round bubble (liveworkspace/docs/specs/006-media/walkthroughs.md "The bubble"): their camera, live
// while recording and played back after, in the corner they chose. Recorded with no camera, a round mark with their
// initial stands in, pulsing while it plays. And the microphone's level meter beside it while setting up.

import type { LevelMeter } from '@liveworkspace/capture';
import type { WalkthroughCorner } from '@liveworkspace/media/walkthrough';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

export const BUBBLE_PX = 132;

// Clear of each app's bottom chrome (the tab strip and zoom) and of the header.
const CORNER_CLASS: Record<WalkthroughCorner, string> = {
  'bottom-left': 'bottom-16 left-4',
  'bottom-right': 'bottom-16 right-4',
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
};

function BubbleFrame({ corner, children }: { corner: WalkthroughCorner; children: ReactNode }) {
  return (
    <div
      data-walkthrough-bubble={corner}
      style={{ width: BUBBLE_PX, height: BUBBLE_PX }}
      className={`pointer-events-none absolute z-40 overflow-hidden rounded-full bg-slate-900 shadow-xl shadow-slate-900/25 ring-[3px] ring-white transition-[top,left,right,bottom] duration-300 dark:ring-slate-800 ${CORNER_CLASS[corner]}`}
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
      className={`relative block h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 ${className}`}
    >
      <span
        ref={fill}
        className="absolute inset-0 origin-left scale-x-0 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
      />
    </span>
  );
}
