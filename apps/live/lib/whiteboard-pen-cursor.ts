// The cursor while a whiteboard pen is in hand (docs/specs/023-whiteboard/whiteboard.md "Pens"): it
// marks exactly where ink lands, in the pen's own colour, with a rim in the board's colour so it
// reads on either board. Five candidate looks, one chosen by the operator.

export type PenCursorVariant = 'dot' | 'ring' | 'crosshair' | 'nib' | 'nib-crosshair';
export const PEN_CURSOR_VARIANTS: readonly PenCursorVariant[] = [
  'dot',
  'ring',
  'crosshair',
  'nib',
  'nib-crosshair',
];

type Look = { svg: string; size: number; hotspot: [number, number] };

function look(variant: PenCursorVariant, colour: string, rim: string): Look {
  switch (variant) {
    // A solid dot at the tip: the ink, as it will land.
    case 'dot':
      return {
        size: 16,
        hotspot: [8, 8],
        svg: `<circle cx='8' cy='8' r='3.25' fill='${colour}' stroke='${rim}' stroke-width='1.5' />`,
      };
    // A hollow ring with a pinpoint centre: never hides the line under it.
    case 'ring':
      return {
        size: 20,
        hotspot: [10, 10],
        svg:
          `<circle cx='10' cy='10' r='6' fill='none' stroke='${rim}' stroke-width='3' />` +
          `<circle cx='10' cy='10' r='6' fill='none' stroke='${colour}' stroke-width='1.5' />` +
          `<circle cx='10' cy='10' r='1' fill='${colour}' />`,
      };
    // A gapped crosshair: precise, with the centre left clear.
    case 'crosshair':
      return {
        size: 24,
        hotspot: [12, 12],
        svg:
          `<path d='M12 3 V9 M12 15 V21 M3 12 H9 M15 12 H21' stroke='${rim}' stroke-width='3.5' stroke-linecap='round' />` +
          `<path d='M12 3 V9 M12 15 V21 M3 12 H9 M15 12 H21' stroke='${colour}' stroke-width='1.5' stroke-linecap='round' />`,
      };
    // A pen whose tip is the hotspot: reads as "drawing" at a glance.
    case 'nib':
      return {
        size: 24,
        hotspot: [2, 22],
        svg:
          `<path d='M2 22 L4 16 L17 3 L21 7 L8 20 Z' fill='${rim}' stroke='${rim}' stroke-width='3' stroke-linejoin='round' />` +
          `<path d='M2 22 L4 16 L17 3 L21 7 L8 20 Z' fill='none' stroke='${colour}' stroke-width='1.5' stroke-linejoin='round' />` +
          `<path d='M2 22 L4 16 L8 20 Z' fill='${colour}' />`,
      };
    // Today's cursor: a crosshair at the tip, a nib and a dot of the pen's colour beside it.
    case 'nib-crosshair':
      return {
        size: 28,
        hotspot: [4, 4],
        svg:
          `<path d='M0 4 H8 M4 0 V8' stroke='white' stroke-width='3' stroke-linecap='round' />` +
          `<path d='M0 4 H8 M4 0 V8' stroke='black' stroke-width='1.5' stroke-linecap='round' />` +
          `<path d='M14 22 L20 16 L23 19 L17 25 Z M20 16 L22 14' stroke='black' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' fill='none' />` +
          `<circle cx='23.5' cy='12.5' r='3' fill='${colour}' stroke='white' stroke-width='1' />`,
      };
  }
}

/** The SVG image of a pen cursor, for the cursor itself and for showing the variants. */
export function penCursorSvg(variant: PenCursorVariant, colour: string, rim: string): Look {
  const { svg, size, hotspot } = look(variant, colour, rim);
  return {
    size,
    hotspot,
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${svg}</svg>`,
  };
}

/** The CSS `cursor` value, with the system crosshair as the fallback. */
export function penCursor(variant: PenCursorVariant, colour: string, rim: string): string {
  const { svg, hotspot } = penCursorSvg(variant, colour, rim);
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${hotspot[0]} ${hotspot[1]}, crosshair`;
}
