import { useEffect, useRef, type RefObject } from 'react';
import {
  ANIMATION_SPEED_FACTOR,
  DEFAULT_ANIMATION_SPEED,
  type ArrowElement,
  type ArrowFlow,
} from '@livediagram/diagram';

// The flowing-arrow rendering slice (spec/09), lifted out of ArrowView:
// the per-flow path class / dash tables, the phase-sync pinning hook,
// and the travelling dot / comet overlays. The view keeps the visible
// <path> (the class + dash land on it) and mounts the returned refs.

// Per-flow path styling. Every flow except 'dots' (a travelling <circle>) and
// 'comet' (a small fleet of travelling dots) animates the line itself via a
// class; dashes / beads / draw / wind / signal also swap in their own dash
// pattern, while pulse / grow / glow / heartbeat / breathe / shimmer /
// rainbow / strobe keep the user's static stroke and just breathe opacity /
// thickness / a halo / its colour. A missing entry (no flow, or 'dots' /
// 'comet') leaves the path on its static style.
const FLOW_PATH_CLASS: Partial<Record<ArrowFlow, string>> = {
  dashes: 'lvd-arrow-flow',
  beads: 'lvd-arrow-beads',
  pulse: 'lvd-arrow-pulse',
  grow: 'lvd-arrow-grow',
  glow: 'lvd-arrow-glow',
  heartbeat: 'lvd-arrow-heartbeat',
  breathe: 'lvd-arrow-breathe',
  shimmer: 'lvd-arrow-shimmer',
  signal: 'lvd-arrow-signal',
  draw: 'lvd-arrow-draw',
  rainbow: 'lvd-arrow-rainbow',
  strobe: 'lvd-arrow-strobe',
  wind: 'lvd-arrow-wind',
};
// 'draw' normalises the path to pathLength=1, so its dash pattern is in those
// units (one full-length dash + an equal gap that the reveal slides through).
// 'signal' is one long dash per 80-unit period (matching its -80 offset
// keyframe) so a single packet travels the line at a time.
const FLOW_PATH_DASH: Partial<Record<ArrowFlow, string>> = {
  dashes: '8 6',
  beads: '0.1 12',
  draw: '1 1',
  wind: '16 10',
  signal: '14 66',
};
// 'comet' renders the head plus three trailing dots (decreasing size + opacity,
// staggered along the path) so it reads as a glowing dot with a fading tail.
const COMET_DOTS = [0, 1, 2, 3];

// Flow derivations + phase sync. CSS animations start counting from
// when each element's animation is applied, so arrows whose flow was
// turned on at different times drift apart. Pin every flow animation's
// startTime to the shared document-timeline origin (0) via the Web
// Animations API, so all flowing arrows are measured against ONE clock
// and same-speed siblings stay in phase no matter when they were added
// or last changed. Re-runs on flow / speed change (a speed change
// restarts the CSS animation).
export function useArrowFlow(arrow: ArrowElement) {
  const flowFactor = ANIMATION_SPEED_FACTOR[arrow.flowSpeed ?? DEFAULT_ANIMATION_SPEED];
  const flowPathClass = arrow.flow ? FLOW_PATH_CLASS[arrow.flow] : undefined;
  const flowPathDash = arrow.flow ? FLOW_PATH_DASH[arrow.flow] : undefined;
  const flowPathRef = useRef<SVGPathElement>(null);
  const flowDotRef = useRef<SVGCircleElement>(null);
  // 'comet' is a group of dots; pin its whole subtree (each trailing dot keeps
  // its negative animation-delay, so they stay a phase-locked tail).
  const flowCometRef = useRef<SVGGElement>(null);
  useEffect(() => {
    if (!arrow.flow || typeof window === 'undefined') return;
    // A play-once flow (flowRepeat false, spec/09) must NOT be pinned to the
    // document-timeline origin: with one iteration, startTime 0 lands it in
    // the finished state before the user ever sees it play. It starts when
    // applied instead — phase sync only matters for loops.
    if (arrow.flowRepeat === false) return;
    const raf = window.requestAnimationFrame(() => {
      const pin = (a: Animation) => {
        try {
          a.startTime = 0;
        } catch {
          // Some engines disallow setting startTime on a CSS animation; the
          // arrow still flows, just not phase-locked. Best-effort.
        }
      };
      flowPathRef.current?.getAnimations().forEach(pin);
      flowDotRef.current?.getAnimations().forEach(pin);
      flowCometRef.current?.getAnimations({ subtree: true }).forEach(pin);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [arrow.flow, arrow.flowSpeed, arrow.flowRepeat]);
  return { flowFactor, flowPathClass, flowPathDash, flowPathRef, flowDotRef, flowCometRef };
}

// The travelling overlays: 'dots' (a dot travels the path via CSS
// offset-path — reduced-motion-safe; freezes on export) and 'comet' (the
// same travel but a fleet of dots, each lagging the head by a fixed
// fraction of the loop via negative animation-delay and shrinking /
// fading). Painted last by the view so they ride on top of the line.
export function ArrowFlowOverlays({
  arrow,
  pathD,
  strokeWidth,
  baseStroke,
  flowFactor,
  dotRef,
  cometRef,
}: {
  arrow: ArrowElement;
  pathD: string;
  strokeWidth: number;
  baseStroke: string;
  flowFactor: number;
  dotRef: RefObject<SVGCircleElement | null>;
  cometRef: RefObject<SVGGElement | null>;
}) {
  return (
    <>
      {arrow.flow === 'dots' ? (
        <circle
          ref={dotRef}
          r={Math.max(3, strokeWidth * 1.6)}
          fill={baseStroke}
          className="lvd-arrow-dot"
          style={
            {
              offsetPath: `path('${pathD}')`,
              offsetRotate: '0deg',
              pointerEvents: 'none',
              '--lvd-flow-speed': flowFactor,
              ...(arrow.flowRepeat === false ? { '--lvd-flow-iter': 1 } : {}),
            } as React.CSSProperties
          }
          aria-hidden
        />
      ) : null}
      {arrow.flow === 'comet' ? (
        <g ref={cometRef} aria-hidden>
          {COMET_DOTS.map((i) => (
            <circle
              key={i}
              r={Math.max(1.5, strokeWidth * (1.7 - i * 0.32))}
              fill={baseStroke}
              className="lvd-arrow-dot"
              style={
                {
                  offsetPath: `path('${pathD}')`,
                  offsetRotate: '0deg',
                  pointerEvents: 'none',
                  opacity: 1 - i * 0.22,
                  // Lag scales with the speed factor so the tail length stays
                  // constant across slow / normal / fast.
                  animationDelay: `${-0.1 * i * flowFactor}s`,
                  '--lvd-flow-speed': flowFactor,
                  ...(arrow.flowRepeat === false ? { '--lvd-flow-iter': 1 } : {}),
                } as React.CSSProperties
              }
            />
          ))}
        </g>
      ) : null}
    </>
  );
}
