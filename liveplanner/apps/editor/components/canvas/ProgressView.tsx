// Progress elements (docs/specs/009-elements/progress.md): a horizontal bar + a donut ring that display a
// 0–100 percentage. Rendered by BoxedElementView for shape ===
// 'progress-bar' / 'progress-ring'. The fill (and ring arc) take the element's
// accent colour; the track takes its fill colour. `progressAnim` drives a
// looping `lvd-prog-*` animation on the fill: fill (grow), pulse (opacity), or
// stripes (a barber-pole / marching pattern). Deterministic + reduced-motion-
// safe like every other element animation (the resting frame is the static
// fill), so it freezes cleanly on export.

import { useId } from 'react';

import {
  animLoops,
  clampPercent,
  PROGRESS_LOOPING_ANIMS,
  progressLabelInks,
  type ProgressLabelInks,
  type ShapeElement,
} from '@liveplanner/project';
import { animSpeedVars } from '@/lib/icons';

// The speed + iteration custom properties the `lvd-prog-*` keyframes read.
// `fill` defaults to playing once and holding; `pulse` / `stripes` default to
// looping. The per-element `progressAnimRepeat` toggle overrides.
function progressAnimStyle(el: ShapeElement): React.CSSProperties | undefined {
  const anim = el.progressAnim;
  if (!anim) return undefined;
  const loops = animLoops(anim, el.progressAnimRepeat, PROGRESS_LOOPING_ANIMS);
  return animSpeedVars('prog', el.progressAnimSpeed, loops);
}

// Map a progress animation to its fill class. The bar fill and the ring arc
// use different keyframes for "fill" / "stripes" (a div transform / background
// vs an SVG stroke), so each renderer picks its own.
function barFillClass(anim: ShapeElement['progressAnim']): string | undefined {
  if (anim === 'fill') return 'lvd-prog-grow';
  if (anim === 'pulse') return 'lvd-prog-pulse';
  if (anim === 'stripes') return 'lvd-prog-stripes';
  return undefined;
}

export function ProgressView({
  element,
  accent,
  track,
  textColor,
}: {
  element: ShapeElement;
  // The filled portion / ring arc colour (the element's stroke accent).
  accent: string;
  // The empty track colour (the element's fill).
  track: string;
  // The centred percentage label colour.
  textColor: string;
}) {
  const pct = clampPercent(element.progress ?? 50);
  const anim = element.progressAnim;
  const animStyle = progressAnimStyle(element);

  const labelLayer: LabelLayer = (colour, clip, className, hidden) => (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center ${className ?? ''}`}
      style={{ color: colour, ...clip }}
      aria-hidden={hidden || undefined}
    >
      {/* Centred on its cap band, as the export draws it (optical-alignment.md). */}
      <span className="text-optical-centre text-sm font-semibold tabular-nums">{pct}%</span>
    </div>
  );

  if (element.shape === 'progress-bar') {
    return (
      <>
        <div
          // Track and fill are a shape each under Marker and Sketch (docs/specs/008-canvas/finish.md "Faces").
          data-marker-shape=""
          className="absolute inset-0 overflow-hidden rounded-full"
          style={{ backgroundColor: track }}
        >
          <div
            data-marker-shape=""
            className={`relative h-full rounded-full ${barFillClass(anim) ?? ''}`}
            style={{ width: `${pct}%`, backgroundColor: accent, ...animStyle }}
          />
        </div>
        <BarLabel
          pct={pct}
          inks={progressLabelInks(textColor, accent, track)}
          grows={anim === 'fill'}
          animStyle={animStyle}
          layer={labelLayer}
        />
      </>
    );
  }

  const label = labelLayer(textColor);

  return (
    <ProgressRing
      pct={pct}
      anim={anim}
      accent={accent}
      track={track}
      labelNode={label}
      animStyle={animStyle}
    />
  );
}

// One percentage label layer: its ink, an optional clip (plus the animation's custom properties), an
// optional animation class, and whether assistive tech skips it (the second copy of a split label).
type LabelLayer = (
  colour: string,
  clip?: React.CSSProperties,
  className?: string,
  hidden?: boolean,
) => React.ReactNode;

// The bar's percentage, inked per part (docs/specs/009-elements/progress.md "The percentage stays
// legible"): one label when the filled portion and the track want the same ink, else two, each
// clipped to its part. Under the Fill animation the clips grow with the fill (the lvd-prog-ink-*
// keyframes run from an empty / full clip to the resting inline one, on the fill's timing), so the
// ink split follows the edge as it moves. The track copy is the one screen readers hear.
function BarLabel({
  pct,
  inks,
  grows,
  animStyle,
  layer,
}: {
  pct: number;
  inks: ProgressLabelInks;
  grows: boolean;
  animStyle?: React.CSSProperties;
  layer: LabelLayer;
}) {
  if (inks.onFill === inks.onTrack || pct <= 0 || pct >= 100) {
    return layer(pct > 0 ? inks.onFill : inks.onTrack);
  }
  return (
    <>
      {layer(
        inks.onTrack,
        { clipPath: `inset(0 0 0 ${pct}%)`, ...animStyle },
        grows ? 'lvd-prog-ink-track' : undefined,
      )}
      {layer(
        inks.onFill,
        { clipPath: `inset(0 ${100 - pct}% 0 0)`, ...animStyle },
        grows ? 'lvd-prog-ink-fill' : undefined,
        true,
      )}
    </>
  );
}

// Donut ring: a track circle + a progress arc. pathLength is normalised to 100
// so the dash maths is just the percentage. The arc starts at 12 o'clock
// (rotate -90) and sweeps clockwise. For "stripes" the arc is a full marching-
// dashed circle masked down to the progress sweep, so the stripes march along
// the true arc rather than dragging the whole arc around the ring.
function ProgressRing({
  pct,
  anim,
  accent,
  track,
  labelNode,
  animStyle,
}: {
  pct: number;
  anim: ShapeElement['progressAnim'];
  accent: string;
  track: string;
  labelNode: React.ReactNode;
  // Speed / iteration custom properties for the ring's animation class.
  animStyle?: React.CSSProperties;
}) {
  const maskId = `lvd-prog-mask-${useId().replace(/:/g, '')}`;
  const STROKE = 13;
  const R = 50 - STROKE / 2 - 1;
  const arcCommon = {
    cx: 50,
    cy: 50,
    r: R,
    fill: 'none' as const,
    stroke: accent,
    strokeWidth: STROKE,
    strokeLinecap: 'round' as const,
    pathLength: 100,
  };
  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <circle cx={50} cy={50} r={R} fill="none" stroke={track} strokeWidth={STROKE} />
        {anim === 'stripes' ? (
          <>
            <defs>
              <mask id={maskId}>
                <circle
                  {...arcCommon}
                  stroke="#fff"
                  strokeDasharray={`${pct} 100`}
                  transform="rotate(-90 50 50)"
                />
              </mask>
            </defs>
            <circle
              {...arcCommon}
              className="lvd-prog-ring-stripes"
              strokeLinecap="butt"
              strokeDasharray="4 3"
              mask={`url(#${maskId})`}
              style={animStyle}
            />
          </>
        ) : (
          <circle
            {...arcCommon}
            className={
              anim === 'fill'
                ? 'lvd-prog-ring-grow'
                : anim === 'pulse'
                  ? 'lvd-prog-pulse'
                  : undefined
            }
            strokeDasharray={`${pct} 100`}
            transform="rotate(-90 50 50)"
            style={{ '--lvd-progress': pct, ...animStyle } as React.CSSProperties}
          />
        )}
      </svg>
      {labelNode}
    </>
  );
}
