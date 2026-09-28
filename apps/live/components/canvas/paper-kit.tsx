'use client';

// The paper kit: the textures that give each Behaviours element the look of a
// particular OBJECT rather than of a generic card (docs/specs/012-collaboration/participant-responses.md).
//
// Being retired, element by element: the collab boards moved onto the Q&A
// board's flat, accent-lit look, and their textures went with them. What is
// left serves the three elements that have not moved yet (the Picker's reel
// window, the Mode button's keycap edge, the Timer's dial ticks).
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
