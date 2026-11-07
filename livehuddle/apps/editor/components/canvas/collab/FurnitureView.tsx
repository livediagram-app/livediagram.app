'use client';

import { seatPillBottom, seatRing, type Sitter } from '@liveworkspace/avatar/chair-sitters';
import { useEffect, useId, useRef } from 'react';
import { podClosed } from '@liveworkspace/avatar/pod';
import { IDENTITY_FILL, identityVars } from '@livehuddle/ui';
import { useMachineAnswered } from '@/lib/machine-answer';
import { hasSocialArt, SocialArt } from './SocialArt';
import { hasWorkdayArt, WorkdayArt } from './WorkdayFaces';
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
  POD_DOOR,
  RUG_FILL,
  seatsACharacter,
  seatingFacing,
  type FurniturePart,
  type GridOfficeKind,
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

export type ChairSitter = Sitter;

// The plant, the bookshelf, the machines, the meeting table and the rug (docs/specs/009-elements/office.md) are
// drawn the same way, from OFFICE_ART: one drawing for every side.

const NOUN: Record<SeatingKind | GridOfficeKind, string> = {
  chair: 'Chair',
  desk: 'Desk',
  sofa: 'Sofa',
  'meeting-table': 'Meeting table',
  plant: 'Plant',
  bookshelf: 'Bookshelf',
  'water-cooler': 'Water cooler',
  'coffee-machine': 'Coffee machine',
  rug: 'Rug',
  'office-pod': 'Office pod',
  bar: 'Bar',
  'bar-stool': 'Bar stool',
  'drinks-cabinet': 'Drinks cabinet',
  'drinks-fridge': 'Drinks fridge',
  'outdoor-plant': 'Outdoor plant',
  tree: 'Tree',
  directory: 'Directory',
  elevator: 'Elevator',
  // The social pieces (docs/specs/009-elements/social-pieces.md).
  'notice-board': 'Notice board',
  'world-clock': 'World clock',
  jukebox: 'Jukebox',
  'ping-pong-table': 'Ping-pong table',
  'arcade-machine': 'Arcade machine',
  fireplace: 'Fireplace',
  campfire: 'Campfire',
  bench: 'Bench',
  'picnic-table': 'Picnic table',
  hammock: 'Hammock',
  'garden-umbrella': 'Garden umbrella',
  fountain: 'Fountain',
  'pool-table': 'Pool table',
  'foosball-table': 'Foosball table',
  dartboard: 'Dartboard',
  'vending-machine': 'Vending machine',
  'bean-bag': 'Bean bag',
  'reading-nook': 'Reading nook',
  printer: 'Printer',
  copier: 'Copier',
  lockers: 'Lockers',
  'coat-rack': 'Coat rack',
  'umbrella-stand': 'Umbrella stand',
  'kitchen-counter': 'Kitchen counter',
  'kitchen-sink': 'Kitchen sink',
  fridge: 'Fridge',
  microwave: 'Microwave',
  kettle: 'Kettle',
  'toilet-cubicle': 'Toilet cubicle',
  washbasin: 'Washbasin',
  'hand-dryer': 'Hand dryer',
  pillar: 'Pillar',
  column: 'Column',
  'car-park': 'Car park',
  'bike-rack': 'Bike rack',
  'stage-curtains': 'Stage curtains',
  podium: 'Podium',
  // The workday pieces (docs/specs/009-elements/workday-pieces.md).
  'nap-pod': 'Nap pod',
  treadmill: 'Treadmill',
  'weight-bench': 'Weight bench',
  'phone-booth': 'Phone booth',
  'standing-desk': 'Standing desk',
  'hot-desk': 'Hot desk',
  'pet-bed': 'Pet bed',
  'reception-desk': 'Reception desk',
  // The team pieces (docs/specs/009-elements/team-pieces.md).
  'calendar-wall': 'Calendar wall',
  'suggestion-box': 'Suggestion box',
  signpost: 'Signpost',
  'photo-wall': 'Team photo wall',
};

/** Whether FurnitureView draws this kind: seating, and every office piece but the room and the stage (RoomView, StageView). */
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
  const art = seating ? FURNITURE_ART[kind] : OFFICE_ART[kind as GridOfficeKind];
  const facing = seating ? seatingFacing({ shape: kind, chairFacing: element.chairFacing }) : 'n';
  const frame = furnitureFrame(art, facing);
  const seat = kind === 'rug' ? (fill ?? RUG_FILL) : chairSeatFill(element.fillColor, stroke);
  // Seating and the fixed seats (an Office Pod, a Bar Stool: docs/specs/009-elements/office.md) take sitters.
  const sits = seatsACharacter(kind);
  const occupied = sits && sitters.length > 0;
  const ringColor = sitters[0]?.color ?? stroke;
  const noun = NOUN[kind];
  const { parts, ring, ringUnder = parts.length, seats } = frame.view;
  // Soft rings on the seat and under what stands nearer the camera (ringUnder): a one-seat piece's own ring in its
  // sitter's colour; on a piece with several (a sofa, a meeting table, a pod) a ring on each taken seat, in that
  // sitter's colour, at the seat their presence holds (docs/specs/009-elements/chair.md "Occupancy is presence").
  const rings = !occupied
    ? []
    : seats.length > 1
      ? sitters.flatMap((s, i) => {
          const at = seatRing(frame.view, s.seat);
          return at ? [{ ...at, color: s.color, key: `${s.seat}-${i}` }] : [];
        })
      : [{ ...ring, color: ringColor, key: 'piece' }];
  const ringView = rings.map(({ key, color, ...at }) => (
    <ellipse
      key={`ring-${key}`}
      {...at}
      fill="none"
      stroke={color}
      strokeWidth="3"
      opacity="0.85"
    />
  ));
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      <svg
        viewBox={frame.viewBox}
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label={
          !sits
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
          {kind === 'office-pod' ? (
            <PodDoor closed={podClosed(sitters.length)} stroke={stroke} />
          ) : null}
        </g>
        {hasSocialArt(kind) ? (
          <SocialArt kind={kind} id={element.id} sitters={sitters.length} />
        ) : null}
        {hasWorkdayArt(kind) ? (
          <WorkdayArt
            kind={kind}
            id={element.id}
            sitters={sitters}
            box={element}
            grid={frame.view}
          />
        ) : null}
        {kind === 'water-cooler' || kind === 'coffee-machine' ? (
          <MachineAnswer kind={kind} id={element.id} />
        ) : null}
      </svg>
      {/* A Hot Desk's raised name card is its pill (WorkdayFaces hotDeskCardY). */}
      {occupied && kind !== 'hot-desk' ? (
        <span
          className={`absolute left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full px-1.5 py-[1px] text-[9px] font-semibold text-white shadow-sm ${IDENTITY_FILL}`}
          // Clear of the highest sitter's head and the chip over it, never below the piece's top (#582).
          style={{ ...identityVars(ringColor), top: seatPillBottom(element, frame.view, sitters) }}
        >
          {sitters.map((s) => s.name).join(', ')}
        </span>
      ) : null}
    </div>
  );
}

// An Office Pod's sliding glass door (docs/specs/009-elements/office.md "Office Pod"): shut across the doorway while
// both seats are held, slid away behind the front wall otherwise. Clipped to the doorway, so sliding open it goes
// out of sight; the slide is a CSS transition, none under reduced motion.
function PodDoor({ closed, stroke }: { closed: boolean; stroke: string }) {
  const clip = useId();
  const { x, y, w, h } = POD_DOOR;
  return (
    <g aria-hidden data-pod-door={closed ? 'closed' : 'open'}>
      <clipPath id={clip}>
        <rect x={x} y={y - 2} width={w} height={h + 4} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <g
          className="lh-pod-door motion-reduce:transition-none"
          style={{ transform: `translateX(${closed ? 0 : w}px)` }}
        >
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={2}
            fill="#e0f2fe"
            fillOpacity={0.85}
            stroke={stroke}
            strokeWidth={FURNITURE_PANEL_STROKE}
          />
          <path
            d={`M${x + 8} ${y + h - 2}L${x + 16} ${y + 2}M${x + 18} ${y + h - 2}L${x + 26} ${y + 2}`}
            stroke={FURNITURE_GLINT.stroke}
            strokeWidth={FURNITURE_RAIL_STROKE}
            opacity={FURNITURE_GLINT.opacity}
            strokeLinecap="round"
          />
          <rect x={x + 6} y={y + h / 2 - 1} width={6} height={2} rx={1} fill={stroke} />
        </g>
      </g>
    </g>
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

export function FurniturePartView({
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
      // A small unstroked mark in its own colour (docs/specs/009-elements/social-pieces.md).
      case 'mark':
        return { fill: part.fill ?? stroke };
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
