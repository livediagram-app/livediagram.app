'use client';

import {
  CHAIR_FACING_ROTATION,
  CHAIR_GEOMETRY,
  chairSeatFill,
  DEFAULT_CHAIR_FACING,
  type ShapeElement,
} from '@livediagram/diagram';

// A chair (docs/specs/009-elements/chair.md): furniture an Avatar-mode character sits down in.
//
// Drawn rather than labelled, because a box with the word "chair" in it is not
// furniture. The element's own label renders UNDER the chair (a name, a role),
// out of the way of whoever sits in it.
//
// WHO is sitting is not in the element — occupancy rides the avatar presence
// op (docs/specs/008-canvas/avatar-mode.md), so a chair cannot be left stuck by somebody who closed their
// laptop. The canvas passes the sitters it knows about from presence.

export type ChairSitter = { name: string; color: string };

// The drawing (and the rotation for each facing, 'n' being the drawn one:
// back at the top, sitter facing down the board toward the reader) comes
// from the shared CHAIR_GEOMETRY table (@livediagram/diagram
// shape-geometry.ts), which the headless export draws too.

export function ChairView({
  element,
  sitters,
  animClass,
}: {
  element: ShapeElement;
  // Everyone currently seated here, from peer presence. Usually 0 or 1; two is
  // allowed and self-correcting, because enforcing one seat needs a lock and a
  // lock means a chair that gets stuck (docs/specs/009-elements/chair.md).
  sitters: ChairSitter[];
  // The glow / pulse / trace / gradient animation (docs/specs/008-canvas/canvas-and-palette.md), drawn on the
  // chair's own silhouette: the element box is transparent, so the wrapper's
  // box-shadow version would ring a rectangle around nothing. Mounted here
  // rather than on the svg, whose `transform` already carries the facing.
  animClass?: string;
}) {
  const stroke = element.strokeColor ?? '#94a3b8';
  // The seat's surface. `transparent` is the element default (the chair is
  // furniture, not a box), so it falls back to a wash of its own STROKE —
  // which the tab theme sets — rather than to a fixed light grey. A hard grey
  // stayed bright on a dark-themed board, the one thing furniture must not do.
  // (Not `currentColor`: that inherits the label's text colour and drew a
  // black chair.)
  const seat = chairSeatFill(element.fillColor, stroke);
  const facing = element.chairFacing ?? DEFAULT_CHAIR_FACING;
  const occupied = sitters.length > 0;
  // The ring takes the first sitter's presence colour, so an occupied chair
  // reads as THEIR chair at a glance.
  const ringColor = sitters[0]?.color ?? stroke;
  const g = CHAIR_GEOMETRY;
  const rail = {
    stroke,
    strokeWidth: g.railStrokeWidth,
    opacity: g.railOpacity,
    fill: 'none',
  };

  return (
    <div
      className={`pointer-events-none absolute inset-0 origin-center ${animClass ?? ''}`}
      aria-hidden={false}
    >
      <svg
        viewBox={g.viewBox}
        className="absolute inset-0 h-full w-full"
        style={{ transform: `rotate(${CHAIR_FACING_ROTATION[facing]}deg)` }}
        role="img"
        aria-label={
          occupied ? `Chair, ${sitters.map((s) => s.name).join(' and ')} sitting` : 'Empty chair'
        }
      >
        {/* Contact shadow, so the chair sits ON the canvas rather than
            floating over it — the same trick the Avatar-mode sprite uses. */}
        <ellipse {...g.shadow} />
        {/* Backrest: TALL, so the silhouette reads as a chair. Squat and wide
            it just stacks two pills on top of each other. */}
        <rect {...g.back} fill={seat} stroke={stroke} strokeWidth={g.panelStrokeWidth} />
        {/* A slat down the back, which is what makes it furniture rather than
            a rounded rectangle. */}
        <path d={g.slat} {...rail} />
        {/* Seat: a shallow slab, wider than the back and overhanging it. */}
        <rect {...g.seat} fill={seat} stroke={stroke} strokeWidth={g.panelStrokeWidth} />
        {/* Front legs, splayed very slightly so the chair stands rather than
            hovers, with a stretcher between them. */}
        <path
          d={g.legs}
          stroke={stroke}
          strokeWidth={g.legStrokeWidth}
          strokeLinecap="round"
          fill="none"
        />
        <path d={g.stretcher} {...rail} />
        {occupied ? (
          // A soft ring in the sitter's colour. Drawn on the SEAT, which is
          // where the character's feet land (chairSeatPoint).
          <ellipse {...g.ring} fill="none" stroke={ringColor} strokeWidth="3" opacity="0.85" />
        ) : null}
      </svg>
      {occupied ? (
        // The name rides ABOVE the chair, and is counter-rotated by being
        // outside the svg — a sideways-facing chair should not print its
        // sitter's name sideways.
        <span
          className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[110%] whitespace-nowrap rounded-full px-1.5 py-[1px] text-[9px] font-semibold text-white shadow-sm"
          style={{ backgroundColor: ringColor }}
        >
          {sitters.map((s) => s.name).join(', ')}
        </span>
      ) : null}
    </div>
  );
}
