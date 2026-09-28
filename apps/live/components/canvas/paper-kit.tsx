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
