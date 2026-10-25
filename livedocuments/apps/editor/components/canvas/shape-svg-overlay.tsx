import {
  SHAPE_DETAIL_STROKE_PX,
  SHAPE_KINDS,
  isWebComponentShape,
  shapeGeometry,
  type ShapeKind,
  type ShapePart,
  type ShapePartRole,
} from '@livedocuments/document';
import { useRef, type CSSProperties, type SVGAttributes } from 'react';
import { useTraceDashes } from '@liveworkspace/workbench/components/canvas/useTraceDashes';
import {
  isEdgeRole,
  useShapeSvgAnimation,
  type ShapeSvgAnimation,
  type ShapeSvgEffectLayer,
} from './useShapeSvgAnimation';

// Shape-shape SVG primitives, used by both BoxedElementView (the
// canvas-rendered element) and Canvas (the in-progress draw
// preview). Lifted out of BoxedElementView.tsx (was 1159 lines) so
// the element-view file is scoped to selection / drag / overlay
// composition and these two presentational primitives can be
// imported by anything that needs to paint a shape outline at any
// rect size.

// Shapes that draw themselves via an inner SVG overlay rather than
// relying on the wrapper's border / background. The CSS-rendered
// set are the ones where a border + border-radius produces the
// right geometry at any aspect ratio without distortion:
//   - square: rounded rectangle
//   - circle: border-radius 50% (forced 1:1 so it stays a circle)
//   - stadium: border-radius 9999px, always semicircular ends
//   - browser: rounded rectangle frame (the HTML BrowserChrome strip
//     paints the address bar on top). It MUST be CSS so the corner
//     radius is a real pixel radius: an SVG rect rx in the stretched
//     0..100 viewBox warps into big asymmetric arcs on a wide box,
//     and the user's border-radius control would do nothing.
export function isSvgRenderedShape(kind: ShapeKind): boolean {
  // An unknown / off-vocabulary kind (e.g. a stray "rectangle" from an external
  // source — the ShapeSvgOverlay has no case for it and would draw nothing) is
  // routed to the plain HTML box path instead, so it renders a square box rather
  // than an invisible node. Valid kinds keep their existing routing.
  if (!SHAPE_KINDS.has(kind)) return false;
  // This predicate is allow-BY-DEFAULT, so a new CSS-drawn kind left off it
  // renders as a transparent nothing.
  return (
    kind !== 'square' &&
    kind !== 'circle' &&
    kind !== 'stadium' &&
    kind !== 'browser' &&
    // A pointer note (docs/specs/009-elements/pointer-note.md) is a CSS box, its leader drawn by an overlay.
    kind !== 'pointer-note' &&
    // A stack (docs/specs/009-elements/stack.md) is a CSS box (a dashed outline) behind what it holds.
    kind !== 'stack' &&
    // The web components (docs/specs/009-elements/web-components-and-no-groups.md): a callout is a bordered card with its
    // content on top, and the rest paint their own surfaces (they are
    // self-painting, so the box path gives them a bare wrapper).
    !isWebComponentShape(kind)
  );
}

export function ShapeSvgOverlay({
  shape,
  fill,
  stroke,
  strokeWidth = 2,
  strokeDasharray,
  aspect = 1.6,
  animation,
}: {
  shape: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth?: number;
  // SVG dasharray string when the user picked a dashed / dotted
  // border style; undefined for solid (the default, omits the attr).
  strokeDasharray?: string;
  // Element width / height. The svg uses preserveAspectRatio="none",
  // so a fixed viewBox inset renders unevenly once the box is
  // stretched. The laptop bezel reads this to keep its margin even in
  // screen pixels on all four sides (see laptopGeometry in the table).
  // Defaults to a typical landscape ratio for callers that don't pass it.
  aspect?: number;
  // The Shape set's Pulse, Glow, Trace and Gradient (docs/specs/028-animation/element-animations.md),
  // which must follow the true SVG geometry rather than the wrapper's rectangle: drawn here as
  // copies of the outline (useShapeSvgAnimation). Other motions are shape-agnostic and stay on the
  // wrapper. Undefined for the draw preview and unanimated elements.
  animation?: ShapeSvgAnimation;
}) {
  // Gradient / trace / pulse-glow plumbing (docs/specs/008-canvas/canvas-and-palette.md) — see
  // useShapeSvgAnimation.
  const { effectiveFill, gradientDefs, effect } = useShapeSvgAnimation(animation, fill);
  // The geometry lives in the shared table (@livedocuments/document
  // shape-geometry.ts), the same data the headless export draws from, so
  // the canvas and an exported image can't disagree about a silhouette.
  // Browser is NOT in it: it is a CSS-rendered rounded rectangle (see
  // isSvgRenderedShape) with the HTML BrowserChrome strip on top.
  const geometry = shapeGeometry(shape, aspect);
  // Each part's paint by its role. The user's dash rides every outline; the thin detail chrome
  // (bezels, keys, creases) keeps its own solid stroke, which reads correctly: a dotted phone still
  // has a solid screen edge.
  const dash = strokeDasharray;
  const paint: Record<ShapePartRole, SVGAttributes<SVGElement>> = {
    main: {
      fill: effectiveFill,
      stroke,
      strokeWidth,
      strokeDasharray: dash,
      vectorEffect: 'non-scaling-stroke',
      strokeLinejoin: 'round',
    },
    detail: {
      fill: 'none',
      stroke,
      strokeWidth: SHAPE_DETAIL_STROKE_PX,
      vectorEffect: 'non-scaling-stroke',
      strokeLinejoin: 'round',
    },
  };
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox={geometry?.viewBox ?? '0 0 100 100'}
      preserveAspectRatio={geometry?.preserveAspectRatio ?? 'none'}
      style={geometry?.strokeInside ? strokeInsideBox(strokeWidth) : undefined}
      aria-hidden
    >
      {gradientDefs}
      {effect?.behind ? (
        <EffectCopy parts={geometry?.parts} effect={effect} geometryKey={`${shape}:${aspect}`} />
      ) : null}
      {geometry?.parts.map((part, i) => (
        <ShapePartSvg key={i} part={part} paint={paint[part.role]} />
      ))}
      {effect && !effect.behind ? (
        <EffectCopy parts={geometry?.parts} effect={effect} geometryKey={`${shape}:${aspect}`} />
      ) : null}
    </svg>
  );
}

// The svg box inset by half the stroke, so the outline's outer edge lands on
// the element's edge like a CSS border (the geometry's strokeInside).
function strokeInsideBox(strokeWidth: number): CSSProperties {
  return {
    left: strokeWidth / 2,
    top: strokeWidth / 2,
    width: `calc(100% - ${strokeWidth}px)`,
    height: `calc(100% - ${strokeWidth}px)`,
  };
}

// A copy of the silhouette's edge parts for an animation effect (useShapeSvgAnimation), scaled from
// the view box's centre so a Pulse ring grows evenly.
function EffectCopy({
  parts,
  effect,
  geometryKey,
}: {
  parts: readonly ShapePart[] | undefined;
  effect: ShapeSvgEffectLayer;
  // What the outline is (kind and aspect): Trace re-measures its dashes when it changes.
  geometryKey: string;
}) {
  const edges = (parts ?? []).filter((p) => isEdgeRole(p.role));
  const ref = useRef<SVGGElement>(null);
  useTraceDashes(ref, effect.className === 'lvd-svg-trace', geometryKey);
  return (
    <g
      ref={ref}
      className={effect.className}
      style={{ transformBox: 'view-box', transformOrigin: '50% 50%' }}
    >
      {edges.map((part, i) => (
        <ShapePartSvg key={i} part={part} paint={effect.paint} />
      ))}
      {effect.extra
        ? edges.map((part, i) => <ShapePartSvg key={`x${i}`} part={part} paint={effect.extra!} />)
        : null}
    </g>
  );
}

// One table part as its SVG element.
function ShapePartSvg({ part, paint }: { part: ShapePart; paint: SVGAttributes<SVGElement> }) {
  switch (part.tag) {
    case 'path':
      return <path d={part.d} {...paint} />;
    case 'polygon':
      return <polygon points={part.points} {...paint} />;
    case 'rect':
      return (
        <rect
          x={part.x}
          y={part.y}
          width={part.width}
          height={part.height}
          rx={part.rx}
          {...paint}
        />
      );
    case 'ellipse':
      return <ellipse cx={part.cx} cy={part.cy} rx={part.rx} ry={part.ry} {...paint} />;
    case 'circle':
      return <circle cx={part.cx} cy={part.cy} r={part.r} {...paint} />;
  }
}
