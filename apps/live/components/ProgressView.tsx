// Progress elements (spec/46): a horizontal bar + a donut ring that display a
// 0–100 percentage. Rendered by BoxedElementView for shape ===
// 'progress-bar' / 'progress-ring'. The fill (and ring arc) take the element's
// accent colour; the track takes its fill colour. `progressAnim` drives a
// looping `lvd-prog-*` animation on the fill: fill (grow), pulse (opacity), or
// stripes (a barber-pole / marching pattern). Deterministic + reduced-motion-
// safe like every other element animation (the resting frame is the static
// fill), so it freezes cleanly on export.

import { useId } from 'react';

import { ANIMATION_SPEED_FACTOR, type ShapeElement } from '@livediagram/diagram';

// The speed + iteration custom properties the `lvd-prog-*` keyframes read.
// `fill` defaults to playing once and holding; `pulse` / `stripes` default to
// looping. The per-element `progressAnimRepeat` toggle overrides.
function progressAnimStyle(el: ShapeElement): React.CSSProperties | undefined {
  const anim = el.progressAnim;
  if (!anim) return undefined;
  const loops = el.progressAnimRepeat ?? anim !== 'fill';
  return {
    '--lvd-prog-speed': ANIMATION_SPEED_FACTOR[el.progressAnimSpeed ?? 'normal'],
    '--lvd-prog-iter': loops ? 'infinite' : 1,
  } as React.CSSProperties;
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
  const pct = Math.max(0, Math.min(100, Math.round(element.progress ?? 50)));
  const anim = element.progressAnim;
  const animStyle = progressAnimStyle(element);

  const label = (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      style={{ color: textColor }}
    >
      <span className="text-sm font-semibold tabular-nums">{pct}%</span>
    </div>
  );

  if (element.shape === 'progress-bar') {
    return (
      <>
        <div
          className="absolute inset-0 overflow-hidden rounded-full"
          style={{ backgroundColor: track }}
        >
          <div
            className={`h-full rounded-full ${barFillClass(anim) ?? ''}`}
            style={{ width: `${pct}%`, backgroundColor: accent, ...animStyle }}
          />
        </div>
        {label}
      </>
    );
  }

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
