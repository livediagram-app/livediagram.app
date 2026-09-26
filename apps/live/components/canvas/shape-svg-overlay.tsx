import {
  SHAPE_DETAIL_STROKE_PX,
  SHAPE_KINDS,
  isCollabPanelShape,
  isWebComponentShape,
  shapeGeometry,
  type ShapeKind,
  type ShapePart,
  type ShapePartRole,
} from '@livediagram/diagram';
import type { SVGAttributes } from 'react';
import { useShapeSvgAnimation, type ShapeSvgAnimation } from './useShapeSvgAnimation';

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
  // A page (docs/specs/009-elements/page-element.md) is a plain rectangle with a fill and a border, so it
  // belongs on the CSS box path with square — the SVG overlay has no case for
  // it and would draw an invisible element.
  // A mode button (docs/specs/009-elements/mode-button.md) and a portal (docs/specs/009-elements/portal-element.md) are likewise plain filled
  // rounded boxes with their own content drawn on top, so they belong on the CSS
  // box path too. Left on the SVG path they rendered as a TRANSPARENT box — the
  // overlay has no case for either kind, so nothing drew the fill at all.
  return (
    kind !== 'square' &&
    kind !== 'circle' &&
    kind !== 'stadium' &&
    kind !== 'browser' &&
    kind !== 'page' &&
    kind !== 'mode-button' &&
    // Bring Focus (docs/specs/012-collaboration/bring-focus.md) is a filled rounded box with a glyph + label on
    // top, same as the mode button beside it. This predicate is allow-BY-
    // DEFAULT, so a new CSS-drawn kind left off it renders as a transparent
    // nothing.
    kind !== 'focus-button' &&
    kind !== 'portal' &&
    kind !== 'session-button' &&
    kind !== 'reveal' &&
    kind !== 'picker' &&
    // A reaction pad (docs/specs/009-elements/reaction-pad.md) is a filled rounded box with a glyph on top.
    kind !== 'reaction-pad' &&
    // A comment pin (docs/specs/012-collaboration/comment-pin.md) draws its own bubble; the wrapper box behind it
    // must not also paint a square.
    kind !== 'comment-pin' &&
    // An action panel (docs/specs/012-collaboration/action-panel.md) is the same card, for an assigned action.
    kind !== 'action-card' &&
    // A mind node (docs/specs/009-elements/mind-node.md) is a rounded filled box with a label, same as
    // the four above. This predicate is allow-BY-DEFAULT, so a new CSS-drawn
    // kind that isn't listed here renders as a transparent nothing.
    kind !== 'mind-node' &&
    // A lane (docs/specs/009-elements/lane.md) is a filled band with a gutter drawn on top — CSS box
    // path, same as the rest of this list.
    kind !== 'lane' &&
    // A record (docs/specs/009-elements/entity.md) is a filled box with rows drawn on top.
    kind !== 'entity' &&
    // The collaboration elements (docs/specs/012-collaboration/estimate-card.md to docs/specs/012-collaboration/roll-call.md) are filled rounded
    // cards with their own face drawn on top — the CSS box path, like every
    // kind above. Left off this list they rendered as a transparent nothing,
    // exactly as the mind-node comment above warns.
    !isCollabPanelShape(kind) &&
    // The web components (docs/specs/009-elements/web-components-and-no-groups.md): a callout is a bordered card with its
    // content on top, and the rest paint their own surfaces (they are
    // self-painting, so the box path gives them a bare wrapper).
    !isWebComponentShape(kind) &&
    // A chair (docs/specs/009-elements/chair.md) draws its own furniture and wants no box behind it.
    kind !== 'chair'
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
  // Looping animation (docs/specs/008-canvas/canvas-and-palette.md) that has to render against the true SVG
  // geometry rather than the wrapper: 'trace' marches the shape's own outline
  // (a light running the perimeter), 'gradient' fills it with a moving gradient
  // between the element's fill + accent, and 'pulse' / 'glow' radiate a
  // drop-shadow off the shape's real silhouette (the wrapper's box-shadow
  // version would draw a rectangle around a diamond / hexagon / etc.). Speed /
  // accent / fill come from the wrapper's inherited --lvd-anim-* custom
  // properties. Other animations (blink / bounce / wobble) are shape-agnostic
  // and stay on the wrapper. Undefined for the draw-preview and unanimated
  // elements.
  animation?: ShapeSvgAnimation;
}) {
  // Gradient / trace / pulse-glow plumbing (docs/specs/008-canvas/canvas-and-palette.md) — see
  // useShapeSvgAnimation.
  const { effectiveFill, traceOutline, svgClassName, gradientDefs } = useShapeSvgAnimation(
    animation,
    fill,
  );
  // The geometry lives in the shared table (@livediagram/diagram
  // shape-geometry.ts), the same data the headless export draws from, so
  // the canvas and an exported image can't disagree about a silhouette.
  // Browser is NOT in it: it is a CSS-rendered rounded rectangle (see
  // isSvgRenderedShape) with the HTML BrowserChrome strip on top.
  const geometry = shapeGeometry(shape, aspect);
  // Each part's paint by its role. The user's dash rides every outline;
  // the thin detail chrome (bezels, keys, creases) keeps its own solid
  // stroke, which reads correctly: a dotted phone still has a solid screen
  // edge. When tracing, outlines turn into a marching dash (traceOutline
  // overrides the user's dash + adds the animating class) so the light runs
  // the true perimeter; stroke-dashoffset can't be animated via a class on a
  // parent <g> (the `animation` property doesn't inherit), so it rides each
  // stroked part.
  const dash = traceOutline ? traceOutline.strokeDasharray : strokeDasharray;
  const traced = traceOutline
    ? { strokeLinecap: traceOutline.strokeLinecap, className: traceOutline.className }
    : {};
  const paint: Record<ShapePartRole, SVGAttributes<SVGElement>> = {
    main: {
      fill: effectiveFill,
      stroke,
      strokeWidth,
      strokeDasharray: dash,
      vectorEffect: 'non-scaling-stroke',
      strokeLinejoin: 'round',
      ...traced,
    },
    outline: {
      fill: effectiveFill,
      stroke,
      strokeWidth,
      strokeDasharray: dash,
      vectorEffect: 'non-scaling-stroke',
      ...traced,
    },
    detail: {
      fill: 'none',
      stroke,
      strokeWidth: SHAPE_DETAIL_STROKE_PX,
      vectorEffect: 'non-scaling-stroke',
      strokeLinejoin: 'round',
    },
    limb: {
      fill: 'none',
      stroke,
      strokeWidth,
      strokeDasharray: dash,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      vectorEffect: 'non-scaling-stroke',
      ...(traceOutline ? { className: traceOutline.className } : {}),
    },
    head: {},
  };
  paint.head = { ...paint.limb, fill: effectiveFill };
  return (
    <svg
      className={svgClassName}
      viewBox={geometry?.viewBox ?? '0 0 100 100'}
      preserveAspectRatio={geometry?.preserveAspectRatio ?? 'none'}
      aria-hidden
    >
      {gradientDefs}
      {geometry?.parts.map((part, i) => (
        <ShapePartSvg key={i} part={part} paint={paint[part.role]} />
      ))}
    </svg>
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
