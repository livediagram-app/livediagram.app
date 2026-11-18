'use client';

import { seatPillBottom, type Sitter } from '@livehuddle/avatar/chair-sitters';
import { Fragment, useEffect, useId, useMemo, useRef, type CSSProperties } from 'react';
import { rowLayouts, type RowLayout } from '@livehuddle/avatar/furniture-rows';
import { turnFacing } from '@livehuddle/avatar/facing';
import {
  builtIn3D,
  endView,
  isSideFacing,
  seenFootShift,
  pieceQuarters,
  seenFromCamera,
} from '@/lib/space-3d/space-3d-pieces';
import { turnQuarter } from '@/lib/space-3d/space-3d-turn';
import { useSpace3DShowing, useSpace3DTurn } from '@/components/canvas/space-3d/useSpace3DView';
import { podClosed } from '@livehuddle/avatar/pod';
import { IDENTITY_FILL, identityVars } from '@livehuddle/ui';
import { useMachineAnswered } from '@/lib/machine-answer';
import { useGameOn } from '@/lib/table-games/table-game-scene';
import { hasMoment, type PieceMomentPlay } from '@/lib/piece-moments';
import {
  drawsOverMoment,
  partMotionsOf,
  partMotionStyle,
  type PartMotion,
} from '@/lib/piece-moment-motions';
import { MomentDrawing, PieceMoment } from './PieceMoments';
import { FurnitureLightDefs, FurniturePartView, useFurnitureLight } from './furniture-paint';
import { hasSocialArt, SocialArt } from './SocialArt';
import { hasWorkdayArt, WorkdayArt } from './WorkdayFaces';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import {
  pieceMaterial,
  seatFabric,
  FURNITURE_ART,
  FURNITURE_GLINT,
  FURNITURE_PANEL_STROKE,
  FURNITURE_RAIL_STROKE,
  furnitureFrame,
  type FurniturePart,
  isSeatingShape,
  OFFICE_ART,
  OFFICE_TONES,
  MACHINE_ANSWER_AT,
  POD_DOORS,
  podFurniture,
  RUG_FILL,
  facingView,
  type MachineAnswerSpot,
  type PodDoorView,
  seatsACharacter,
  pieceFacing,
  type GridOfficeKind,
  type SeatingKind,
  type ShapeElement,
  isLongTable,
  longTableArt,
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
  stairs: 'Stairs',
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

type FurnitureViewProps = Parameters<typeof FurnitureDrawingView>[0];

export function FurnitureView(props: FurnitureViewProps) {
  // Only the kinds it draws: the drawing's hooks run for those alone.
  if (!isFurnitureViewShape(props.element.shape)) return null;
  return <FurnitureDrawingView {...props} />;
}

function FurnitureDrawingView({
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
  const kind = element.shape as keyof typeof NOUN;
  const seating = isSeatingShape(kind);
  // The 3D camera's quarter turns (3d-view.md "Turning the camera"): turned, the piece is drawn as the camera sees it,
  // the side it looks at (its back from behind), in a box turned back to face the camera that stands up on its own.
  // A piece turned on the plan by quarter turns is seen the same way, its own turn added to the camera's.
  const showing = useSpace3DShowing();
  const own3D = pieceQuarters(element) ?? 0;
  const quarter = turnQuarter(useSpace3DTurn() + (showing ? own3D : 0));
  // A table drawn from above (a Long Table, one built row by row) turns its plan with the camera, so its box swaps
  // on a quarter turn.
  const plan = isLongTable(element) || builtIn3D(element);
  // Seen in the 3D view as the camera sees it: turned, or (unturned) a piece facing sideways, whose plan drawing is
  // seen from above and would stand up as a tall plank (the owner, 2026-11-18: lockers "leaning backwards").
  const seen =
    seenFromCamera(element) &&
    (quarter !== 0
      ? showing || own3D === 0
      : showing && !plan && isSideFacing(pieceFacing(element)));
  const facing = seen ? turnFacing(pieceFacing(element), quarter) : pieceFacing(element);
  const across = seen && quarter % 2 === 1;
  const planW = across && plan ? element.height : element.width;
  const planH = across && plan ? element.width : element.height;
  // A Long Table (office.md "Long Table") is drawn for its box at its facing.
  const art = isLongTable(element)
    ? longTableArt(planW, planH, facing)
    : seating
      ? FURNITURE_ART[kind]
      : OFFICE_ART[kind as GridOfficeKind];
  // Seen side on, a piece that stands up shows its end (3d-view.md "Turning the camera"): its side drawing's near end,
  // at its own height (space-3d-pieces.ts endView), never its back squeezed to its depth, which read as the piece
  // facing the wrong way and shrinking (the owner, 2026-11-18: sofas, chairs, the hammock and benches).
  const sideOn = seen && !plan && isSideFacing(facing);
  // The drawing its facing shows (docs/specs/009-elements/furniture-facing.md "The camera").
  const frame = furnitureFrame(art, facing);
  const end = sideOn ? endView(art.front, frame.view) : null;
  // A piece that stands up is seen at the scale its own drawing has on the canvas, at the seen drawing's own size: a
  // sofa seen from the side is its end, as tall as its front, and a coat stand keeps its height (the owner,
  // 2026-11-18: "rotated the coat stand and umbrellas shrink in size"), rather than its box laid on its side.
  const own = seen && !plan ? furnitureFrame(art, pieceFacing(element)).view : null;
  const ownScale = own ? Math.min(element.width / own.width, element.height / own.height) : 1;
  const boxW = own ? frame.view.width * ownScale : planW;
  const boxH = own ? (end ? end.height : frame.view.height) * ownScale : planH;
  const drawing = facingView(facing).view;
  // Its foot on the footprint's edge nearest the camera (see the stand's transform below).
  const footShift = seenFootShift({ width: element.width, height: element.height }, quarter, boxH);
  // Seating is upholstered in its own fabric (furniture-art-style.md "Materials"); the rest take the theme's wash.
  const seat =
    kind === 'rug'
      ? (fill ?? RUG_FILL)
      : seating
        ? seatFabric(kind, element.fillColor)
        : pieceMaterial(kind, element.fillColor);
  // Seating and the fixed seats (an Office Pod, a Bar Stool: docs/specs/009-elements/office.md) take sitters.
  const sits = seatsACharacter(kind);
  const occupied = sits && sitters.length > 0;
  // The pill wears the first sitter's colour; a taken seat has no ring (chair.md "Occupied").
  const pillColor = sitters[0]?.color ?? stroke;
  const noun = NOUN[kind];
  const { parts } = frame.view;
  // The drawing's light: one gradient per material (furniture-paint.tsx).
  const light = useFurnitureLight(parts, seat);
  // The drawing in its frame; while a moment plays on its front, the parts it moves are each wrapped in their motion.
  const width = Number(frame.viewBox.split(' ')[2]);
  // An Office Pod's furniture is drawn on a layer of its own over its floor and walls, which the 3D view stands up
  // inside the walls (3d-view.md "Which pieces"); flat, the two layers draw exactly the one drawing.
  const pod = kind === 'office-pod' ? podFurniture(parts) : null;
  // A table with its chairs is drawn a row to a layer, which the 3D view builds (3d-view.md "Tables are built, not
  // stood"); flat, the layers draw exactly the one drawing, in its order.
  const rows = useMemo(
    () => (frame.view.rows3D ? rowLayouts(parts, frame.view.rows3D) : null),
    [parts, frame.view.rows3D],
  );
  const podParts = pod
    ? new Set(pod.indices)
    : rows
      ? new Set(rows.flatMap((r) => [...r.parts, ...r.slab]))
      : null;
  const drawingOf = (moving: MovingParts | null) => (
    <g transform={frame.transform || undefined}>
      {parts.map((p, i) => {
        if (podParts?.has(i)) return null;
        const view = (
          <FurniturePartView key={i} part={p} seat={seat} stroke={stroke} light={light} />
        );
        const m = moving?.motions.get(i);
        return m ? (
          <g
            key={i}
            className={`lh-moment lh-moment-${m.motion}`}
            style={partMotionStyle(m, moving!.side, width)}
            data-moment-part={i}
          >
            {view}
          </g>
        ) : (
          view
        );
      })}
      {kind === 'office-pod' ? (
        <PodDoor closed={podClosed(sitters.length)} stroke={stroke} door={POD_DOORS[drawing]} />
      ) : null}
      {/* Inside the drawing's frame, on the drawing its facing shows: no text, so mirroring is safe. */}
      {(kind === 'water-cooler' || kind === 'coffee-machine') &&
      MACHINE_ANSWER_AT[kind][drawing] ? (
        <MachineAnswer kind={kind} id={element.id} spots={MACHINE_ANSWER_AT[kind][drawing]} />
      ) : null}
    </g>
  );
  const body = (
    <>
      <svg
        // An end is its side drawing's near end: the bottom of the drawing, as tall as the piece stands.
        viewBox={end ? `0 ${end.top} ${frame.view.width} ${end.height}` : frame.viewBox}
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label={
          // A Podium is stood at, and named as before while nobody does (venue-pieces.md "Speaking from the Podium").
          kind === 'podium'
            ? occupied
              ? `${noun}, ${sitters.map((s) => s.name).join(' and ')} speaking`
              : noun
            : !sits
              ? noun
              : occupied
                ? `${noun}, ${sitters.map((s) => s.name).join(' and ')} sitting`
                : `Empty ${noun.toLowerCase()}`
        }
      >
        <FurnitureLightDefs light={light} />
        {/* A moment kind's drawing moves in its moment (docs/specs/009-elements/piece-moments.md): the whole of it, and the parts it names. */}
        {hasMoment(kind) ? (
          <MomentDrawing kind={kind} id={element.id} front={drawing === 'front'}>
            {(play) => drawingOf(play && drawing === 'front' ? movingParts(kind, play) : null)}
          </MomentDrawing>
        ) : (
          drawingOf(null)
        )}
        {hasSocialArt(kind) ? (
          <SocialArt kind={kind} id={element.id} sitters={sitters.length} facing={facing} />
        ) : null}
        {hasWorkdayArt(kind) ? (
          <WorkdayArt
            kind={kind}
            id={element.id}
            sitters={sitters}
            box={element}
            grid={frame.view}
            facing={facing}
          />
        ) : null}
        {/* A moment's parts sit on the front drawing (a stoked fire, a dropped can), so a turned piece keeps quiet. */}
        {hasMoment(kind) && drawing === 'front' && drawsOverMoment(kind) ? (
          <PieceMoment kind={kind} id={element.id} />
        ) : null}
      </svg>
      {rows ? (
        <FurnitureRows
          rows={rows}
          parts={parts}
          frame={frame}
          scale={boxH / frame.view.height}
          seat={seat}
          stroke={stroke}
          light={light}
        />
      ) : null}
      {pod ? (
        <div
          aria-hidden
          data-pod-furniture=""
          className="absolute inset-0"
          style={{
            ['--pod-foot' as string]: `${(pod.foot / Number(frame.viewBox.split(' ')[3])) * 100}%`,
          }}
        >
          <svg viewBox={frame.viewBox} className="absolute inset-0 h-full w-full overflow-visible">
            <g transform={frame.transform || undefined}>
              {pod.indices.map((i) => (
                <FurniturePartView
                  key={i}
                  part={parts[i]!}
                  seat={seat}
                  stroke={stroke}
                  light={light}
                />
              ))}
            </g>
          </svg>
        </div>
      ) : null}
      {/* A Hot Desk's raised name card is its pill (WorkdayFaces hotDeskCardY). */}
      {occupied && kind !== 'hot-desk' ? (
        <SeatPill
          id={element.id}
          color={pillColor}
          // Clear of the highest sitter's head and the chip over it, never below the piece's top (#582).
          top={seatPillBottom(element, frame.view, sitters)}
          names={sitters.map((s) => s.name).join(', ')}
        />
      ) : null}
    </>
  );
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      {seen ? (
        <div
          data-space-seen=""
          className="absolute"
          style={{
            width: boxW,
            height: boxH,
            left: (element.width - boxW) / 2,
            top: (element.height - boxH) / 2,
            // Its foot on the footprint's edge nearest the camera, as an unturned piece stands on its front edge, so
            // the drawing covers the ground that stops you (the owner, 2026-11-18: turned, "I can stand in a fountain").
            transform: `rotate(${-quarter * 90}deg) translateY(${footShift}px)`,
          }}
        >
          {rows ? (
            body
          ) : (
            <div data-space-seen-stand="" className="absolute inset-0">
              {body}
            </div>
          )}
        </div>
      ) : (
        body
      )}
    </div>
  );
}

// A table's rows, each a layer over the floor (3d-view.md "Tables are built, not stood"): a chair stands about its own
// foot; a top's front edge and legs stand about theirs and its slab rises to sit on them (app/space-3d.css).
function FurnitureRows({
  rows,
  parts,
  frame,
  scale,
  seat,
  stroke,
  light,
}: {
  rows: readonly RowLayout[];
  parts: readonly FurniturePart[];
  frame: { viewBox: string; transform: string };
  // Canvas px per grid unit, for how far a slab rises.
  scale: number;
  seat: string;
  stroke: string;
  light: ReturnType<typeof useFurnitureLight>;
}) {
  const height = Number(frame.viewBox.split(' ')[3]);
  const layer = (indices: readonly number[], kind: 'stand' | 'slab', style: CSSProperties) => (
    <div key={kind} aria-hidden className="absolute inset-0" data-space-row={kind} style={style}>
      <svg viewBox={frame.viewBox} className="absolute inset-0 h-full w-full overflow-visible">
        <g transform={frame.transform || undefined}>
          {indices.map((i) => (
            <FurniturePartView key={i} part={parts[i]!} seat={seat} stroke={stroke} light={light} />
          ))}
        </g>
      </svg>
    </div>
  );
  return rows.map((r, n) => (
    <Fragment key={n}>
      {/* The slab under its front edge, as the flat drawing paints them. */}
      {r.slab.length > 0
        ? layer(r.slab, 'slab', { ['--row-lift' as string]: `${r.lift * scale}px` })
        : null}
      {layer(r.parts, 'stand', { ['--row-foot' as string]: `${(r.foot / height) * 100}%` })}
    </Fragment>
  ));
}

// The sitters' names above an occupied piece (docs/specs/009-elements/chair.md "The name pill clears the sitter's
// head"), hidden while the piece shows a game, whose scoreboard already names its players in their colours ("A game
// names its own players", Work Tracker 753). Its own component so only an occupied piece subscribes to the games.
function SeatPill({
  id,
  color,
  top,
  names,
}: {
  id: string;
  color: string;
  top: number;
  names: string;
}) {
  if (useGameOn(id)) return null;
  return (
    <span
      className={`absolute left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full px-1.5 py-[1px] text-[9px] font-semibold text-white shadow-sm ${IDENTITY_FILL}`}
      style={{ ...identityVars(color), top }}
      data-seat-pill=""
    >
      {names}
    </span>
  );
}

// The parts a moment moves on a piece's front drawing (lib/piece-moment-motions.ts), by index: those for your side
// only, where a kind moves the nearest of two. Built when a moment plays, never at rest.
type MovingParts = { side: PieceMomentPlay['side']; motions: Map<number, PartMotion> };
function movingParts(kind: string, play: PieceMomentPlay): MovingParts | null {
  const all = partMotionsOf(kind);
  if (all.length === 0) return null;
  const motions = new Map<number, PartMotion>();
  for (const m of all) if (m.side === undefined || m.side === play.side) motions.set(m.part, m);
  return { side: play.side, motions };
}

// An Office Pod's sliding glass door (docs/specs/009-elements/office.md "Office Pod"): shut across the doorway while
// both seats are held, slid away behind the wall otherwise, on the drawing the pod's facing shows (POD_DOORS: along
// the front wall, standing in the far wall from behind, down the left wall on its side). Clipped to the doorway, so
// sliding open it goes out of sight; the slide is a CSS transition, none under reduced motion.
function PodDoor({ closed, stroke, door }: { closed: boolean; stroke: string; door: PodDoorView }) {
  const clip = useId();
  const { x, y, w, h, open } = door;
  // The glints run across the panel's short side and the handle sits near its leading edge, whichever way it lies.
  const across = w >= h;
  const glints = across
    ? `M${x + 8} ${y + h - 2}L${x + 16} ${y + 2}M${x + 18} ${y + h - 2}L${x + 26} ${y + 2}`
    : `M${x + 2} ${y + 16}L${x + w - 2} ${y + 8}M${x + 2} ${y + 26}L${x + w - 2} ${y + 18}`;
  const handle = across
    ? { x: x + 6, y: y + h / 2 - 1, width: 6, height: 2 }
    : { x: x + w / 2 - 1, y: y + 6, width: 2, height: 6 };
  return (
    <g aria-hidden data-pod-door={closed ? 'closed' : 'open'}>
      <clipPath id={clip}>
        <rect x={x} y={y - 2} width={w} height={h + 4} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <g
          className="lh-pod-door motion-reduce:transition-none"
          style={{
            transform: closed ? 'translate(0px, 0px)' : `translate(${open.x}px, ${open.y}px)`,
          }}
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
            d={glints}
            stroke={FURNITURE_GLINT.stroke}
            strokeWidth={FURNITURE_RAIL_STROKE}
            opacity={FURNITURE_GLINT.opacity}
            strokeLinecap="round"
          />
          <rect {...handle} rx={1} fill={stroke} />
        </g>
      </g>
    </g>
  );
}

// The machine answering a drink (docs/specs/009-elements/office.md "Using it"): bubbles rising in the cooler's
// bottle, or coffee dripping into the carafe, for a moment. Played with the Web Animations API on each bump of
// its count (lib/machine-answer.ts), so it costs nothing until somebody gets a drink, and not at all under reduced
// motion. A count it already had when it mounted (a tab switched back to) does not play again.
function MachineAnswer({
  kind,
  id,
  spots,
}: {
  kind: 'water-cooler' | 'coffee-machine';
  id: string;
  spots: readonly MachineAnswerSpot[];
}) {
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
      {spots.map(({ x, y }, i) => (
        <circle key={i} cx={x} cy={y} r={2 + (i % 2)} fill="#ffffff" opacity={0} />
      ))}
    </g>
  ) : (
    <g ref={ref} aria-hidden>
      {spots.map(({ x, y }, i) => (
        <ellipse key={i} cx={x} cy={y} rx={1.4} ry={2.2} fill={OFFICE_TONES.coffee} opacity={0} />
      ))}
    </g>
  );
}
