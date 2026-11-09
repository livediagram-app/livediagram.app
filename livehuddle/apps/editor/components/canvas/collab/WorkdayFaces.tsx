'use client';

import { useEffect, useRef, useState } from 'react';
import {
  HOT_DESK_CARD,
  HOT_DESK_CARDS,
  PHONE_BOOTH_LAMP,
  RECEPTION_BELLS,
  TREADMILL_BELTS,
  WORKDAY_TONES,
  facingView,
  msToNextLeg,
  petLeg,
  petLegAt,
  type PetArea,
  type ShapeElement,
} from '@livehuddle/document';
import type { SeatFacing } from '@livehuddle/avatar/facing';
import { Glyph } from '@livehuddle/ui';
import { useReducedMotion } from '@/lib/reduced-motion';
import { seatPillBottom } from '@livehuddle/avatar/chair-sitters';
import { drawnRect, type SeatGrid } from '@livehuddle/avatar/seats';
import { pieceControlProps } from '@/lib/piece-control';
import { track } from '@/lib/telemetry';
import { ringBell, useBellRings, useBellRung } from '@/lib/office/reception-bell';
import { useAtReception, usePetArea } from '@/lib/office/useWorkdayPieces';
import { Overlay } from './SocialFaces';
import type { ChairSitter } from './FurnitureView';

// The workday pieces' live parts (docs/specs/009-elements/workday-pieces.md). `WorkdayArt` draws inside a piece's own
// grid, over its art (FurnitureView): the treadmill's belt running while someone is on it, the booth's lamp lit while
// it is in use, the hot desk's name card, and the reception bell ringing out. `WorkdayFace` lies over the piece's box
// (PieceArt): the Reception Desk's Welcome bubble with its Ring Bell, and the office dog that wanders from its bed.
// A turned piece (docs/specs/009-elements/furniture-facing.md "Live faces") lays each part on the drawing its facing
// shows, at that drawing's spot. These are drawn outside the drawing's mirrored group, so facing right places each
// part at its mirrored spot and its words still read the right way round.

const T = WORKDAY_TONES;

/** Whether a kind has live parts in its grid. */
export function hasWorkdayArt(kind: string): boolean {
  return (
    kind === 'treadmill' ||
    kind === 'phone-booth' ||
    kind === 'hot-desk' ||
    kind === 'reception-desk'
  );
}

/** Whether a kind has a live face over its box. */
export function hasWorkdayFace(kind: string): boolean {
  return kind === 'reception-desk' || kind === 'pet-bed';
}

// Up to `max` characters of a name, an ellipsis when cut.
function clip(text: string, max: number): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
}

/** What a hot desk's card reads: the sitter's name while held, Hot Desk while free. */
export function hotDeskCard(sitters: readonly ChairSitter[]): string {
  const name = sitters[0]?.name?.trim();
  return name ? clip(name, 12) : 'Hot Desk';
}

type Box = { x: number; y: number; width: number; height: number };

/**
 * Where a hot desk's name card stands, on its grid: on the desk's front edge while free; while held, raised clear of
 * the sitter's head and what rides over it, where any other seat's name pill would be (seatPillBottom), so the head
 * never hides the name. It stands in for that pill (FurnitureView draws none on a hot desk). `card` is the card on the
 * drawing shown (HOT_DESK_CARDS), the unturned desk's by default.
 */
export function hotDeskCardY(
  box: Box,
  grid: SeatGrid,
  sitters: readonly ChairSitter[],
  card: { y: number; h: number } = HOT_DESK_CARD,
): number {
  if (sitters.length === 0) return card.y;
  const drawn = drawnRect(box, grid);
  const perGrid = drawn.height / grid.height;
  const bottom = (seatPillBottom(box, grid, sitters) - (drawn.y - box.y)) / perGrid;
  return Math.min(card.y, bottom - card.h);
}

export function WorkdayArt({
  kind,
  id,
  sitters,
  box,
  grid,
  facing = 'n',
}: {
  kind: string;
  id: string;
  sitters: readonly ChairSitter[];
  // The piece's box and the drawing its facing shows, for what is placed round its sitters (the hot desk's raised
  // card), and the facing, for which drawing's spots and whether they are mirrored.
  box: Box;
  grid: SeatGrid;
  facing?: SeatFacing;
}) {
  const used = sitters.length > 0;
  const { view, mirrored } = facingView(facing);
  // A spot's left edge on the drawing as shown: the side's, mirrored for facing right.
  const left = (x: number, w: number) => (mirrored ? grid.width - x - w : x);
  switch (kind) {
    case 'treadmill': {
      if (!used) return null;
      const belt = TREADMILL_BELTS[view];
      return (
        <RunningBelt
          id={id}
          belt={{ ...belt, x: left(belt.x, belt.w) }}
          along={view === 'side'}
          reverse={view === 'front' || mirrored}
        />
      );
    }
    case 'phone-booth':
      // On the roof, centred: the same spot on every drawing, mirrored or not.
      return used ? <BoothLamp /> : null;
    case 'hot-desk': {
      const card = HOT_DESK_CARDS[view];
      // Raised over the sitter, so centred on their seat (the middle of the desk, or right of it on its side).
      const seat = grid.seats[0];
      const middle = seat ? left(seat.u * grid.width, 0) : grid.width / 2;
      return (
        <DeskCard
          text={hotDeskCard(sitters)}
          held={used}
          x={left(card.x, card.w)}
          w={card.w}
          h={card.h}
          y={hotDeskCardY(box, grid, sitters, card)}
          middle={middle}
        />
      );
    }
    case 'reception-desk': {
      const bell = RECEPTION_BELLS[view];
      return <BellRing id={id} cx={left(bell.cx, 0)} cy={bell.cy} />;
    }
    default:
      return null;
  }
}

// The belt's stripes running from the console toward the rear roller, clipped to the part of the belt in view; a CSS
// loop, still under reduced motion. From behind (the unturned treadmill) they run toward you, from the front away from
// you (drawn the same and flipped), and on its side along it, to the right (mirrored: to the left).
function RunningBelt({
  id,
  belt,
  along,
  reverse,
}: {
  id: string;
  // The belt in view, on the drawing as shown (mirrored already when facing right).
  belt: { x: number; y: number; w: number; h: number };
  // On its side: the stripes cross the belt and run along it.
  along: boolean;
  // Running up the canvas (the front) or to the left (the mirrored side).
  reverse: boolean;
}) {
  const { x, y, w, h } = belt;
  const clip = `lh-belt-${id}`;
  const stripes = along
    ? Array.from(
        { length: Math.ceil(w / 12) + 1 },
        (_, i) => `M${x - 12 + i * 12} ${y + 2}V${y + h - 2}`,
      ).join('')
    : Array.from(
        { length: Math.ceil(h / 12) + 1 },
        (_, i) => `M${x + 2} ${y - 12 + i * 12}H${x + w - 2}`,
      ).join('');
  const flip = !reverse
    ? undefined
    : along
      ? `translate(${2 * x + w} 0) scale(-1 1)`
      : `translate(0 ${2 * y + h}) scale(1 -1)`;
  return (
    <g aria-hidden data-belt-running={along ? 'along' : reverse ? 'away' : 'toward'}>
      <clipPath id={clip}>
        <rect x={x} y={y} width={w} height={h} rx={3} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <g transform={flip}>
          <path
            className={along ? 'lh-belt-run-along' : 'lh-belt-run'}
            d={stripes}
            stroke="#475569"
            strokeWidth={1.6}
            fill="none"
          />
        </g>
      </g>
    </g>
  );
}

// The booth's roof lamp, lit red while it is in use, with a soft glow (static).
function BoothLamp() {
  const { x, y, w, h } = PHONE_BOOTH_LAMP;
  return (
    <g aria-hidden data-booth-lamp="on">
      <rect
        x={x - 3}
        y={y - 2}
        width={w + 6}
        height={h + 4}
        rx={5}
        fill={T.lampOn}
        opacity={0.25}
      />
      <rect x={x} y={y} width={w} height={h} rx={3} fill={T.lampOn} />
      <path
        d={`M${x + 4} ${y + 2}H${x + w / 2}`}
        stroke="#ffffff"
        strokeWidth={1}
        opacity={0.6}
        strokeLinecap="round"
      />
    </g>
  );
}

// The name card: Hot Desk in a quieter grey on the desk's own card while free; while held, the card raised clear of
// the sitter's head (hotDeskCardY) with their name in dark ink, the desk's card left blank under it.
function DeskCard({
  text,
  held,
  x,
  w,
  h,
  y,
  middle,
}: {
  text: string;
  held: boolean;
  // The desk's own card on the drawing as shown.
  x: number;
  w: number;
  h: number;
  y: number;
  middle: number;
}) {
  if (!held)
    return (
      <text
        x={x + w / 2}
        y={y + h / 2 + 2.6}
        textAnchor="middle"
        fontSize={7}
        fontWeight={600}
        fill="#64748b"
        data-hot-desk-card="free"
      >
        {text}
      </text>
    );
  // Raised over the sitter, centred on their seat: wide enough for a twelve-character name.
  const raised = RAISED_CARD_W;
  return (
    <g data-hot-desk-card-at={y}>
      <rect
        x={middle - raised / 2}
        y={y}
        width={raised}
        height={h}
        rx={2}
        fill={T.card}
        stroke="#cbd5e1"
        strokeWidth={0.75}
      />
      <text
        x={middle}
        y={y + h / 2 + 2.8}
        textAnchor="middle"
        fontSize={7.5}
        fontWeight={700}
        fill="#0f172a"
        data-hot-desk-card="held"
      >
        {text}
      </text>
    </g>
  );
}
/** The raised card's width on the grid. */
const RAISED_CARD_W = 60;

// The bell ringing out: two waves from it, played again on each ring this screen hears (keyed on the count).
function BellRing({ id, cx, cy }: { id: string; cx: number; cy: number }) {
  const rings = useBellRings(id);
  // The last ring whose waves have played out: a newer one shows until its own timeout.
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (rings === 0) return;
    const t = setTimeout(() => setDone(rings), 1400);
    return () => clearTimeout(t);
  }, [rings]);
  const shown = rings !== done ? rings : 0;
  if (shown === 0) return null;
  return (
    <g
      key={shown}
      aria-hidden
      data-bell-ringing=""
      fill="none"
      stroke={T.brassDeep}
      strokeLinecap="round"
    >
      <circle className="lh-bell-wave" cx={cx} cy={cy} r={12} strokeWidth={1.6} />
      <circle className="lh-bell-wave lh-bell-wave-late" cx={cx} cy={cy} r={12} strokeWidth={1.2} />
    </g>
  );
}

// --- Faces over the box ---------------------------------------------------------------------------------------------

export function WorkdayFace({ element }: { element: ShapeElement }) {
  switch (element.shape) {
    case 'reception-desk':
      return <Welcome element={element} />;
    case 'pet-bed':
      return <PetDog element={element} />;
    default:
      return null;
  }
}

function BellGlyph() {
  return (
    <Glyph size={10} units={24}>
      <path d="M4 18h16M6 18a6 6 0 0 1 12 0M12 9V7M10 7h4" />
    </Glyph>
  );
}

// The Welcome bubble above a reception desk, for you while you stand at it, with the Ring Bell button.
function Welcome({ element }: { element: ShapeElement }) {
  const here = useAtReception(element.id);
  const rung = useBellRung();
  if (!here) return null;
  return (
    <Overlay element={element}>
      <span
        className="lh-welcome-bubble pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 flex items-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-slate-800 bg-white py-1 pl-2.5 pr-1 text-[10px] font-bold text-slate-800 shadow-md dark:border-slate-200 dark:bg-slate-900 dark:text-slate-100"
        style={{ transform: 'translateX(-50%)' }}
        role="status"
      >
        Welcome
        <button
          type="button"
          className="pointer-events-auto flex cursor-pointer items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-[2px] text-[9px] font-semibold text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-sky-500 disabled:cursor-default disabled:opacity-70 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
          aria-label={rung ? 'Bell rung' : 'Ring the bell'}
          disabled={rung}
          {...pieceControlProps}
          onClick={(e) => {
            e.stopPropagation();
            ringBell(element.id);
          }}
        >
          <BellGlyph />
          {rung ? 'Rang' : 'Ring Bell'}
        </button>
      </span>
    </Overlay>
  );
}

// --- The office dog -------------------------------------------------------------------------------------------------

// The dog's drawing box, in canvas px, and where its feet are in it.
const DOG_W = 44;
const DOG_H = 32;
const DOG_FEET = { x: 22, y: 30 };
const PAT_MS = 1500;

/** The leg the dog is on now, ticking once a leg (one timer per dog); never under reduced motion. */
function usePetLeg(still: boolean): number {
  const [leg, setLeg] = useState(() => petLegAt(Date.now()));
  useEffect(() => {
    if (still) return;
    let t: ReturnType<typeof setTimeout>;
    const arm = () => {
      t = setTimeout(
        () => {
          setLeg(petLegAt(Date.now()));
          arm();
        },
        msToNextLeg(Date.now()) + 20,
      );
    };
    arm();
    return () => clearTimeout(t);
  }, [still]);
  return leg;
}

/** Where the dog's feet go on a leg, relative to the bed's box: its spot, or its bed (null spot). */
export function dogOffset(
  bed: { id: string; x: number; y: number; width: number; height: number },
  area: PetArea | null,
  leg: number,
): { x: number; y: number; asleep: boolean } {
  const home = { x: bed.width / 2, y: bed.height * 0.72, asleep: true };
  if (!area) return home;
  const spot = petLeg(bed.id, leg, area);
  if (!spot) return home;
  return { x: spot.x - bed.x, y: spot.y - bed.y, asleep: false };
}

function PetDog({ element }: { element: ShapeElement }) {
  // Reduced motion sends a trotting dog straight back to sleep in its bed.
  const still = useReducedMotion();
  const area = usePetArea(element.id);
  const leg = usePetLeg(still);
  const at = still ? dogOffset(element, null, 0) : dogOffset(element, area, leg);
  // Which way it faces: the way it last trotted.
  const last = useRef(at.x);
  const [facingLeft, setFacingLeft] = useState(false);
  useEffect(() => {
    if (Math.abs(at.x - last.current) > 1) setFacingLeft(at.x < last.current);
    last.current = at.x;
  }, [at.x]);
  const [pat, setPat] = useState(0);
  useEffect(() => {
    if (pat === 0) return;
    const t = setTimeout(() => setPat(0), PAT_MS);
    return () => clearTimeout(t);
  }, [pat]);
  return (
    <div
      className="lh-pet-trot pointer-events-none absolute left-0 top-0"
      style={{
        width: DOG_W,
        height: DOG_H,
        transform: `translate(${at.x - DOG_FEET.x}px, ${at.y - DOG_FEET.y}px)`,
      }}
      data-pet={at.asleep ? 'asleep' : 'awake'}
    >
      <button
        type="button"
        aria-label="Pat the Dog"
        className="pointer-events-auto absolute inset-0 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-sky-500"
        {...pieceControlProps}
        onClick={(e) => {
          e.stopPropagation();
          track('Canvas', 'Used', 'PatPet');
          setPat((n) => n + 1);
        }}
      >
        <DogDrawing asleep={at.asleep} facingLeft={facingLeft} patted={pat > 0} />
      </button>
      {pat > 0 ? (
        <span
          key={pat}
          aria-hidden
          className="lh-pet-heart pointer-events-none absolute -top-2 left-1/2 text-[13px] leading-none text-rose-500"
          style={{ transform: 'translate(-50%, -14px)' }}
          data-pet-heart=""
        >
          ♥
        </span>
      ) : null}
    </div>
  );
}

// A small sandy dog side on: body, head with a darker ear, snout and nose, legs, a red collar and a wagging tail. Asleep
// it curls up with its head on its paws and breathes.
function DogDrawing({
  asleep,
  facingLeft,
  patted,
}: {
  asleep: boolean;
  facingLeft: boolean;
  patted: boolean;
}) {
  const light = '#f0d2a8';
  return (
    <svg
      viewBox={`0 0 ${DOG_W} ${DOG_H}`}
      className="absolute inset-0 h-full w-full overflow-visible"
      aria-hidden
    >
      <g transform={facingLeft ? `translate(${DOG_W} 0) scale(-1 1)` : undefined}>
        <ellipse cx={22} cy={30} rx={asleep ? 15 : 13} ry={2} fill="#000" opacity={0.14} />
        {asleep ? (
          <>
            <path
              d="M8 26C4 22 8 16 14 17"
              stroke={T.dog}
              strokeWidth={2.6}
              fill="none"
              strokeLinecap="round"
            />
            <ellipse className="lh-pet-breathe" cx={21} cy={23} rx={13} ry={6.5} fill={T.dog} />
            <ellipse cx={32} cy={25} rx={6} ry={4.6} fill={T.dog} />
            <ellipse cx={36.5} cy={26.2} rx={3} ry={2.2} fill={light} />
            <circle cx={39.2} cy={25.6} r={1.1} fill={T.dogNose} />
            <path d="M29 21.5Q27 26 30 28Q32 25 31.5 21.5Z" fill={T.dogDeep} />
            <path
              d="M32.5 23.8q1.4 0.9 2.8 0"
              stroke={T.dogNose}
              strokeWidth={0.8}
              fill="none"
              strokeLinecap="round"
            />
            <text x={36} y={14} fontSize={6} fontWeight={700} fill="#64748b">
              z
            </text>
          </>
        ) : (
          <>
            <path
              className={`lh-pet-tail${patted ? ' lh-pet-tail-fast' : ''}`}
              d="M10 16Q4.5 11 6 5"
              stroke={T.dog}
              strokeWidth={2.6}
              fill="none"
              strokeLinecap="round"
            />
            <rect x={11} y={20} width={2.8} height={9} rx={1.2} fill={T.dogDeep} />
            <rect x={25} y={20} width={2.8} height={9} rx={1.2} fill={T.dogDeep} />
            <ellipse cx={20} cy={18} rx={11.5} ry={6.5} fill={T.dog} />
            <rect x={14.5} y={20} width={2.8} height={9.5} rx={1.2} fill={T.dog} />
            <rect x={28.5} y={20} width={2.8} height={9.5} rx={1.2} fill={T.dog} />
            <path d="M29 9.5L30.6 18" stroke="#ef4444" strokeWidth={1.8} strokeLinecap="round" />
            <circle cx={34} cy={11} r={6.2} fill={T.dog} />
            <ellipse cx={39.6} cy={13} rx={3.4} ry={2.5} fill={light} />
            <circle cx={42.4} cy={12.2} r={1.2} fill={T.dogNose} />
            <circle cx={35.6} cy={9.6} r={1} fill={T.dogNose} />
            <path d="M30 5.5Q27 12 30.5 15.5Q33 11 32 5.5Z" fill={T.dogDeep} />
          </>
        )}
      </g>
    </svg>
  );
}
