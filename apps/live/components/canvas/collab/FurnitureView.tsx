'use client';

import { IDENTITY_FILL, identityVars } from '@livediagram/ui';
import {
  chairSeatFill,
  FURNITURE_ART,
  FURNITURE_FACE_SHADE,
  FURNITURE_GLINT,
  FURNITURE_LINE_STROKE,
  FURNITURE_PANEL_STROKE,
  FURNITURE_RAIL_OPACITY,
  FURNITURE_RAIL_STROKE,
  FURNITURE_SHADOW,
  furnitureFrame,
  furnitureParts,
  furnitureRing,
  seatingFacing,
  type FurniturePart,
  type ShapeElement,
} from '@livediagram/document';

// A chair, a desk or a two-seater sofa (docs/specs/009-elements/chair.md "Facing", "Desk and sofa"):
// furniture an Avatar-mode character sits down in. Drawn from the shared FURNITURE_ART table the headless
// export draws too: the drawing for its facing (front, back, or side, mirrored for facing right), never
// a rotation, so it always stands upright. A quarter turn swaps a desk's or sofa's box to fit its side
// drawing (the facing setter does that).
//
// Drawn rather than labelled, because a box with the word "chair" in it is not furniture; the element's
// own label renders under it. WHO is sitting is presence, never the element
// (docs/specs/008-canvas/avatar-mode.md): the canvas passes the sitters it knows about.

export type ChairSitter = { name: string; color: string };

const NOUN = { chair: 'Chair', desk: 'Desk', sofa: 'Sofa' } as const;
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
  if (element.shape !== 'chair' && element.shape !== 'desk' && element.shape !== 'sofa')
    return null;
  const art = FURNITURE_ART[element.shape];
  const facing = seatingFacing({ shape: element.shape, chairFacing: element.chairFacing });
  const frame = furnitureFrame(art, facing);
  const seat = chairSeatFill(element.fillColor, stroke);
  const occupied = sitters.length > 0;
  const ringColor = sitters[0]?.color ?? stroke;
  const noun = NOUN[element.shape];
  const ring = furnitureRing(art, facing);
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
        </g>
        {occupied ? (
          // A soft ring in the first sitter's colour, under the seats.
          <ellipse {...ring} fill="none" stroke={ringColor} strokeWidth="3" opacity="0.85" />
        ) : null}
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
      case 'face':
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
    case 'rect': {
      const box = { x: part.x, y: part.y, width: part.w, height: part.h, rx: part.rx };
      // A face toward the room is the panel, shaded with its stroke colour.
      return part.role === 'face' ? (
        <>
          <rect {...box} {...paint} />
          <rect {...box} fill={stroke} opacity={FURNITURE_FACE_SHADE} />
        </>
      ) : (
        <rect {...box} {...paint} />
      );
    }
    case 'ellipse':
      return <ellipse cx={part.cx} cy={part.cy} rx={part.rx} ry={part.ry} {...paint} />;
    case 'path':
      return <path d={part.d} {...paint} />;
  }
}
