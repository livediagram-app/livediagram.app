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
 * Deliberately slightly crooked and slightly translucent: tape applied by a
 * person is never square to the sheet, and tape you can't see through reads as
 * a coloured bar somebody drew on purpose.
 */
export function TapeStrip({
  textColor,
  corner = 'top-left',
  width = 54,
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
        top: -6,
        ...(left ? { left: -14 } : { right: -14 }),
        width,
        height: 16,
        transform: `rotate(${left ? -32 : 32}deg)`,
        background: tint(textColor, 0.1),
        // The torn ends: a straight-cut edge reads as a sticker, not as tape.
        clipPath:
          'polygon(0% 0%, 8% 22%, 0% 48%, 6% 76%, 0% 100%, 100% 100%, 94% 74%, 100% 50%, 93% 24%, 100% 0%)',
        boxShadow: `inset 0 0 0 1px ${tint(textColor, 0.06)}`,
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
 * A punched margin down the left edge — the holes a sheet hangs on.
 *
 * Drawn as real holes (the surface colour, ringed) rather than as dots, so the
 * card looks perforated instead of decorated.
 */
export function PunchedMargin({
  textColor,
  surface,
  count = 3,
}: {
  textColor: string;
  surface: string;
  count?: number;
}) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[18px]">
      <span
        className="absolute inset-y-0 right-0 w-px"
        style={{ background: tint(textColor, 0.12) }}
      />
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="absolute left-1/2 h-[7px] w-[7px] -translate-x-1/2 rounded-full"
          style={{
            top: `${((i + 1) / (count + 1)) * 100}%`,
            marginTop: -3.5,
            background: surface,
            boxShadow: `inset 0 0 0 1px ${tint(textColor, 0.22)}`,
          }}
        />
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
 * The metal clip of a clipboard, centred on the top edge.
 *
 * It overhangs the card deliberately — a clip that stopped at the border would
 * be a drawing of a clip, and this one is holding the sheet on.
 */
export function BoardClip({ textColor, width = 46 }: { textColor: string; width?: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 -translate-x-1/2"
      style={{ top: -5, width, height: 14 }}
    >
      <span
        className="absolute inset-0 rounded-[4px]"
        style={{
          background: tint(textColor, 0.16),
          boxShadow: `inset 0 -1px 0 ${tint(textColor, 0.16)}`,
        }}
      />
      <span
        className="absolute left-1/2 h-[5px] w-[14px] -translate-x-1/2 rounded-full"
        style={{ bottom: 2, background: tint(textColor, 0.28) }}
      />
    </span>
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

/** A posting slot: the mouth a ballot or an idea goes into. */
export function PostingSlot({ textColor, width = 92 }: { textColor: string; width?: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full"
      style={{
        top: 9,
        width,
        height: 7,
        background: tint(textColor, 0.42),
        boxShadow: `0 1px 0 ${tint(textColor, 0.14)}`,
      }}
    />
  );
}
