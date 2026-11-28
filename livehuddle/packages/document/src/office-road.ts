// The Road (docs/specs/009-elements/road.md): a two-lane street drawn to its size out of doors, asphalt between two
// kerbs with a dashed centre line, the lanes running along its longer side. Its drawing is a table of parts in the
// furniture's vocabulary, which both renderers paint (the editor's RoadView and svg-render-faces). The cars are the 3D
// view's alone (apps/editor road-traffic). Pure: no React, no DOM.

import type { FurniturePart } from './seating';
import { path, rect } from './furniture-parts';
import { gravelSpecks } from './garden-ground';

export { ROAD_FILL, ROAD_FILL_DARK } from './road-fill';

/** What keeps its colour whatever the theme: the kerb stone and the centre line's paint. */
export const ROAD_TONES = {
  kerb: '#d9d5cc',
  kerbFace: '#0000002e',
  line: '#f5f5f0',
  edge: '#ffffff59',
  speckLight: '#ffffff14',
  speckDark: '#0000001f',
} as const;

/** The kerb's band along each long side, canvas px (a tenth of the road's width when that is less). */
export const ROAD_KERB = 8;
/** The centre line's dashes: thickness, length and the gap between, canvas px (the same however long the road). */
export const ROAD_DASH = { thick: 3, long: 24, gap: 20 } as const;
/** The edge line's inset from each kerb and its thickness. */
const EDGE_INSET = 3;
const EDGE_THICK = 1.5;
/** The kerb's shaded face along its road side. */
const KERB_FACE = 2;

/** Which way a road runs and its two sizes: the lanes run along its longer side. */
export function roadRun(width: number, height: number) {
  const horizontal = width >= height;
  return {
    horizontal,
    length: horizontal ? width : height,
    across: horizontal ? height : width,
  };
}

/** The kerb's band on a road `across` wide. */
export function roadKerb(across: number): number {
  return Math.min(ROAD_KERB, across / 10);
}

/** Where along the road each centre dash starts: whole dashes, evenly spaced and centred, none if it cannot fit one. */
export function roadDashes(length: number): number[] {
  const { long, gap } = ROAD_DASH;
  if (length < long) return [];
  const n = Math.floor((length + gap) / (long + gap));
  const start = (length - (n * long + (n - 1) * gap)) / 2;
  return Array.from({ length: n }, (_, i) => start + i * (long + gap));
}

/** A rect along the road's length: `from`/`to` along it, `a0`/`a1` across it, laid the road's way round. */
function along(
  horizontal: boolean,
  role: FurniturePart['role'],
  from: number,
  to: number,
  a0: number,
  a1: number,
  fill: string,
): FurniturePart {
  return horizontal
    ? rect(role, from, a0, to - from, a1 - a0, 0, fill)
    : rect(role, a0, from, a1 - a0, to - from, 0, fill);
}

/** The road's drawing at its size: the asphalt (the element's fill), its speckle, the lines and the two kerbs. */
export function roadParts(width: number, height: number): FurniturePart[] {
  if (width <= 0 || height <= 0) return [];
  const { horizontal, length, across } = roadRun(width, height);
  const kerb = roadKerb(across);
  const parts: FurniturePart[] = [rect('floor', 0, 0, width, height, 0)];
  // The asphalt's grain: light and dark specks over the carriageway between the kerbs.
  const inside = (x: number, y: number) => {
    const a = horizontal ? y : x;
    return a > kerb && a < across - kerb;
  };
  const { light, dark } = gravelSpecks(width, height, Math.round(width * 5 + height), inside);
  if (dark) parts.push(path('mark', dark, ROAD_TONES.speckDark));
  if (light) parts.push(path('mark', light, ROAD_TONES.speckLight));
  // A fine edge line just inside each kerb.
  for (const a of [kerb + EDGE_INSET, across - kerb - EDGE_INSET - EDGE_THICK])
    parts.push(along(horizontal, 'mark', 0, length, a, a + EDGE_THICK, ROAD_TONES.edge));
  // The dashed centre line.
  const mid = across / 2 - ROAD_DASH.thick / 2;
  for (const d of roadDashes(length))
    parts.push(
      along(horizontal, 'mark', d, d + ROAD_DASH.long, mid, mid + ROAD_DASH.thick, ROAD_TONES.line),
    );
  // The kerbs: lit stone, a shaded face where each drops to the road.
  parts.push(along(horizontal, 'panel', 0, length, 0, kerb, ROAD_TONES.kerb));
  parts.push(along(horizontal, 'panel', 0, length, across - kerb, across, ROAD_TONES.kerb));
  if (kerb > KERB_FACE * 2) {
    parts.push(
      along(horizontal, 'mark', 0, length, kerb - KERB_FACE, kerb, ROAD_TONES.kerbFace),
      along(
        horizontal,
        'mark',
        0,
        length,
        across - kerb,
        across - kerb + KERB_FACE,
        ROAD_TONES.kerbFace,
      ),
    );
  }
  return parts;
}
