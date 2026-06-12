import type { ShapeKind } from '@livediagram/diagram';

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
  return kind !== 'square' && kind !== 'circle' && kind !== 'stadium' && kind !== 'browser';
}

export function ShapeSvgOverlay({
  shape,
  fill,
  stroke,
  strokeWidth = 2,
  strokeDasharray,
  aspect = 1.6,
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
  // screen pixels on all four sides (see LaptopGlyph). Defaults to a
  // typical landscape ratio for callers that don't pass it.
  aspect?: number;
}) {
  if (shape === 'actor') {
    // UML actor: an open circle head (the fill colour tints it) over a
    // line body, arms and legs. The viewBox is taller than wide and
    // leaves a small clear band below the legs (y 112..130) for the
    // label: the original 0..150 height left a 38-unit empty band
    // that read as wasted padding under bare stickmen. `meet` keeps
    // the figure proportional and centred at any size.
    return (
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 90 130"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <g
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        >
          <circle cx={45} cy={22} r={16} fill={fill} />
          <path d="M 45 38 L 45 82" />
          <path d="M 16 56 L 74 56" />
          <path d="M 45 82 L 22 112" />
          <path d="M 45 82 L 68 112" />
        </g>
      </svg>
    );
  }
  const common = {
    fill,
    stroke,
    strokeWidth,
    // strokeDasharray propagates so the user's dashed / dotted
    // pick affects the main outline path of every SVG-rendered
    // shape (diamond / cylinder / hexagon / device frames...).
    // The chrome details inside the device frames (the URL pill,
    // window dots, etc.) keep their own stroke setup and stay
    // solid, which reads correctly: a dotted browser frame still
    // has a solid URL bar inside it.
    strokeDasharray,
    vectorEffect: 'non-scaling-stroke' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {shape === 'diamond' ? <polygon points="50,0 100,50 50,100 0,50" {...common} /> : null}
      {shape === 'parallelogram' ? <polygon points="20,0 100,0 80,100 0,100" {...common} /> : null}
      {shape === 'hexagon' ? (
        <polygon points="25,0 75,0 100,50 75,100 25,100 0,50" {...common} />
      ) : null}
      {shape === 'document' ? (
        <path
          d="M 0 0 L 100 0 L 100 92 C 80 109, 65 79, 50 94 C 35 109, 20 79, 0 94 Z"
          {...common}
        />
      ) : null}
      {shape === 'cylinder' ? (
        <g>
          <path d="M 0 15 L 100 15 L 100 85 A 50 12 0 0 1 0 85 Z" {...common} />
          <ellipse cx={50} cy={15} rx={50} ry={12} {...common} />
        </g>
      ) : null}
      {shape === 'cloud' ? (
        // Path normalised to fill the full 0..100 viewBox (the earlier
        // geometry sat in x 12.7..90 / y 24.5..80, leaving dead margin
        // on every side that made the cloud impossible to line up
        // against neighbouring shapes). Control points fall outside the
        // box by design — the curve itself reaches the edges.
        <path
          d="M 22.4 100 C 1.7 100, -7.3 71.2, 6.9 55 C -2.2 31.5, 17.2 11.7, 31.4 24.3 C 36.6 -6.3, 70.2 -9.9, 74.1 24.3 C 92.1 11.7, 107.6 38.8, 93.4 58.6 C 107.6 73, 97.3 100, 76.6 100 Z"
          {...common}
        />
      ) : null}
      {shape === 'triangle' ? <polygon points="50,2 98,98 2,98" {...common} /> : null}
      {shape === 'trapezoid' ? <polygon points="22,4 78,4 98,96 2,96" {...common} /> : null}
      {shape === 'star' ? (
        <polygon points="50,2 61,35 96,35 68,56 78,89 50,69 22,89 32,56 4,35 39,35" {...common} />
      ) : null}
      {shape === 'speech-bubble' ? (
        // The rounded body fills the WHOLE box (0..100) so the label —
        // centred in the element box by default — lands dead-centre in the
        // bubble. The tail hangs just BELOW the box (y > 100), which the
        // overlay's overflow-visible lets through; keeping it out of the
        // box is what frees the body to be vertically centred. Previously
        // the body only filled the top ~66% (tail inside), which pushed
        // the centred label low against the tail.
        <path
          d="M 8 0 L 92 0 A 8 8 0 0 1 100 8 L 100 92 A 8 8 0 0 1 92 100 L 44 100 L 26 120 L 34 100 L 8 100 A 8 8 0 0 1 0 92 L 0 8 A 8 8 0 0 1 8 0 Z"
          {...common}
        />
      ) : null}
      {shape === 'frame' ? (
        // Section container: outline ONLY (no fill, so the elements drawn
        // inside show through) with the label in the top-left corner.
        // Sharp corners avoid the stretched-rx warp the browser frame note
        // describes below.
        <rect
          x={1}
          y={1}
          width={98}
          height={98}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {/* Browser is NOT drawn here: it is a CSS-rendered rounded
          rectangle (see isSvgRenderedShape) so its corner radius is a
          real pixel radius and the border-radius control applies. The
          HTML BrowserChrome strip paints the address bar on top. */}
      {/* Monitor: screen rect on top, trapezoid stand on the bottom. */}
      {shape === 'monitor' ? (
        <g>
          <rect x={1} y={1} width={98} height={80} rx={3} {...common} />
          <path d="M 32 88 L 68 88 L 76 99 L 24 99 Z" {...common} />
        </g>
      ) : null}
      {/* Laptop: an open clamshell — see LaptopGlyph. Rendered via a
          helper because the keyboard is a generated key grid and the
          bezel inset is aspect-aware, which is more than a couple of
          inline elements. */}
      {shape === 'laptop' ? (
        <LaptopGlyph
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          aspect={aspect}
        />
      ) : null}
      {/* Phone: tall pill silhouette. Heavily rounded corners are the
          single most recognisable tell of "phone" at this scale; an
          inset screen line gives the front-face bezel. */}
      {shape === 'phone' ? (
        <g>
          <rect x={2} y={2} width={96} height={96} rx={10} {...common} />
          <rect
            x={6}
            y={10}
            width={88}
            height={80}
            rx={3}
            fill="none"
            stroke={stroke}
            strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ) : null}
      {/* Tablet: same skeleton as phone but with a thinner bezel and
          less-aggressive corner radius, so they read as different
          devices at a glance. */}
      {shape === 'tablet' ? (
        <g>
          <rect x={2} y={2} width={96} height={96} rx={6} {...common} />
          <rect
            x={5}
            y={6}
            width={90}
            height={88}
            rx={3}
            fill="none"
            stroke={stroke}
            strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ) : null}
      {/* Smartwatch: a rounded square face with a strap above + below and
          a crown button on the right edge, plus an inset screen bezel. */}
      {shape === 'smartwatch' ? (
        <g>
          <rect x={36} y={0} width={28} height={20} {...common} />
          <rect x={36} y={80} width={28} height={20} {...common} />
          <rect x={76} y={43} width={7} height={14} rx={2} {...common} />
          <rect x={22} y={14} width={56} height={72} rx={14} {...common} />
          <rect
            x={29}
            y={21}
            width={42}
            height={58}
            rx={9}
            fill="none"
            stroke={stroke}
            strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ) : null}
    </svg>
  );
}

// Open-clamshell laptop: a lid with an even display bezel, a slim
// hinge no wider than the lid, a keyboard deck (shallow trapezoid),
// a full key grid, a spacebar and a trackpad. Drawn in the same
// stretched 0..100 viewBox as the other shapes.
function LaptopGlyph({
  fill,
  stroke,
  strokeWidth,
  strokeDasharray,
  aspect,
}: {
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  aspect: number;
}) {
  // Filled panels (lid / hinge / deck) carry the user's fill + dash;
  // the detail outlines (bezel / keys / trackpad) stay solid + thin,
  // matching the chrome inside the phone / tablet / browser frames.
  const main = {
    fill,
    stroke,
    strokeWidth,
    strokeDasharray,
    vectorEffect: 'non-scaling-stroke' as const,
    strokeLinejoin: 'round' as const,
  };
  const detail = {
    fill: 'none',
    stroke,
    strokeWidth: 0.8,
    vectorEffect: 'non-scaling-stroke' as const,
    strokeLinejoin: 'round' as const,
  };

  // Lid + an EVEN display bezel. preserveAspectRatio="none" stretches
  // the 0..100 box to the element, so equal viewBox insets land
  // uneven; scaling the horizontal inset by 1/aspect (= H/W) makes the
  // bezel margin even in screen pixels on all four sides at any size.
  const lid = { x: 8, y: 2, w: 84, h: 60 };
  const insetY = 3;
  const insetX = Math.max(1, Math.min(8, insetY / aspect));

  // Keyboard key grid, in a rectangle that fits inside the trapezoid
  // deck at every row. Generated rather than hand-placed so "all the
  // keys" stays a one-line change.
  const kb = { left: 20, right: 80, top: 69, bottom: 84 };
  const cols = 12;
  const rows = 4;
  const cellW = (kb.right - kb.left) / cols;
  const cellH = (kb.bottom - kb.top) / rows;
  const gapX = cellW * 0.2;
  const gapY = cellH * 0.22;

  return (
    <g>
      {/* Lid / screen panel. */}
      <rect x={lid.x} y={lid.y} width={lid.w} height={lid.h} rx={4} {...main} />
      {/* Even display bezel (outline only, so screen content shows). */}
      <rect
        x={lid.x + insetX}
        y={lid.y + insetY}
        width={lid.w - insetX * 2}
        height={lid.h - insetY * 2}
        rx={2}
        {...detail}
      />
      {/* Slim hinge, set in from the lid edges so it never overhangs. */}
      <rect x={lid.x + 2} y={lid.y + lid.h} width={lid.w - 4} height={3} rx={1.5} {...main} />
      {/* Keyboard deck: a shallow trapezoid with a slight front flare. */}
      <path d="M 14 66 L 86 66 L 94 96 L 6 96 Z" {...main} />
      {/* Keys. */}
      {Array.from({ length: rows }).flatMap((_, r) =>
        Array.from({ length: cols }).map((__, c) => (
          <rect
            key={`key-${r}-${c}`}
            x={kb.left + c * cellW + gapX / 2}
            y={kb.top + r * cellH + gapY / 2}
            width={cellW - gapX}
            height={cellH - gapY}
            rx={0.6}
            {...detail}
          />
        )),
      )}
      {/* Spacebar. */}
      <rect x={38} y={85.5} width={24} height={3} rx={0.8} {...detail} />
      {/* Trackpad. */}
      <rect x={43} y={90} width={14} height={4} rx={1} {...detail} />
    </g>
  );
}
