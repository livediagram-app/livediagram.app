import { useId, type CSSProperties, type ReactNode, type SVGAttributes } from 'react';
import {
  catmullRomToBezierPath,
  freehandCanvasPoints,
  isPenStroke,
  pathElementD,
  type FreehandElement,
  type PathElement,
} from '@livediagram/document';
import { bodySetClass } from '@/lib/animation-classes';

// The Drawing animation set (docs/specs/028-animation/element-animations.md "Drawing") for freehand
// strokes and paths. Three kinds of line are drawn three ways: a whiteboard pen stroke is a FILLED
// outline in canvas coordinates; any other freehand stroke is a stroked line in a 100-unit view box
// with a non-scaling stroke; a path is a stroked line in its own px box. So every effect works
// from the stroke's CENTRE LINE, in two spaces:
//
// - in the drawing's own svg, a mask (Draw, and Dash on pen ink) or a filter (Boil) on the main
//   line, passed back as `mainProps` for the renderer to spread onto it;
// - in an overlay svg in the box's px space (`overlay`), the lights that run along the line
//   (Trace, Shimmer), where pathLength 1 maps evenly onto the line.
//
// Nothing animates at rest: masks reveal the whole line, overlays are invisible and the keyframes
// carry any dash or filter, so reduced motion, export and a finished play-once show the plain line.

type Drawing = FreehandElement | PathElement;

export type DrawingAnimationParts = {
  // Spread onto the drawing's main <path> (class, mask, filter, style variables).
  mainProps: SVGAttributes<SVGPathElement> & { style?: CSSProperties };
  // Defs for the drawing's own svg (a mask or filters).
  defs: ReactNode;
  // An absolutely placed svg over the box, for the lights that run along the line.
  overlay: ReactNode;
};

const NONE: DrawingAnimationParts = { mainProps: {}, defs: null, overlay: null };

// The box-space (px) centre line of a freehand stroke, and of a path.
function centreLinePx(el: Drawing): string {
  if (el.type === 'path') return pathElementD(el, { x: 0, y: 0 });
  const pts = freehandCanvasPoints({ ...el, x: 0, y: 0 });
  if (pts.length < 2) return '';
  return el.straightEdges
    ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (el.closed ? ' Z' : '')
    : catmullRomToBezierPath(pts, el.closed);
}

/**
 * The parts a drawing mounts for its Drawing animation. `mainLine` is the centre line in the main
 * svg's own units and `strokePx` the line's width on screen.
 */
export function useDrawingAnimation(
  el: Drawing,
  // The centre line, or a function computing it: a pen stroke's is built from all its points,
  // so it is only built when the stroke has a Drawing animation.
  centreLine: string | (() => string),
  strokePx: number,
  ink: string,
): DrawingAnimationParts {
  const id = `lvd-draw-${useId().replace(/:/g, '')}`;
  const cls = bodySetClass(el);
  const value = el.animation;
  if (!cls) return NONE;
  const mainLine = typeof centreLine === 'function' ? centreLine() : centreLine;
  if (!mainLine) return NONE;
  const pen = el.type === 'freehand' && isPenStroke(el);
  const once = cls.includes('lvd-once') ? ' lvd-once' : '';
  // A pen stroke is filled ink: the effects that work on a line's stroke draw on its outline.
  const mainClass = pen ? `${cls} lvd-draw-pen` : cls;
  const w = Math.max(el.width, 1);
  const h = Math.max(el.height, 1);
  // The main svg's units per px: a pen stroke and a path draw in px; another freehand stroke in a
  // 100-unit box stretched over the element, so a width in its units must cover the narrower axis.
  const unitsPerPx = el.type === 'freehand' && !pen ? 100 / Math.min(w, h) : 1;
  const band = (strokePx * 1.6 + 6) * unitsPerPx;
  // The drawing's box in its main svg's units, grown by a margin: the region a mask or filter
  // covers. Tight, so the browser never rasterises more than the drawing needs.
  const margin = (strokePx * 2 + 12) * unitsPerPx;
  const box =
    el.type === 'freehand' && !pen
      ? { x: 0, y: 0, width: 100, height: 100 }
      : pen
        ? { x: el.x, y: el.y, width: w, height: h }
        : { x: 0, y: 0, width: w, height: h };
  const region = {
    x: box.x - margin,
    y: box.y - margin,
    width: box.width + margin * 2,
    height: box.height + margin * 2,
  };
  const style = {
    '--lvd-sw': strokePx,
    '--lvd-dash': Math.max(6, strokePx * 1.6),
    '--lvd-ink': ink,
  } as CSSProperties;

  if (value === 'draw' || (value === 'dash' && pen)) {
    // A wide band along the centre line reveals the ink under it; a full rect joins it once the
    // line is drawn, so a closed shape's fill shows too.
    const kind = value === 'draw' ? 'lvd-draw-reveal' : 'lvd-draw-dashmask';
    return {
      mainProps: { className: mainClass, mask: `url(#${id})`, style },
      defs: (
        <defs className={`lvd-draw-${value}`}>
          <mask id={id} maskUnits="userSpaceOnUse" {...region}>
            <path
              d={mainLine}
              className={`${kind}${once}`}
              fill="none"
              stroke="white"
              strokeWidth={band}
              strokeLinecap="butt"
              strokeLinejoin="round"
              pathLength={value === 'draw' ? 1 : undefined}
              style={style}
            />
            {value === 'draw' ? (
              <rect className={`lvd-draw-fill${once}`} {...region} fill="white" />
            ) : null}
          </mask>
        </defs>
      ),
      overlay: null,
    };
  }

  if (value === 'boil') {
    // Three frames of hand-drawn jitter, stepped through by the keyframes (motion-drawing.css): a
    // smooth, low-frequency wobble a few px wide, so the line wavers rather than breaking up.
    const scale = Math.max(3, Math.min(6, strokePx * 0.8)) * unitsPerPx;
    const frames = [0, 1, 2].map((i) => `${id}-${i}`);
    return {
      mainProps: {
        className: mainClass,
        style: {
          ...style,
          ['--lvd-boil-0' as string]: `url(#${frames[0]})`,
          ['--lvd-boil-1' as string]: `url(#${frames[1]})`,
          ['--lvd-boil-2' as string]: `url(#${frames[2]})`,
        },
      },
      defs: (
        <defs>
          {frames.map((fid, i) => (
            // The drawing's box plus a margin, not the line's own bounding box: a near-flat
            // stroke's box is a few px tall, which would clip its own wobble.
            <filter key={fid} id={fid} filterUnits="userSpaceOnUse" {...region}>
              <feTurbulence
                type="fractalNoise"
                baseFrequency={0.018 / unitsPerPx}
                numOctaves={1}
                seed={i + 1}
              />
              <feDisplacementMap in="SourceGraphic" scale={scale} />
            </filter>
          ))}
        </defs>
      ),
      overlay: null,
    };
  }

  if (value === 'trace' || value === 'shimmer') {
    const line = centreLinePx(el);
    const head = Math.max(2, strokePx * 0.7);
    return {
      mainProps: { className: mainClass, style },
      defs: null,
      overlay: line ? (
        <svg
          className={`pointer-events-none absolute inset-0 h-full w-full overflow-visible lvd-draw-${value}`}
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          {value === 'trace' ? (
            <path
              className="lvd-draw-run lvd-draw-tail"
              d={line}
              pathLength={1}
              fill="none"
              strokeWidth={head * 2.2}
              strokeLinecap="round"
            />
          ) : null}
          <path
            className="lvd-draw-run lvd-draw-head"
            d={line}
            pathLength={1}
            fill="none"
            strokeWidth={head}
            strokeLinecap="round"
          />
        </svg>
      ) : null,
    };
  }

  // Ink and Glow work on the line itself; Dash on a stroked line marches its own dashes.
  return {
    mainProps: { className: mainClass, style },
    defs: null,
    overlay: null,
  };
}
