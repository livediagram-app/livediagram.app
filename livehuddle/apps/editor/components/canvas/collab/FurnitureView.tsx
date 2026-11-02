'use client';

import { useEffect, useRef } from 'react';
import { IDENTITY_FILL, identityVars } from '@livehuddle/ui';
import { useMachineAnswered } from '@/lib/machine-answer';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
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
  isSeatingShape,
  OFFICE_ART,
  OFFICE_TONES,
  RUG_FILL,
  seatingFacing,
  type FurniturePart,
  type OfficeKind,
  type SeatingKind,
  type ShapeElement,
} from '@livehuddle/document';

// How long a machine answers a drink.
const MACHINE_ANSWER_MS = 1500;

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

// The plant, the bookshelf, the machines, the meeting table and the rug (docs/specs/009-elements/office.md) are
// drawn the same way, from OFFICE_ART: one drawing for every side.

const NOUN: Record<SeatingKind | Exclude<OfficeKind, 'room'>, string> = {
  chair: 'Chair',
  desk: 'Desk',
  sofa: 'Sofa',
  'meeting-table': 'Meeting table',
  plant: 'Plant',
  bookshelf: 'Bookshelf',
  'water-cooler': 'Water cooler',
  'coffee-machine': 'Coffee machine',
  rug: 'Rug',
};

/** Whether FurnitureView draws this kind: seating, and every office piece but the room (RoomView). */
export function isFurnitureViewShape(kind: string): kind is keyof typeof NOUN {
  return kind in NOUN;
}

export function FurnitureView({
  element,
  stroke,
  fill,
  sitters,
  animClass,
}: {
  element: ShapeElement;
  stroke: string;
  // The element's fill: a rug's colour (seating and the rest take their seat wash from it).
  fill?: string;
  sitters: ChairSitter[];
  animClass?: string;
}) {
  const kind = element.shape;
  if (!isFurnitureViewShape(kind)) return null;
  const seating = isSeatingShape(kind);
  const art = seating ? FURNITURE_ART[kind] : OFFICE_ART[kind as Exclude<OfficeKind, 'room'>];
  const facing = seating ? seatingFacing({ shape: kind, chairFacing: element.chairFacing }) : 'n';
  const frame = furnitureFrame(art, facing);
  const seat = kind === 'rug' ? (fill ?? RUG_FILL) : chairSeatFill(element.fillColor, stroke);
  const occupied = seating && sitters.length > 0;
  const ringColor = sitters[0]?.color ?? stroke;
  const noun = NOUN[kind];
  const { parts, ring, ringUnder = parts.length } = frame.view;
  // A soft ring in the first sitter's colour, on the seat and under what stands nearer the camera (ringUnder). A
  // meeting table names its sitters without a ring: which seat a peer took is not in their presence.
  const ringView =
    occupied && kind !== 'meeting-table' ? (
      <ellipse key="ring" {...ring} fill="none" stroke={ringColor} strokeWidth="3" opacity="0.85" />
    ) : null;
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      <svg
        viewBox={frame.viewBox}
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label={
          !seating
            ? noun
            : occupied
              ? `${noun}, ${sitters.map((s) => s.name).join(' and ')} sitting`
              : `Empty ${noun.toLowerCase()}`
        }
      >
        {/* The ring rides inside the drawing's own frame, so a mirrored side mirrors it too. */}
        <g transform={frame.transform || undefined}>
          {parts.map((p, i) => [
            i === ringUnder ? ringView : null,
            <FurniturePartView key={i} part={p} seat={seat} stroke={stroke} />,
          ])}
          {ringUnder >= parts.length ? ringView : null}
        </g>
        {kind === 'water-cooler' || kind === 'coffee-machine' ? (
          <MachineAnswer kind={kind} id={element.id} />
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

// The machine answering a drink (docs/specs/009-elements/office.md "Using it"): bubbles rising in the cooler's
// bottle, or coffee dripping into the carafe, for a moment. Played with the Web Animations API on each bump of
// its count (lib/machine-answer.ts), so it costs nothing until somebody gets a drink, and not at all under reduced
// motion. A count it already had when it mounted (a tab switched back to) does not play again.
function MachineAnswer({ kind, id }: { kind: 'water-cooler' | 'coffee-machine'; id: string }) {
  const answered = useMachineAnswered(id);
  const ref = useRef<SVGGElement>(null);
  const seen = useRef(answered);
  useEffect(() => {
    const g = ref.current;
    if (!g || answered === seen.current || prefersReducedMotion()) return;
    seen.current = answered;
    const anims = [...g.children].map((child, i) =>
      (child as SVGElement).animate(
        kind === 'water-cooler'
          ? [
              { transform: 'translateY(0)', opacity: 0 },
              { transform: 'translateY(-4px)', opacity: 0.9, offset: 0.2 },
              { transform: 'translateY(-22px)', opacity: 0 },
            ]
          : [
              { transform: 'translateY(0)', opacity: 0 },
              { transform: 'translateY(2px)', opacity: 1, offset: 0.3 },
              { transform: 'translateY(9px)', opacity: 0 },
            ],
        { duration: MACHINE_ANSWER_MS / 2, delay: i * 180, iterations: 2, easing: 'ease-out' },
      ),
    );
    return () => anims.forEach((a) => a.cancel());
  }, [answered, kind]);
  return kind === 'water-cooler' ? (
    <g ref={ref} aria-hidden>
      {[20, 28, 35].map((x, i) => (
        <circle key={x} cx={x} cy={30 - i * 2} r={2 + (i % 2)} fill="#ffffff" opacity={0} />
      ))}
    </g>
  ) : (
    <g ref={ref} aria-hidden>
      {[0, 1, 2].map((i) => (
        <ellipse key={i} cx={36} cy={38} rx={1.4} ry={2.2} fill={OFFICE_TONES.coffee} opacity={0} />
      ))}
    </g>
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
        return { fill: part.fill ?? seat, stroke, strokeWidth: FURNITURE_PANEL_STROKE };
      case 'floor':
        return { fill: seat };
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
