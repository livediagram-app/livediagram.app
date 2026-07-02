// Renders a catalogue icon's stroke primitives. Shared by the canvas
// element (BoxedElementView, for shape==='icon') and the palette icon
// picker so the on-canvas glyph and the picker thumbnail can't drift.

import type { AnimationSpeed, IconAnimation } from '@livediagram/diagram';

import { getIcon, iconAnimationClass, iconAnimationSpeedStyle, type IconPrim } from '@/lib/icons';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';

// non-scaling-stroke keeps the line weight constant on screen at any
// element size / zoom (matching the device-frame shapes), so a big icon
// reads as clean line art rather than fat brush strokes. It must sit on
// each geometry element — it does not inherit through a <g>.
const ve = 'non-scaling-stroke' as const;

function Prim({ p }: { p: IconPrim }) {
  switch (p.t) {
    case 'path':
      return <path d={p.d} vectorEffect={ve} />;
    case 'circle':
      return <circle cx={p.cx} cy={p.cy} r={p.r} vectorEffect={ve} />;
    case 'line':
      return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} vectorEffect={ve} />;
    case 'rect':
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} vectorEffect={ve} />;
    case 'polyline':
      return <polyline points={p.points} vectorEffect={ve} />;
    case 'polygon':
      return <polygon points={p.points} vectorEffect={ve} />;
    case 'ellipse':
      return <ellipse cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} vectorEffect={ve} />;
  }
}

// Bare <g> of an icon's primitives in a 0..24 coordinate space. The
// caller owns the <svg> + stroke colour so the same prims render at
// catalogue thumbnail size and at element size.
export function IconPrims({
  iconId,
  animation,
  animationSpeed,
}: {
  iconId: string | undefined;
  // The chosen looping animation (spec/09), or undefined for a static glyph.
  // The palette picker passes nothing, so thumbnails stay still.
  animation?: IconAnimation;
  // Loop speed for the animation (slow / normal / fast); undefined = normal.
  animationSpeed?: AnimationSpeed;
}) {
  // The glyph catalogue loads as an async chunk (lib/icon-registry.ts). This
  // subscription (a) kicks the load if nothing else has, and (b) re-renders
  // this glyph when the data lands — until then `getIcon` serves the framed
  // question-mark placeholder, so an icon element is never a blank flash.
  useIconCatalogs();
  const prims = getIcon(iconId).prims.map((p, i) => <Prim key={i} p={p} />);
  // An animated icon wraps the glyph in a <g> that carries the looping CSS
  // class; transform-box: fill-box in globals.css keeps the spin / scale
  // centred on the glyph. The speed factor rides a CSS var the class reads.
  const animClass = iconAnimationClass(animation);
  return animClass ? (
    <g className={animClass} style={iconAnimationSpeedStyle(animationSpeed)}>
      {prims}
    </g>
  ) : (
    <>{prims}</>
  );
}

// Full-box icon overlay for a shape==='icon' element. When the icon
// carries a label the glyph is pinned to the TOP of a taller viewBox
// (0..24 art in a 0..24..40 box ≈ top 60%) so the bottom-aligned label
// drops into a clear band beneath the art with real breathing room
// rather than crowding it; with no label the glyph fills the box
// (square viewBox). The stroke is non-scaling so the line weight stays
// crisp at any element size, and it picks up the element's stroke
// colour so icons tint + theme like line drawings.
export function IconGlyph({
  iconId,
  stroke,
  strokeWidth = 2,
  hasLabel = false,
  animation,
  animationSpeed,
}: {
  iconId: string | undefined;
  stroke: string;
  strokeWidth?: number;
  hasLabel?: boolean;
  animation?: IconAnimation;
  animationSpeed?: AnimationSpeed;
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox={hasLabel ? '0 0 24 40' : '0 0 24 24'}
      preserveAspectRatio="xMidYMin meet"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <IconPrims iconId={iconId} animation={animation} animationSpeed={animationSpeed} />
    </svg>
  );
}
