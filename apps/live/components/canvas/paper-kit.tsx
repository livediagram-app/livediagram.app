'use client';

// The paper kit: the textures that give each Behaviours element the look of a
// particular OBJECT rather than of a generic card (docs/specs/012-collaboration/participant-responses.md).
//
// Why this exists
// ---------------
// Every one of these elements rendered as the same rounded rectangle with a
// title and some controls, so a board of them read as one repeated component
// in thirteen sizes. The thing each of them IS — a clipboard, a ballot box, a
// ticket stub, a stamped record — was carried entirely by the words on it.
//
// Everything here is built from `tint(textColor, alpha)`, so a card is drawn
// in ITS OWN colour. That is the constraint the whole kit is designed around:
// the tab theme still owns the palette (docs/specs/011-theme/multicolour-themes.md), and a pink board stays a
// pink board. The distinction between kinds comes from FORM — a folded corner,
// a torn edge, a punched margin, a rotated stamp — which survives any hue,
// any theme, and light or dark mode, none of which a per-kind colour would.
//
// House rules for anything added here
// -----------------------------------
//  - Decorative, so `aria-hidden` and `pointer-events-none` without exception:
//    these sit over a card whose controls must stay clickable.
//  - Absolutely positioned against the card's own padding box, so a texture
//    can never change the layout it decorates.
//  - Built from `tint`, never from a Tailwind colour class — see the note on
//    `tint` itself for what goes wrong when app dark-mode and tab theme fight.
//  - No animation. These are the surface an element is printed on; a board of
//    thirteen moving textures is a board nobody can read.

import { tint } from '@/lib/element-tint';

/**
 * A turned-up corner: the triangle of backing showing through, plus the flap
 * of paper curling off it.
 *
 * Drawn at the BOTTOM-RIGHT rather than the top, where the `…` and the title
 * live — a fold under the title clipped the first row of every card it was
 * tried on.
 */
export function FoldedCorner({
  textColor,
  size = 22,
}: {
  textColor: string;
  /** The fold's leg length, in design px. */
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-0 right-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
        {/* The hole the flap has turned out of: darker, because you are
            looking past the sheet at what is under it. */}
        <path d="M24 0 L24 24 L0 24 Z" fill={tint(textColor, 0.14)} />
        {/* The flap itself, lighter and lifted off the hole by its own edge. */}
        <path d="M24 24 L0 24 L24 0 Z" fill={tint(textColor, 0.07)} />
        <path d="M0 24 L24 0" stroke={tint(textColor, 0.22)} strokeWidth={1} fill="none" />
      </svg>
    </span>
  );
}

/** How many teeth a torn edge shows across a card of the default width. */
const TEAR_TEETH = 26;

/**
 * A torn bottom edge — the card ends by being ripped off rather than by
 * stopping.
 *
 * A clip-path on the card itself would take the footer buttons with it, so
 * this paints the NEGATIVE: a strip of the surrounding background sitting over
 * the card's last few pixels. It needs the surface colour behind the card to
 * do that, which is why `surface` is required rather than optional.
 */
export function TornEdge({
  textColor,
  surface,
  height = 7,
}: {
  textColor: string;
  /** The colour showing THROUGH the tear — the element's own fill. */
  surface: string;
  height?: number;
}) {
  const teeth = Array.from({ length: TEAR_TEETH }, (_, i) => {
    const x = (i / TEAR_TEETH) * 100;
    const w = 100 / TEAR_TEETH;
    // Alternating depth, so the rip is uneven the way a real one is.
    const deep = i % 2 === 0 ? 100 : 62;
    return `${x}% 0%, ${x + w / 2}% ${deep}%, ${x + w}% 0%`;
  }).join(', ');
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height,
          background: surface,
          clipPath: `polygon(${teeth}, 100% 100%, 0% 100%)`,
        }}
      />
      {/* A hairline of shadow along the rip, so the tear has a thickness. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0"
        style={{
          bottom: height - 1,
          height: 1,
          background: tint(textColor, 0.16),
        }}
      />
    </>
  );
}

/**
 * A perforated line — the fold a ticket is torn along.
 *
 * Horizontal by default; `vertical` for a stub down one side.
 */
export function Perforation({
  textColor,
  vertical = false,
  at,
}: {
  textColor: string;
  vertical?: boolean;
  /** Distance from the top (or left, when vertical), in design px. */
  at: number;
}) {
  const dash = `repeating-linear-gradient(${vertical ? 180 : 90}deg, ${tint(
    textColor,
    0.28,
  )} 0 3px, transparent 3px 7px)`;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute"
      style={
        vertical
          ? { top: 0, bottom: 0, left: at, width: 1, backgroundImage: dash }
          : { left: 0, right: 0, top: at, height: 1, backgroundImage: dash }
      }
    />
  );
}

/**
 * A rubber stamp: rotated, double-ruled, wide-tracked capitals.
 *
 * Rotation is the whole effect. Square to the card it is a badge; a few
 * degrees off and it is something a person pressed onto the page.
 */
export function Stamp({
  textColor,
  children,
  rotate = -8,
  strength = 1,
}: {
  textColor: string;
  children: React.ReactNode;
  rotate?: number;
  /** 0-1, for a stamp that has been pressed lightly (an undecided record). */
  strength?: number;
}) {
  const ink = tint(textColor, 0.55 * strength);
  return (
    <span
      aria-hidden
      className="pointer-events-none inline-flex items-center justify-center rounded-[3px] px-2 py-[3px] text-[10px] font-extrabold uppercase leading-none tracking-[0.18em]"
      style={{
        color: ink,
        transform: `rotate(${rotate}deg)`,
        // Double rule: the outer ring of a real stamp plus the inner one.
        boxShadow: `0 0 0 2px ${ink}, 0 0 0 3.5px transparent, 0 0 0 4.5px ${tint(
          textColor,
          0.2 * strength,
        )}`,
        // The ink never lands evenly — a faint halftone breaks the fill up.
        backgroundImage: `radial-gradient(${tint(textColor, 0.1 * strength)} 0.5px, transparent 0.6px)`,
        backgroundSize: '3px 3px',
      }}
    >
      {children}
    </span>
  );
}

/** A dot screen over the whole card, the way cheap print lays colour down. */
export function Halftone({ textColor, size = 3 }: { textColor: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
      style={{
        backgroundImage: `radial-gradient(${tint(textColor, 0.11)} 0.5px, transparent 0.6px)`,
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  );
}

/** Feint rules, the way a notebook page is printed. */
export function RuledLines({
  textColor,
  gap = 18,
  from = 0,
}: {
  textColor: string;
  gap?: number;
  /** Where the ruling starts, so it can sit under a heading. */
  from?: number;
}) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0"
      style={{
        top: from,
        backgroundImage: `repeating-linear-gradient(180deg, transparent 0 ${gap - 1}px, ${tint(
          textColor,
          0.09,
        )} ${gap - 1}px ${gap}px)`,
      }}
    />
  );
}

/**
 * The shaded window a reel spins behind: dark at the lip, clear in the middle,
 * so the names read as passing THROUGH an opening.
 */
export function ReelWindow({ textColor }: { textColor: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
      style={{
        background: `linear-gradient(180deg, ${tint(textColor, 0.16)} 0%, transparent 26%, transparent 74%, ${tint(
          textColor,
          0.16,
        )} 100%)`,
      }}
    />
  );
}

/**
 * The lid of a posting box, with the slot cut into it.
 *
 * The first version of this was one dark rounded bar near the top edge, which
 * read as a progress track somebody had misplaced. A slot is only a slot if it
 * is cut into SOMETHING, so the lid is drawn as its own band: a lighter top
 * face, a lip along its front edge where it overhangs the body, and the mouth
 * sunk into it with the shadow on the inside.
 *
 * `posted` tips a card half in, which is what tells you at a glance that the
 * box is not empty — better than the count, because you see it from the back
 * of the room.
 */
export function BoxLid({
  textColor,
  surface,
  height = 30,
  slotWidth = 108,
  posted = false,
}: {
  textColor: string;
  surface: string;
  height?: number;
  slotWidth?: number;
  /** Draw a card caught half-way through the slot. */
  posted?: boolean;
}) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0" style={{ height }}>
      {/* The lid's top face: lighter than the body, because it catches light. */}
      <span
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${tint(textColor, 0.04)}, ${tint(textColor, 0.13)})`,
        }}
      />
      {/* The lip, where the lid overhangs the box. The single line that makes
          the whole thing three-dimensional. */}
      <span
        className="absolute inset-x-0 bottom-0"
        style={{
          height: 4,
          background: tint(textColor, 0.3),
          boxShadow: `0 2px 3px -1px ${tint(textColor, 0.28)}`,
        }}
      />
      {/* The card, caught on its way in — drawn BEFORE the slot so the slot's
          own shadow falls across it. */}
      {posted ? (
        <span
          className="absolute left-1/2 rounded-[2px]"
          style={{
            top: height / 2 - 16,
            width: slotWidth - 26,
            height: 22,
            marginLeft: -(slotWidth - 26) / 2,
            background: surface,
            border: `1px solid ${tint(textColor, 0.2)}`,
            transform: 'rotate(-2.5deg)',
          }}
        />
      ) : null}
      {/* The mouth. Inset shadow along the top lip only: light comes from
          above, so that is the edge that casts into the opening. */}
      <span
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          top: height / 2 - 4,
          width: slotWidth,
          height: 9,
          background: tint(textColor, 0.55),
          boxShadow: `inset 0 2px 2px ${tint(textColor, 0.5)}, 0 1px 0 ${tint(textColor, 0.16)}`,
        }}
      />
    </span>
  );
}

/**
 * Corrugation: the flutes you see in the cut edge of cardboard.
 *
 * Vertical, close-pitched and very faint. It is doing the job a halftone was
 * doing on the idea box and doing it better — a halftone says "printed", and
 * a posting box is not printed, it is made out of a flattened carton.
 */
export function Corrugation({ textColor, from = 0 }: { textColor: string; from?: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-[inherit]"
      style={{
        top: from,
        backgroundImage: `repeating-linear-gradient(90deg, ${tint(textColor, 0.05)} 0 1px, transparent 1px 7px)`,
      }}
    />
  );
}

/**
 * The crosshatched back of a playing card.
 *
 * Two diagonal gratings crossed at right angles, the way a card back is
 * printed. Used behind an estimate card's answers before the reveal: the
 * values are face-down, and this is what face-down looks like.
 */
export function CardBack({ textColor, from = 0 }: { textColor: string; from?: number }) {
  const line = tint(textColor, 0.07);
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0"
      style={{
        top: from,
        backgroundImage: `repeating-linear-gradient(45deg, ${line} 0 1px, transparent 1px 6px), repeating-linear-gradient(-45deg, ${line} 0 1px, transparent 1px 6px)`,
      }}
    />
  );
}

/**
 * The tick plate of a dial instrument: a graduated scale with the fifths
 * called out taller, and a faint arc sweeping through them.
 *
 * A fist-of-five is a READING, not a tally — "how does the room feel" has a
 * needle answer, and a plate is what a needle is read against.
 */
export function GaugePlate({
  textColor,
  ticks = 21,
  height = 14,
}: {
  textColor: string;
  ticks?: number;
  height?: number;
}) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0"
      style={{ bottom: 8, height }}
    >
      {Array.from({ length: ticks }, (_, i) => {
        const major = i % 5 === 0;
        return (
          <span
            key={i}
            className="absolute bottom-0 w-px"
            style={{
              left: `${(i / (ticks - 1)) * 100}%`,
              height: major ? height : height * 0.5,
              background: tint(textColor, major ? 0.3 : 0.16),
            }}
          />
        );
      })}
    </span>
  );
}

/**
 * A vertical crease, the fold down the middle of a programme.
 *
 * A highlight beside a shadow — one line each — because that pair is the whole
 * illusion of a fold. Either on its own is a stray rule.
 */
export function FoldCrease({ textColor, at = '50%' }: { textColor: string; at?: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0"
      style={{
        left: at,
        width: 2,
        background: `linear-gradient(90deg, ${tint(textColor, 0.14)}, ${tint(textColor, 0.02)})`,
      }}
    />
  );
}

/**
 * Close diagonal hatching — the scratch panel over something not yet revealed.
 *
 * The Reveal zone's cover was a flat wash, which reads as "this element is
 * disabled". Hatching reads as a surface deliberately laid OVER something, and
 * that is the difference between a cover and a blank.
 */
export function Hatching({ textColor, pitch = 7 }: { textColor: string; pitch?: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
      style={{
        backgroundImage: `repeating-linear-gradient(-45deg, ${tint(
          textColor,
          0.14,
        )} 0 1.5px, transparent 1.5px ${pitch}px)`,
      }}
    />
  );
}

/**
 * The moulded edge of a keycap: a lit top, a shaded skirt, and the drop that
 * makes it stand off the board.
 *
 * Applied to a Selection Mode button, which is the one element here that IS a
 * key — you press it and a tool comes out.
 */
export function keycapEdge(textColor: string): React.CSSProperties {
  return {
    boxShadow: [
      `inset 0 1px 0 ${tint(textColor, 0.28)}`,
      `inset 0 -2px 0 ${tint(textColor, 0.14)}`,
      `inset 0 0 0 1px ${tint(textColor, 0.1)}`,
      `0 2px 0 ${tint(textColor, 0.16)}`,
    ].join(', '),
  };
}

/**
 * The tread of a floor pad: concentric rings out from the middle.
 *
 * A Reaction pad has two triggers — a click, and an Avatar-mode character
 * walking onto it — so it has to look like a thing you can stand on. Rings
 * from the centre are what a pressure pad looks like from above.
 */
export function PadTread({ textColor }: { textColor: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
      style={{
        backgroundImage: `repeating-radial-gradient(circle at 50% 42%, ${tint(
          textColor,
          0.07,
        )} 0 1px, transparent 1px 11px)`,
      }}
    />
  );
}

/**
 * A ring of minute ticks around a dial, with the quarters called out.
 *
 * Only the top arc is drawn, because the element is a wide pill rather than a
 * circle: ticks along the edge you read the digits against say "instrument",
 * ticks all the way round a rectangle say "border".
 */
export function DialTicks({ textColor, ticks = 24 }: { textColor: string; ticks?: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0"
      style={{ height: 8 }}
    >
      {Array.from({ length: ticks }, (_, i) => {
        const quarter = i % 6 === 0;
        return (
          <span
            key={i}
            className="absolute top-0 w-px"
            style={{
              left: `${(i / (ticks - 1)) * 100}%`,
              height: quarter ? 7 : 4,
              background: tint(textColor, quarter ? 0.3 : 0.16),
            }}
          />
        );
      })}
    </span>
  );
}
