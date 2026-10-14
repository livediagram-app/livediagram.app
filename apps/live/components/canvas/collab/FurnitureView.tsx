'use client';

import { IDENTITY_FILL, identityVars } from '@livediagram/ui';
import {
  chairSeatFill,
  FURNITURE_ART,
  FURNITURE_GLINT,
  FURNITURE_LINE_STROKE,
  FURNITURE_PANEL_STROKE,
  FURNITURE_RAIL_OPACITY,
  FURNITURE_RAIL_STROKE,
  FURNITURE_SHADOW,
  furnitureFrame,
  furnitureParts,
  seatingFacing,
  type FurniturePart,
  type ShapeElement,
} from '@livediagram/document';
import type { ChairSitter } from '@/components/canvas/collab/ChairView';

// A desk or a two-seater sofa (docs/specs/009-elements/chair.md "Desk and sofa"): furniture an
// Avatar-mode character sits down in, like the chair. Drawn from the shared FURNITURE_ART table the
// headless export draws too, turned for its facing inside the svg (a quarter turn swaps the viewBox,
// and the facing setter swaps the box to match), so the drawing keeps its proportions.
//
// WHO is sitting is presence, never the element (docs/specs/008-canvas/avatar-mode.md): the canvas
// passes the sitters it knows about.
export function FurnitureView({
  element,
  stroke,
  sitters,
  animClass,
}: {
  element: ShapeElement;
  stroke: string;
  sitters: ChairSitter[];
  animClass?: string;
}) {
  if (element.shape !== 'desk' && element.shape !== 'sofa') return null;
  const art = FURNITURE_ART[element.shape];
  const facing = seatingFacing({ shape: element.shape, chairFacing: element.chairFacing });
  const frame = furnitureFrame(art, facing);
  const seat = chairSeatFill(element.fillColor, stroke);
  const occupied = sitters.length > 0;
  const ringColor = sitters[0]?.color ?? stroke;
  const noun = element.shape === 'desk' ? 'Desk' : 'Sofa';
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      <svg
        viewBox={frame.viewBox}
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label={
          occupied
            ? `${noun}, ${sitters.map((s) => s.name).join(' and ')} sitting`
            : `Empty ${noun.toLowerCase()}`
        }
      >
        <g transform={frame.transform || undefined}>
          {furnitureParts(art, facing).map((p, i) => (
            <FurniturePartView key={i} part={p} seat={seat} stroke={stroke} />
          ))}
          {occupied ? (
            // A soft ring in the first sitter's colour, under the seats.
            <ellipse {...art.ring} fill="none" stroke={ringColor} strokeWidth="3" opacity="0.85" />
          ) : null}
        </g>
      </svg>
      {occupied ? (
        <span
          className={`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[110%] whitespace-nowrap rounded-full px-1.5 py-[1px] text-[9px] font-semibold text-white shadow-sm ${IDENTITY_FILL}`}
          style={identityVars(ringColor)}
        >
          {sitters.map((s) => s.name).join(', ')}
        </span>
      ) : null}
    </div>
  );
}

function FurniturePartView({
  part,
  seat,
  stroke,
}: {
  part: FurniturePart;
  seat: string;
  stroke: string;
}) {
  const paint = (() => {
    switch (part.role) {
      case 'shadow':
        return { fill: FURNITURE_SHADOW.fill, opacity: FURNITURE_SHADOW.opacity };
      case 'panel':
        return { fill: seat, stroke, strokeWidth: FURNITURE_PANEL_STROKE };
      case 'line':
        return {
          fill: 'none',
          stroke,
          strokeWidth: FURNITURE_LINE_STROKE,
          strokeLinecap: 'round' as const,
        };
      case 'rail':
        return {
          fill: 'none',
          stroke,
          strokeWidth: FURNITURE_RAIL_STROKE,
          opacity: FURNITURE_RAIL_OPACITY,
          strokeLinecap: 'round' as const,
        };
      case 'screen':
        return { fill: stroke };
      case 'glint':
        return {
          fill: 'none',
          stroke: FURNITURE_GLINT.stroke,
          strokeWidth: FURNITURE_RAIL_STROKE,
          opacity: FURNITURE_GLINT.opacity,
          strokeLinecap: 'round' as const,
        };
    }
  })();
  switch (part.tag) {
    case 'rect':
      return <rect x={part.x} y={part.y} width={part.w} height={part.h} rx={part.rx} {...paint} />;
    case 'ellipse':
      return <ellipse cx={part.cx} cy={part.cy} rx={part.rx} ry={part.ry} {...paint} />;
    case 'path':
      return <path d={part.d} {...paint} />;
  }
}
