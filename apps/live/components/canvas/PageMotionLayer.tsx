'use client';

// A slide's animated background (docs/specs/007-editor/illustrate-pages.md "Animated
// backgrounds"): the moving parts drawn over the page's gradient and under everything on it, on
// screen and while presenting. The parts are lib/page-motion-parts.ts's (the export draws the same
// ones, still); its keyframes are app/motion-page.css.
//
// Kept cheap and calm: every part moves by transform and opacity alone (the compositor's work, no
// repaint per frame) and soft edges are radial gradients rather than blur filters. Reduced motion
// stops every part where it rests, a still frame that is itself a finished background.
import type { CSSProperties, ReactNode } from 'react';
import type { PageMotion } from '@livediagram/document';
import { motionPaint } from '@/lib/page-motion';
import {
  motionParts,
  wavePath,
  type MotionAnim,
  type MotionBox,
  type MotionFill,
  type MotionGrid,
  type MotionNode,
  type MotionWave,
} from '@/lib/page-motion-parts';

type Vars = CSSProperties & Record<`--${string}`, string | number>;

export function PageMotionLayer({
  motion,
  fill,
  width,
  height,
}: {
  motion: PageMotion;
  fill: { from: string; to: string; speed?: number };
  // The sheet's size in its own px.
  width: number;
  height: number;
}) {
  const paint = motionPaint(fill);
  return (
    <div
      aria-hidden
      data-page-motion={motion}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ opacity: paint.strength, '--pm-rate': fill.speed ?? 1 } as Vars}
    >
      {renderNodes(motionParts(motion, { w: width, h: height }, paint))}
    </div>
  );
}

function renderNodes(nodes: readonly MotionNode[]): ReactNode {
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'box':
        return <Box key={i} part={node} />;
      case 'wave':
        return <Wave key={i} part={node} />;
      case 'grid':
        return <Grid key={i} part={node} />;
      case 'group':
        return node.mask ? (
          <div key={i} className="absolute inset-0" style={FROM_BELOW}>
            {renderNodes(node.children)}
          </div>
        ) : (
          <div
            key={i}
            className={`${animClass(node.anim)} absolute inset-0`}
            style={animVars(node.anim)}
          >
            {renderNodes(node.children)}
          </div>
        );
    }
  });
}

// The rays fade out away from the bottom centre.
const FROM_BELOW_MASK = 'radial-gradient(circle at 50% 100%, #000 0%, #000 35%, transparent 95%)';
const FROM_BELOW: CSSProperties = { maskImage: FROM_BELOW_MASK, WebkitMaskImage: FROM_BELOW_MASK };

const animClass = (anim: MotionAnim | undefined) => (anim ? `pm-${anim.name}` : '');

function animVars(anim: MotionAnim | undefined): Vars {
  if (!anim) return {};
  return {
    '--pm-d': `${anim.d}s`,
    ...(anim.dl !== undefined ? { '--pm-dl': `${anim.dl}s` } : {}),
    ...(anim.x !== undefined ? { '--pm-x': `${anim.x}px` } : {}),
    ...(anim.y !== undefined ? { '--pm-y': `${anim.y}px` } : {}),
    ...(anim.rest !== undefined ? { '--pm-rest': anim.rest } : {}),
  };
}

// A colour at an alpha, for gradients: `color-mix` keeps any hex as it is.
const alpha = (c: string, a: number) =>
  `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`;

// A fraction as a percentage, free of float noise (0.55 is 55%, not 55.00000000000001%).
const pct = (f: number) => `${Math.round(f * 1000) / 10}%`;

/** A fill as CSS: its background, or for a ring its border. */
function fillCss(fill: MotionFill): CSSProperties {
  switch (fill.kind) {
    case 'glow':
      return {
        background: `radial-gradient(closest-side, ${alpha(fill.color, fill.a)} 0%, ${alpha(fill.color, fill.a * 0.45)} 45%, transparent 100%)`,
      };
    case 'fade':
      return {
        background: `radial-gradient(closest-side, ${alpha(fill.color, fill.a)}, transparent)`,
      };
    case 'solid':
      return { background: fill.a === undefined ? fill.color : alpha(fill.color, fill.a) };
    case 'bokeh':
      return {
        background: `radial-gradient(circle, ${alpha(fill.color, 0.32)} 0%, ${alpha(fill.color, 0.22)} 55%, transparent 70%)`,
      };
    case 'lines':
      return {
        backgroundImage: `repeating-linear-gradient(135deg, transparent 0 ${fill.gap - 2}px, ${alpha(fill.color, fill.a)} ${fill.gap - 2}px ${fill.gap}px)`,
      };
    case 'beam':
      return {
        background: `linear-gradient(90deg, transparent, ${alpha(fill.color, fill.a)}, transparent)`,
      };
    case 'mesh':
      return {
        background: fill.spots
          .map(
            (s) =>
              `radial-gradient(circle at ${pct(s.x)} ${pct(s.y)}, ${alpha(s.color, s.a)}, transparent ${pct(s.reach)})`,
          )
          .join(', '),
      };
    case 'rays':
      return {
        background: `repeating-conic-gradient(from 0deg, ${alpha(fill.color, fill.a)} 0deg 5deg, transparent 5deg 12deg)`,
      };
    case 'ring':
      return { border: `${fill.width}px solid ${alpha(fill.color, fill.a)}` };
  }
}

function Box({ part }: { part: MotionBox }) {
  const halo = part.halo
    ? `0 0 ${part.halo.blur}px ${part.halo.spread ? `${part.halo.spread}px ` : ''}${alpha(part.halo.color, part.halo.a)}`
    : undefined;
  return (
    <div
      className={`absolute ${animClass(part.anim)}`}
      style={{
        left: part.left,
        top: part.top,
        width: part.width,
        height: part.height,
        ...(part.round ? { borderRadius: '50%' } : {}),
        ...fillCss(part.fill),
        ...(halo ? { boxShadow: halo } : {}),
        ...animVars(part.anim),
      }}
    />
  );
}

function Wave({ part }: { part: MotionWave }) {
  const { w, h } = part;
  return (
    <svg
      className={`absolute left-0 top-0 ${animClass(part.anim)}`}
      width={w * 2}
      height={h}
      viewBox={`0 0 ${w * 2} ${h}`}
      style={animVars(part.anim)}
    >
      <path
        d={wavePath(w, h, part.amp, part.base, part.periods)}
        fill={alpha(part.color, part.a)}
      />
    </svg>
  );
}

// The floor: a grid tilted back in perspective below a horizon at 55% of the slide, fading into
// the page toward the horizon whatever its colour there.
const GRID_HORIZON_MASK = 'linear-gradient(transparent, #000 45%)';

function Grid({ part }: { part: MotionGrid }) {
  const { w, h, cell, line } = part;
  const ink = alpha(part.color, part.a);
  return (
    <div
      className="absolute left-0 overflow-hidden"
      style={{
        top: h * 0.55,
        width: w,
        height: h * 0.45,
        perspective: h * 0.6,
        maskImage: GRID_HORIZON_MASK,
        WebkitMaskImage: GRID_HORIZON_MASK,
      }}
    >
      <div
        className="absolute"
        style={{
          left: -w,
          top: 0,
          width: w * 3,
          height: h * 1.6,
          transform: 'rotateX(62deg)',
          transformOrigin: '50% 0',
        }}
      >
        <div
          className={`${animClass(part.anim)} absolute inset-0`}
          style={{
            top: -cell,
            backgroundImage: `linear-gradient(${ink} ${line}px, transparent ${line}px), linear-gradient(90deg, ${ink} ${line}px, transparent ${line}px)`,
            backgroundSize: `${cell}px ${cell}px`,
            ...animVars(part.anim),
          }}
        />
      </div>
    </div>
  );
}
