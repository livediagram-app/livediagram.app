// Live miniatures for the animation sets that predate the per-kind sets: arrow flow, icon glyph
// motion, and the progress, rating and chart animations (docs/specs/028-animation/element-animations.md
// "The menu"). Each renders the canvas's own renderer (or its own classes) at tile size, so a tile
// shows exactly what picking it does; AnimationPreviewTile freezes it and plays it on hover.

import { useRef, type CSSProperties } from 'react';
import type {
  ArrowElement,
  ArrowFlow,
  IconAnimation,
  PieAnim,
  ProgressAnim,
  RatingAnim,
  ShapeElement,
} from '@livediagram/document';
import { ArrowFlowOverlays, FLOW_PATH_CLASS, FLOW_PATH_DASH } from '@/components/canvas/arrow-flow';
import { IconGlyph } from '@/components/primitives/icon-glyph';
import { ProgressView } from '@/components/canvas/ProgressView';
import { RatingView } from '@/components/canvas/RatingView';
import { PieChartView } from '@/components/canvas/PieChartView';

const ACCENT = '#0ea5e9';
const ARROW_D = 'M3 15 C 13 3, 25 19, 37 7';

/** A short curved arrow running the flow's real path class, dash and travelling dots. */
export function ArrowFlowPreview({ flow }: { flow: ArrowFlow | null }) {
  const dotRef = useRef<SVGCircleElement>(null);
  const cometRef = useRef<SVGGElement>(null);
  const cls = flow ? FLOW_PATH_CLASS[flow] : undefined;
  return (
    <svg width="44" height="22" viewBox="0 0 44 22" overflow="visible">
      <path
        d={ARROW_D}
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        pathLength={flow === 'draw' ? 1 : undefined}
        className={cls}
        strokeDasharray={flow ? FLOW_PATH_DASH[flow] : undefined}
        style={
          {
            '--lvd-flow-speed': 1,
            '--lvd-flow-w': '2px',
            '--lvd-flow-color': ACCENT,
          } as CSSProperties
        }
      />
      <path
        d="M33.5 4.5 L38.5 6.5 L36 11"
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {flow === 'dots' || flow === 'comet' ? (
        <ArrowFlowOverlays
          arrow={{ flow } as ArrowElement}
          pathD={ARROW_D}
          strokeWidth={2}
          baseStroke={ACCENT}
          flowFactor={1}
          dotRef={dotRef}
          cometRef={cometRef}
        />
      ) : null}
    </svg>
  );
}

// Icon motions that move the glyph: they rest over a faint ghost of where it started.
const ICON_MOVES = new Set<IconAnimation>([
  'spin',
  'bounce',
  'wiggle',
  'tada',
  'flip',
  'jump',
  'swing',
  'float',
]);

/** A line-art star wearing the icon animation. */
export function IconAnimationPreview({ animation }: { animation: IconAnimation | null }) {
  return (
    <span className="relative block h-[24px] w-[24px] text-sky-500">
      {animation && ICON_MOVES.has(animation) ? (
        <span className="absolute inset-0 opacity-25">
          <IconGlyph iconId="star" stroke="currentColor" />
        </span>
      ) : null}
      <IconGlyph
        iconId="star"
        stroke="currentColor"
        animation={animation ?? undefined}
        animationSpeed="normal"
      />
    </span>
  );
}

// A data shape stand-in at tile size: only what its view reads.
const shape = (extra: Record<string, unknown>) =>
  ({ id: 'tile', type: 'shape', x: 0, y: 0, ...extra }) as unknown as ShapeElement;

/** A progress bar at 65%, its percentage hidden at this size. */
export function ProgressAnimPreview({ anim }: { anim: ProgressAnim | null }) {
  return (
    <span className="relative block h-[9px] w-[38px] [&_.text-optical-centre]:hidden">
      <ProgressView
        element={shape({
          shape: 'progress-bar',
          width: 38,
          height: 9,
          progress: 65,
          progressAnim: anim ?? undefined,
          progressAnimSpeed: 'normal',
        })}
        accent={ACCENT}
        track="#e0f2fe"
        textColor="transparent"
      />
    </span>
  );
}

/** Three of five stars, drawn at canvas size and scaled down so the stars stay crisp. */
export function RatingAnimPreview({ anim }: { anim: RatingAnim | null }) {
  return (
    <span className="relative block h-[16px] w-[44px]">
      <span className="absolute left-0 top-0 block h-[40px] w-[110px] origin-top-left scale-[0.4]">
        <RatingView
          element={shape({
            shape: 'rating',
            width: 110,
            height: 40,
            rating: 3,
            ratingAnim: anim ?? undefined,
            ratingAnimSpeed: 'normal',
          })}
          accent="#f59e0b"
        />
      </span>
    </span>
  );
}

/** A small pie, no legend. */
export function PieAnimPreview({ anim }: { anim: PieAnim | null }) {
  return (
    <span className="relative block h-[28px] w-[28px]">
      <PieChartView
        element={shape({
          shape: 'pie-chart',
          width: 28,
          height: 28,
          chartLegend: false,
          pieAnim: anim ?? undefined,
          pieAnimSpeed: 'normal',
        })}
        textColor="currentColor"
      />
    </span>
  );
}
