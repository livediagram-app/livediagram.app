'use client';

import { DEFAULT_CHAIR_FACING, type ChairFacing, type ShapeElement } from '@livediagram/diagram';

// A chair (spec/130): furniture an Avatar-mode character sits down in.
//
// Drawn rather than labelled, because a box with the word "chair" in it is not
// furniture. The element's own label renders UNDER the chair (a name, a role),
// out of the way of whoever sits in it.
//
// WHO is sitting is not in the element — occupancy rides the avatar presence
// op (spec/101), so a chair cannot be left stuck by somebody who closed their
// laptop. The canvas passes the sitters it knows about from presence.

export type ChairSitter = { name: string; color: string };

// Rotation for each facing. 'n' is the drawn orientation: back at the top,
// sitter facing down the board toward the reader.
const FACING_ROTATION: Record<ChairFacing, number> = { n: 0, e: 90, s: 180, w: 270 };

export function ChairView({
  element,
  sitters,
}: {
  element: ShapeElement;
  // Everyone currently seated here, from peer presence. Usually 0 or 1; two is
  // allowed and self-correcting, because enforcing one seat needs a lock and a
  // lock means a chair that gets stuck (spec/130).
  sitters: ChairSitter[];
}) {
  const stroke = element.strokeColor ?? '#94a3b8';
  const facing = element.chairFacing ?? DEFAULT_CHAIR_FACING;
  const occupied = sitters.length > 0;
  // The ring takes the first sitter's presence colour, so an occupied chair
  // reads as THEIR chair at a glance.
  const ringColor = sitters[0]?.color ?? stroke;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden={false}>
      <svg
        viewBox="0 0 64 72"
        className="absolute inset-0 h-full w-full"
        style={{ transform: `rotate(${FACING_ROTATION[facing]}deg)` }}
        role="img"
        aria-label={
          occupied ? `Chair, ${sitters.map((s) => s.name).join(' and ')} sitting` : 'Empty chair'
        }
      >
        {/* Contact shadow, so the chair sits ON the canvas rather than
            floating over it — the same trick the Avatar-mode sprite uses. */}
        <ellipse cx="32" cy="64" rx="20" ry="4.5" fill="#0f172a" opacity="0.12" />
        {/* Back */}
        <rect
          x="14"
          y="6"
          width="36"
          height="20"
          rx="5"
          fill="currentColor"
          stroke={stroke}
          strokeWidth="2"
          opacity="0.9"
        />
        {/* Seat, seen from slightly above so the chair reads as facing the
            reader rather than as a flat plan symbol. */}
        <rect
          x="9"
          y="28"
          width="46"
          height="24"
          rx="6"
          fill="currentColor"
          stroke={stroke}
          strokeWidth="2"
        />
        {/* Legs */}
        <path
          d="M15 52v10M49 52v10"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        {occupied ? (
          // A soft ring in the sitter's colour. Drawn on the SEAT, which is
          // where the character's feet land (chairSeatPoint).
          <ellipse
            cx="32"
            cy="42"
            rx="21"
            ry="12"
            fill="none"
            stroke={ringColor}
            strokeWidth="3"
            opacity="0.85"
          />
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
