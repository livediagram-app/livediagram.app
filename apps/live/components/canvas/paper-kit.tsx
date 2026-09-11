'use client';

// The paper kit: the textures that give each Behaviours element the look of a
// particular OBJECT rather than of a generic card (spec/122).
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
// the tab theme still owns the palette (spec/29), and a pink board stays a
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

/** A soft lift under the whole card, so it reads as an object on a surface. */
export function paperShadow(textColor: string): string {
  return `0 1px 0 ${tint(textColor, 0.06)}, 0 6px 14px -8px ${tint(textColor, 0.5)}`;
}

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

/**
 * A strip of tape across a corner, rotated off-axis.
 *
 * Deliberately crooked and translucent: tape applied by a person is never
 * square to the sheet, and tape you cannot see through reads as a coloured bar
 * somebody drew on purpose.
 *
 * Positioned to sit ACROSS the corner with its ends running off the edges. The
 * first version hung the whole strip outside the box, where the card's own
 * `overflow-hidden` clipped every pixel of it and the seal simply never
 * appeared. Its ends are still clipped, which is the point — tape goes over an
 * edge and round the back.
 */
export function TapeStrip({
  textColor,
  // Top-LEFT by default. Every Behaviours element now carries its settings
  // `…` in the top-right corner (spec/09), so tape there lands under the one
  // control on the card.
  corner = 'top-left',
  width = 66,
}: {
  textColor: string;
  corner?: 'top-left' | 'top-right';
  width?: number;
}) {
  const left = corner === 'top-left';
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        // Far enough in that the middle of the strip lands on the corner, so
        // what survives the clip is a band lying over it.
        top: 4,
        ...(left ? { left: -width / 3 } : { right: -width / 3 }),
        width,
        height: 17,
        transform: `rotate(${left ? -45 : 45}deg)`,
        background: tint(textColor, 0.2),
        // The torn ends: a straight-cut edge reads as a sticker, not as tape.
        clipPath:
          'polygon(0% 0%, 8% 22%, 0% 48%, 6% 76%, 0% 100%, 100% 100%, 94% 74%, 100% 50%, 93% 24%, 100% 0%)',
        // Two hairlines along the length: the edges of a strip lifting off.
        boxShadow: `inset 0 1px 0 ${tint(textColor, 0.1)}, inset 0 -1px 0 ${tint(textColor, 0.1)}`,
      }}
    />
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
 * A ring binder down the left edge: holes punched through the sheet with the
 * wire loops threaded through them.
 *
 * This replaced a punched margin plus a separate clip across the top. The clip
 * was the wrong object — the sheet was already punched and ruled like a page
 * out of a binder, and a clipboard's jaw on top of that is two different ways
 * of holding the same paper. Rings agree with the holes that were already
 * there.
 *
 * Each ring is drawn in three parts because that is what sells it: the hole,
 * the BACK of the loop (behind the sheet, so it is dimmed and clipped by the
 * page edge) and the FRONT of the loop crossing over the margin. A single
 * stroked circle reads as a drawn O.
 */
export function BinderRings({
  textColor,
  surface,
  count = 4,
}: {
  textColor: string;
  surface: string;
  count?: number;
}) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[22px]">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="absolute left-0 right-0"
          style={{ top: `${((i + 1) / (count + 1)) * 100}%`, height: 0 }}
        >
          {/* The punched hole. Surface-coloured so it is an opening. */}
          <span
            className="absolute left-[11px] h-[8px] w-[8px] -translate-x-1/2 rounded-full"
            style={{
              top: -4,
              background: surface,
              boxShadow: `inset 0 1px 1px ${tint(textColor, 0.3)}`,
            }}
          />
          {/* The loop, crossing the margin and passing behind the sheet on the
              right. Open at the right so it reads as wire rather than a ring
              printed on the page. */}
          <span
            className="absolute rounded-full"
            style={{
              left: 2,
              top: -7,
              width: 19,
              height: 14,
              border: `2px solid ${tint(textColor, 0.34)}`,
              borderRightColor: 'transparent',
            }}
          />
        </span>
      ))}
    </span>
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
