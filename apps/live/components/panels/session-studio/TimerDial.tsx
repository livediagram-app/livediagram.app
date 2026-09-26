'use client';

// The Timer's face (docs/specs/012-collaboration/session-tools.md): a clock dial whose coloured wedge IS the time.
//
// Modelled on the workshop "time timer": one lap is an hour, and the wedge
// shrinks toward twelve as a countdown runs, so the room reads how much is
// left from across the table without parsing digits. While setting up it is
// also the input: drag the handle round (or use the arrow keys) to choose
// the length. A stopwatch draws a thin sweep ring instead, one lap a minute,
// because an elapsed time has no "amount left" to fill.

import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import {
  DIAL_LAP_MINUTES,
  clampTimerMinutes,
  dialAngle,
  dialDragMinutes,
  minutesForDialAngle,
  wedgePath,
} from './session-studio';

const VB = 200;
const C = VB / 2;
const FACE_R = 92;
const WEDGE_R = 78;
const HUB_R = 50;

export type DialTone = 'brand' | 'amber' | 'rose' | 'slate';

const WEDGE_FILL: Record<DialTone, string> = {
  brand: 'fill-brand-500/85',
  amber: 'fill-amber-400',
  rose: 'fill-rose-500',
  slate: 'fill-slate-300 dark:fill-slate-600',
};
const SWEEP_STROKE: Record<DialTone, string> = {
  brand: 'stroke-brand-500',
  amber: 'stroke-amber-400',
  rose: 'stroke-rose-500',
  slate: 'stroke-slate-300 dark:stroke-slate-600',
};

export function TimerDial({
  fraction,
  variant = 'wedge',
  tone = 'brand',
  extraLap = false,
  setMinutes,
  onSetMinutes,
  children,
}: {
  // 0..1 of one lap to fill.
  fraction: number;
  variant?: 'wedge' | 'sweep';
  tone?: DialTone;
  // A duration past one lap: draw an outer ring so a 90-minute timer doesn't
  // read the same as a 60-minute one.
  extraLap?: boolean;
  // Interactive mode: the current minutes and the setter. Omit both for a
  // read-only face.
  setMinutes?: number;
  onSetMinutes?: (minutes: number) => void;
  children?: ReactNode;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const lastRef = useRef(setMinutes ?? 0);
  const interactive = onSetMinutes !== undefined && setMinutes !== undefined;

  const minutesAt = (e: PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const angle = dialAngle(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      e.clientX,
      e.clientY,
    );
    return minutesForDialAngle(angle);
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const m = minutesAt(e);
    if (m === null) return;
    // A fresh press jumps straight to where you pressed; only a DRAG applies
    // the no-wrap rule, which needs a previous position to mean anything.
    lastRef.current = m;
    onSetMinutes(m);
    svgRef.current?.focus({ preventScroll: true });
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!interactive || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const m = minutesAt(e);
    if (m === null) return;
    const next = dialDragMinutes(lastRef.current, m);
    lastRef.current = next;
    if (next !== setMinutes) onSetMinutes(next);
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const step: Record<string, number> = {
      ArrowUp: 1,
      ArrowRight: 1,
      ArrowDown: -1,
      ArrowLeft: -1,
      PageUp: 5,
      PageDown: -5,
    };
    let next: number | null = null;
    if (e.key in step) next = setMinutes + step[e.key]!;
    else if (e.key === 'Home') next = 1;
    else if (e.key === 'End') next = DIAL_LAP_MINUTES;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    onSetMinutes(clampTimerMinutes(next));
  };

  const handleAngle = fraction * Math.PI * 2;
  const hx = C + WEDGE_R * Math.sin(handleAngle);
  const hy = C - WEDGE_R * Math.cos(handleAngle);
  const sweepLen = 2 * Math.PI * WEDGE_R;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[184px]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB} ${VB}`}
        className={`h-full w-full select-none outline-none ${
          interactive
            ? 'cursor-grab touch-none rounded-full focus-visible:ring-2 focus-visible:ring-brand-400 active:cursor-grabbing'
            : ''
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        {...(interactive
          ? {
              role: 'slider',
              tabIndex: 0,
              'aria-label': 'Countdown length in minutes',
              'aria-valuemin': 1,
              'aria-valuemax': DIAL_LAP_MINUTES,
              'aria-valuenow': setMinutes,
              'aria-valuetext': `${setMinutes} minutes`,
            }
          : { 'aria-hidden': true })}
      >
        <circle
          cx={C}
          cy={C}
          r={FACE_R}
          className="fill-slate-50 stroke-slate-200 dark:fill-slate-800/70 dark:stroke-slate-700"
          strokeWidth={1.5}
        />
        {extraLap ? (
          <circle
            cx={C}
            cy={C}
            r={FACE_R + 4}
            fill="none"
            strokeWidth={3}
            className={SWEEP_STROKE[tone]}
          />
        ) : null}
        {/* Minute ticks: a longer one every five minutes, like a watch. */}
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const major = i % 5 === 0;
          const r1 = FACE_R - (major ? 9 : 5);
          const r2 = FACE_R - 2;
          return (
            <line
              key={i}
              x1={C + r1 * Math.sin(a)}
              y1={C - r1 * Math.cos(a)}
              x2={C + r2 * Math.sin(a)}
              y2={C - r2 * Math.cos(a)}
              strokeWidth={major ? 1.6 : 0.8}
              className="stroke-slate-300 dark:stroke-slate-600"
            />
          );
        })}
        {variant === 'wedge' ? (
          // No transition on `d`: the browser morphs path data point by
          // point, and a wedge crossing half a lap (the arc's large-arc flag
          // flips) or becoming the full-circle path has no sensible
          // in-between, so dragging drew warped shapes. The wedge redraws on
          // every drag frame and every clock tick anyway.
          <path d={wedgePath(C, C, WEDGE_R, fraction)} className={WEDGE_FILL[tone]} />
        ) : (
          <circle
            cx={C}
            cy={C}
            r={WEDGE_R}
            fill="none"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${fraction * sweepLen} ${sweepLen}`}
            transform={`rotate(-90 ${C} ${C})`}
            className={SWEEP_STROKE[tone]}
          />
        )}
        <circle cx={C} cy={C} r={HUB_R} className="fill-white drop-shadow-sm dark:fill-slate-900" />
        {interactive ? (
          <>
            <line
              x1={C + HUB_R * Math.sin(handleAngle)}
              y1={C - HUB_R * Math.cos(handleAngle)}
              x2={hx}
              y2={hy}
              strokeWidth={2}
              className="stroke-white/70 dark:stroke-slate-900/60"
            />
            <circle
              cx={hx}
              cy={hy}
              r={9}
              strokeWidth={3}
              className="fill-white stroke-brand-500 drop-shadow"
            />
          </>
        ) : null}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
