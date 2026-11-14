'use client';

import { useEffect, useState } from 'react';
import {
  HOT_DESK_CARD,
  HOT_DESK_CARDS,
  PHONE_BOOTH_LAMP,
  RECEPTION_BELLS,
  TREADMILL_BELTS,
  WORKDAY_TONES,
  facingView,
  type ShapeElement,
} from '@livehuddle/document';
import type { SeatFacing } from '@livehuddle/avatar/facing';
import { Glyph } from '@livehuddle/ui';
import { seatPillBottom } from '@livehuddle/avatar/chair-sitters';
import { drawnRect, type SeatGrid } from '@livehuddle/avatar/seats';
import { pieceControlProps } from '@/lib/piece-control';
import { ringBell, useBellRings, useBellRung } from '@/lib/office/reception-bell';
import { useAtReception, useReceptionBubbleBelow } from '@/lib/office/useWorkdayPieces';
import { pieceBubbleSide, pieceBubbleStyle } from '@/lib/piece-bubble-style';
import { Overlay } from './SocialFaces';
import type { ChairSitter } from './FurnitureView';
import { PetDog } from './OfficeDog';

export { dogOffset } from './OfficeDog';

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
  // Below the desk when a Room Sign stands where the bubble rises (Work Tracker 793).
  const below = useReceptionBubbleBelow(element.id);
  const rung = useBellRung();
  if (!here) return null;
  return (
    <Overlay element={element}>
      <span
        data-bubble-below={below ? '' : undefined}
        className={`lh-welcome-bubble pointer-events-none absolute ${pieceBubbleSide(below)} left-1/2 flex items-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-slate-800 bg-white py-1 pl-2.5 pr-1 text-[10px] font-bold text-slate-800 shadow-md dark:border-slate-200 dark:bg-slate-900 dark:text-slate-100`}
        style={pieceBubbleStyle(below)}
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
