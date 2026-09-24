import { EVENT_STORMING_NOTES, type EventStormingNoteKind } from '@livediagram/diagram';
import { hexToRgb, hueDistance, rgbToHsv, type Hsv } from './colour';
import { DEFAULT_FLOORS, FLOOR_CALIBRATION, VALUE_FLOOR, type PaperFloors } from './floors';

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

// The hue BANDS, per kind.
//
// The catalogue fills are the prior, not the truth: real paper under real light
// lands a long way from a swatch. The greens on the operator's wall measure
// h≈86 where the catalogue's read-model is h≈137, and every band below is
// widened to the measured reality rather than to the hex. Where two kinds share
// a hue (the two yellows, and pink) saturation decides — see below.
//
// `from`/`to` walk clockwise round the circle, so a band may wrap through 0.
type HueBand = { kind: EventStormingNoteKind; from: number; to: number };

const HUE_BANDS: HueBand[] = [
  // Orange paper. Starts at 12 so the red-pink hotspot keeps its own ground.
  { kind: 'domain-event', from: 12, to: 44 },
  // Yellow: actor vs aggregate, split by saturation below.
  { kind: 'actor', from: 44, to: 70 },
  // Green, from the yellow-greens a warm room produces to a proper green.
  { kind: 'read-model', from: 70, to: 175 },
  // Blue.
  { kind: 'command', from: 185, to: 250 },
  // Purple. Runs to 305 because the pale lilac the operator's wall uses for a
  // policy measures h≈300 — a swatch would have said 280.
  { kind: 'policy', from: 250, to: 305 },
  // Pink, ALL of it: the operator's walls use pink for hotspots, and the
  // catalogue's external-system pink cannot be told from it in a photograph —
  // both are pink paper, and the pale one the catalogue uses is too pale to
  // clear the paper floor at all on a kraft wall. Hotspot wins; an
  // external-system read as a hotspot is re-kinded in the draft, which is one
  // click, and the alternative is a hotspot read as an external system, which
  // is a risk nobody flagged. See spec/139.
  { kind: 'hotspot', from: 305, to: 12 },
];

// A pale yellow is an aggregate; a saturated one is an actor (Q18). They sit a
// couple of degrees apart in hue, so saturation is the whole distinction: the
// catalogue's own values are 0.23 (aggregate) and 0.46 (actor), and the line
// goes midway between them.
const PALE_YELLOW_MAX_SATURATION = 0.34;
// The two yellows.
const YELLOW_KINDS = new Set<EventStormingNoteKind>(['actor', 'aggregate']);

// The catalogue's own fills, as HSV. Kept because the bands above are a
// widening OF these — a test asserts every catalogue fill still lands on its
// own kind, so a change to a hex that walks out of its band is caught.
export type PaperClass = {
  kind: EventStormingNoteKind;
  hue: number;
  saturation: number;
  value: number;
};

export const PAPER_CLASSES: PaperClass[] = EVENT_STORMING_NOTES.map((note) => {
  const hsv = rgbToHsv(hexToRgb(note.fill));
  return { kind: note.kind, hue: hsv.h, saturation: hsv.s, value: hsv.v };
});

// Near the WALL's own hue a pixel has to be properly saturated to be paper:
// brown kraft and an orange domain event are the same hue, and only the wall's
// dullness separates them.
const WALL_HUE_NEIGHBOURHOOD_DEG = 34;
// Far from it, much less is needed — a pale purple policy on a brown wall is
// unmistakably not the wall, at any saturation the eye can see. Tuned on the
// eight hand-labelled walls: 0.18 lost a whiteboard's greyish aggregates and
// pale lilac policies (saturation 0.17 to 0.19 as photographed) and the soft
// fringes of its orange notes, and 0.10 to 0.12 brought them back without
// costing a kraft wall. The middle of that band rather than its best point:
// 0.12 alone scored higher, as a lone spike on eight photos tends to.
const OFF_HUE_MIN_SATURATION = 0.11;

function inBand(hue: number, band: HueBand): boolean {
  return band.from <= band.to
    ? hue >= band.from && hue < band.to
    : hue >= band.from || hue < band.to;
}

export function classifyHsv(hsv: Hsv, floors: PaperFloors = DEFAULT_FLOORS): PixelClass {
  if (hsv.v < VALUE_FLOOR) return 'ink';
  if (hsv.v < floors.value) return 'wall';
  // How saturated a pixel must be to be paper depends on whether it shares the
  // wall's hue. Kraft and orange are the same colour, differing only in how
  // dull the wall is; a purple is not the wall at any saturation.
  const nearWallHue =
    floors.wallHue >= 0 && hueDistance(hsv.h, floors.wallHue) <= WALL_HUE_NEIGHBOURHOOD_DEG;
  const needed = nearWallHue
    ? floors.saturation
    : Math.min(floors.saturation, OFF_HUE_MIN_SATURATION);
  if (hsv.s < needed) return 'wall';

  const band = HUE_BANDS.find((b) => inBand(hsv.h, b));
  if (!band) return 'unknown';

  // Actor and aggregate are both yellow paper; only the saturation tells them
  // apart (Q18).
  if (YELLOW_KINDS.has(band.kind)) {
    return hsv.s <= PALE_YELLOW_MAX_SATURATION ? 'aggregate' : 'actor';
  }
  return band.kind;
}

export { HUE_BANDS };

export function classifyRgb(
  r: number,
  g: number,
  b: number,
  floors: PaperFloors = DEFAULT_FLOORS,
): PixelClass {
  return classifyHsv(rgbToHsv({ r, g, b }), floors);
}

export const CALIBRATION = {
  HUE_BANDS,
  OFF_HUE_MIN_SATURATION,
  WALL_HUE_NEIGHBOURHOOD_DEG,
  PALE_YELLOW_MAX_SATURATION,
  // How the floors themselves are measured lives in `floors.ts`, next to the
  // code that uses each number; the whole calibrated table is here.
  ...FLOOR_CALIBRATION,
} as const;
