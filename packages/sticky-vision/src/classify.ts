import { EVENT_STORMING_NOTES, type EventStormingNoteKind } from '@livediagram/diagram';
import { hexToRgb, hueDistance, rgbToHsv, type Hsv } from './colour';

// Which note kind a pixel's colour belongs to (spec/139 Phase 8).
//
// The hue CENTRES are derived from the notation's own catalogue — the same
// `EVENT_STORMING_NOTES` fills the palette tiles and the template read from —
// because colour IS the notation here, and a second hand-written table of
// hues is how the detector ends up calling a policy an aggregate six months
// after somebody adjusts a hex.
//
// The BANDS and floors are not derivable: they are calibrated tolerances for
// paper under room light, and they live here as named constants.

export type PixelClass = EventStormingNoteKind | 'wall' | 'ink' | 'unknown';

// How far off the catalogue hue a pixel may be and still be that paper.
// Wide enough for a warm bulb and a cheap camera, narrow enough that orange
// (30°) and yellow (50°) do not collide.
const HUE_BAND_DEG = 14;
// Below this saturation a pixel is the wall, a shadow, or white paper the
// notation does not use.
const SATURATION_FLOOR = 0.18;
// Below this value it is ink, or a shadow deep enough to be unreadable.
const VALUE_FLOOR = 0.28;
// A pale yellow is an aggregate; a saturated one is an actor (Q18). They sit
// two degrees apart in hue, so hue cannot tell them apart at all — saturation
// is the whole distinction. The catalogue's own values are 0.23 (aggregate)
// and 0.46 (actor); the line goes midway between them, which leaves each about
// a tenth of headroom for the light in the room.
const PALE_YELLOW_MAX_SATURATION = 0.34;

export type PaperClass = {
  kind: EventStormingNoteKind;
  hue: number;
  saturation: number;
  value: number;
};

// One class per catalogue kind, built once at module load from the fills.
export const PAPER_CLASSES: PaperClass[] = EVENT_STORMING_NOTES.map((note) => {
  const hsv = rgbToHsv(hexToRgb(note.fill));
  return { kind: note.kind, hue: hsv.h, saturation: hsv.s, value: hsv.v };
});

// The two yellows, resolved by how pale the paper is rather than by hue.
const YELLOW_KINDS = new Set<EventStormingNoteKind>(['actor', 'aggregate']);

export function classifyHsv(hsv: Hsv): PixelClass {
  if (hsv.v < VALUE_FLOOR) return 'ink';
  if (hsv.s < SATURATION_FLOOR) return 'wall';

  let best: PaperClass | null = null;
  let bestDistance = Infinity;
  for (const paper of PAPER_CLASSES) {
    const d = hueDistance(hsv.h, paper.hue);
    if (d < bestDistance) {
      bestDistance = d;
      best = paper;
    }
  }
  if (!best || bestDistance > HUE_BAND_DEG) return 'unknown';

  // Actor and aggregate are both yellow paper; only the saturation tells them
  // apart, so whichever one the hue landed on, ask that question again.
  if (YELLOW_KINDS.has(best.kind)) {
    return hsv.s <= PALE_YELLOW_MAX_SATURATION ? 'aggregate' : 'actor';
  }
  return best.kind;
}

export function classifyRgb(r: number, g: number, b: number): PixelClass {
  return classifyHsv(rgbToHsv({ r, g, b }));
}

export const CALIBRATION = {
  HUE_BAND_DEG,
  SATURATION_FLOOR,
  VALUE_FLOOR,
  PALE_YELLOW_MAX_SATURATION,
} as const;
