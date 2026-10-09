'use client';

// What the build loaders share (DiagramBuildAnimation, SheetBuildAnimation): the eased clock, the "You" collaborator
// cursor and the loop's phase, so every loader moves, looks and resumes alike.
import { useLayoutEffect, type RefObject } from 'react';

export type Point = [number, number];

// The one ease of every gesture (cubic in-out).
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const r1 = (v: number) => Math.round(v * 10) / 10;

// An eased glide from one point to another between two moments of the loop (%), as dense keyframe stops.
export function glideStops(
  stops: [number, Point][],
  t0: number,
  t1: number,
  from: Point,
  to: Point,
): void {
  for (let i = 0; i <= 8; i++) {
    const e = ease(i / 8);
    stops.push([
      t0 + (t1 - t0) * (i / 8),
      [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e],
    ]);
  }
}

export const cursorKeyframes = (name: string, stops: [number, Point][]) =>
  `@keyframes ${name} {\n${stops
    .map(([t, [x, y]]) => `  ${r1(t)}% { transform: translate(${r1(x)}px, ${r1(y)}px); }`)
    .join('\n')}\n}`;

// The cursor's fade: in at the start, out before the dissolve.
export const cursorFadeKeyframes = (name: string) => `@keyframes ${name} {
  0% { opacity: 0; }
  3%, 84% { opacity: 1; }
  89%, 100% { opacity: 0; }
}`;

// The "You" cursor. The outer group carries the path (`moveClass`), the inner one the fade (`fadeClass`), so the
// two keyframe sets stay independent.
export function BuildCursor({ moveClass, fadeClass }: { moveClass: string; fadeClass: string }) {
  return (
    <g className={moveClass} aria-hidden="true">
      <g className={fadeClass}>
        <path
          d="M0 0 L0 15.5 L4.2 11.6 L7.2 18.2 L10 17 L7.1 10.6 L12.6 10.4 Z"
          className="fill-brand-500 dark:fill-brand-400"
          stroke="white"
          strokeWidth={1.25}
          strokeLinejoin="round"
        />
        <rect
          x={11}
          y={17}
          width={28}
          height={15}
          rx={7.5}
          className="fill-brand-500 dark:fill-brand-400"
        />
        <text
          x={25}
          y={27.6}
          textAnchor="middle"
          fontSize={9}
          fontWeight={600}
          fill="white"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          You
        </text>
      </g>
    </g>
  );
}

// Each loader's start in this page, by name.
const epochs = new Map<string, number>();

// The loop's phase is measured from when the loader `name` first started in the page, so a remount continues the
// loop instead of restarting it. A prerendered copy is already animating before any script runs, so the first mount
// reads its phase from that running animation rather than taking "now" as the start.
export function useLoopPhase(
  ref: RefObject<HTMLElement | null>,
  name: string,
  durationMs: number,
  delayVar: string,
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    const now = performance.now();
    let epoch = epochs.get(name);
    if (epoch === undefined) {
      const running = el?.getAnimations?.({ subtree: true })[0]?.currentTime;
      const elapsed = typeof running === 'number' ? running : 0;
      epoch = now - elapsed;
      epochs.set(name, epoch);
      // This copy IS the running loop: its own delay already matches the phase.
      if (elapsed > 0) return;
    }
    el?.style.setProperty(delayVar, `${-((now - epoch) % durationMs)}ms`);
  }, [ref, name, durationMs, delayVar]);
}
