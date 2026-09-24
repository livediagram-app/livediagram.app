import { EVENT_STORMING_NOTES, type EventStormingNoteKind } from '@livediagram/diagram';
import { hexToRgb, hueDistance, rgbToHsv, type Hsv } from './colour';
import { rgbToLabInto, type Lab } from './lab';
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
  // Green, from the yellow-greens a warm room produces to a proper green, and
  // on to where blue begins: a pale mint read model on kraft measures h≈173
  // to 182 as photographed, and a gap between the bands made that paper
  // nobody's. Anywhere from 180 to 185 finds it and moves nothing else.
  { kind: 'read-model', from: 70, to: 185 },
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
// …and at the wall's hue, saturation is not enough on its own either. HSV
// saturation is a ratio to the brightest channel, so it CLIMBS as kraft falls
// into shade: the dark edge under a curling sheet, a fold, the fall-off of a
// lamp all clear a floor the lit wall is held under, and each one either
// becomes a note or welds the notes around it together. In CIELAB a*b* that
// shadowed kraft is still where the wall is. So a pixel at the wall's hue must
// ALSO sit this far from the wall's own a*b* (measured per tile, see
// `floors.ts`). Orange paper on kraft is 30 to 40 away; shadowed kraft 2 to 6.
// Tuned on the eight hand-labelled walls: every value from 6 to 10 lifts the
// total (the kraft walls' spurious boxes fall by two thirds), and 7 is the
// one in that band that costs no wall more than a note.
const WALL_HUE_MIN_LAB_DISTANCE = 7;
// The other way round: a pixel HSV calls WALL is still paper when its a*b* sits
// this far from the wall's. A pale pink note on white paper has barely more
// HSV saturation than the paper's own sheen, and a hue within a few tens of
// degrees of it, so the saturation floor cannot see it; in a*b* it is 12 to 20
// units away, while a white wall's own noise is 2 to 6. Tuned on the eight
// hand-labelled walls: 11 to 14 all lift the total (the panorama's pale notes
// are found whole from 11 up and start to fragment at 13); at 10 the blurred
// rims of a whiteboard's dense orange notes join them together, and from 16
// the pale notes are lost again.
const PALE_PAPER_MIN_LAB_DISTANCE = 12;
// …and only when it is lit like the wall. The rim of a note, where the paper
// blurs into the wall, and the shadowed gap between two notes are as far from
// the wall in a*b* as pale paper is, but darker than the wall; pale paper is
// not. A fraction of the wall's own brightness: 0.8 to 1.1 score the same, and
// with no brightness test at all a dense whiteboard loses a tenth of its notes
// to rims welding them together.
const PALE_PAPER_MIN_BRIGHTNESS = 0.9;

// Below this brightness a pixel's hue is sensor noise: a lilac note in deep
// shade (value 0.2 to 0.3) reads anywhere from h 266 to 329 as photographed,
// either side of the line between policy and hotspot, and splits into two
// thirds-full blobs of the two kinds that the fill gate then refuses. Pink it
// is, then: the pink band is the wider. Measured on the eight labelled walls,
// 0.3 to 0.45 score the same; 0.25 finds nothing, 0.5 reaches the lit lilac
// policies on a white wall.
const DIM_HUE_MAX_VALUE = 0.4;

function inBand(hue: number, band: HueBand): boolean {
  return band.from <= band.to
    ? hue >= band.from && hue < band.to
    : hue >= band.from || hue < band.to;
}

function nearWallHue(hsv: Hsv, floors: PaperFloors): boolean {
  return floors.wallHue >= 0 && hueDistance(hsv.h, floors.wallHue) <= WALL_HUE_NEIGHBOURHOOD_DEG;
}

// By HSV alone: the whole decision for a caller with no RGB to hand, and the
// first half of it for `classifyRgb`.
export function classifyHsv(hsv: Hsv, floors: PaperFloors = DEFAULT_FLOORS): PixelClass {
  if (hsv.v < VALUE_FLOOR) return 'ink';
  if (hsv.v < floors.value) return 'wall';
  // How saturated a pixel must be to be paper depends on whether it shares the
  // wall's hue. Kraft and orange are the same colour, differing only in how
  // dull the wall is; a purple is not the wall at any saturation.
  const needed = nearWallHue(hsv, floors)
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
  // Lilac and pink in deep shade are one colour to the sensor (see
  // DIM_HUE_MAX_VALUE): read as the one kind, so a shaded note is one blob.
  if (band.kind === 'policy' && hsv.v < DIM_HUE_MAX_VALUE) return 'hotspot';
  return band.kind;
}

export { HUE_BANDS };

export function classifyRgb(
  r: number,
  g: number,
  b: number,
  floors: PaperFloors = DEFAULT_FLOORS,
): PixelClass {
  const hsv = rgbToHsv({ r, g, b });
  const verdict = classifyHsv(hsv, floors);
  if (verdict === 'wall') return paleVerdict(r, g, b, hsv, floors);
  if (verdict === 'ink' || verdict === 'unknown') return verdict;
  // Paper to HSV; at the wall's hue, ask CIELAB whether it is the wall in
  // shade (see WALL_HUE_MIN_LAB_DISTANCE). Only these pixels pay for the
  // conversion.
  if (floors.wallA === undefined || floors.wallB === undefined || !nearWallHue(hsv, floors)) {
    return verdict;
  }
  const lab = rgbToLabInto(r, g, b, labScratch);
  const distance = Math.hypot(lab.a - floors.wallA, lab.b - floors.wallB);
  return distance < WALL_HUE_MIN_LAB_DISTANCE ? 'wall' : verdict;
}

const labScratch: Lab = { l: 0, a: 0, b: 0 };

// Is a pixel HSV calls wall pale paper (see PALE_PAPER_MIN_LAB_DISTANCE)? The
// cheap tests go first, so only a lit pixel with a paper hue pays for CIELAB.
function paleVerdict(r: number, g: number, b: number, hsv: Hsv, floors: PaperFloors): PixelClass {
  const { wallA, wallB, wallValue } = floors;
  if (wallA === undefined || wallB === undefined || wallValue === undefined) return 'wall';
  if (hsv.v < wallValue * PALE_PAPER_MIN_BRIGHTNESS) return 'wall';
  const band = HUE_BANDS.find((bb) => inBand(hsv.h, bb));
  // Never a pale YELLOW: masking tape is exactly that colour, holds up every
  // sheet of paper on a wall, and a diagonal strip of it has a note's bounding
  // box. A pale aggregate is left to the saturation floor.
  if (!band || YELLOW_KINDS.has(band.kind)) return 'wall';
  const lab = rgbToLabInto(r, g, b, labScratch);
  return Math.hypot(lab.a - wallA, lab.b - wallB) >= PALE_PAPER_MIN_LAB_DISTANCE
    ? band.kind
    : 'wall';
}

// Two papers of one kind. The operator's walls carry a vivid blue command
// (saturation 0.8 to 1) and a pale periwinkle one (0.24 to 0.30), a vivid pink
// hotspot (0.75) and pale pink ones (0.2 to 0.3): the same kind, not the same
// paper. A note of each side by side is two notes, which one mask class makes
// one blob that the length rule then cuts by the wall's note. The pale shade
// gets a mask class of its own, so the components come apart where the paper
// changes. Measured on the eight labelled walls: a saturation line from 0.42
// to 0.45 scores the same; at 0.4 two of the panorama's pale pinks are lost
// again, from 0.48 the vivid blue's rim splits off. Other kinds were tried
// too: a pale green costs a note, a pale orange is every orange in shade.
const PALE_SHADE_KINDS: ReadonlySet<EventStormingNoteKind> = new Set(['command', 'hotspot']);
const PALE_SHADE_MAX_SATURATION = 0.44;
// …and only where it is lit: pale paper is bright paper. In shadow a vivid
// note's own shade is as dull, and at night the room is full of dim blue-grey
// that, as a class of its own, makes note-sized blobs out of nothing and
// drags the note size with them. 0.55 to 0.65 score within 0.3 of a point.
const PALE_SHADE_MIN_VALUE = 0.6;

// Is this pixel, already classified as `kind`, the pale shade of it?
export function isPaleShade(r: number, g: number, b: number, kind: PixelClass): boolean {
  if (!PALE_SHADE_KINDS.has(kind as EventStormingNoteKind)) return false;
  const max = Math.max(r, g, b);
  if (max < PALE_SHADE_MIN_VALUE * 255) return false;
  return (max - Math.min(r, g, b)) / max < PALE_SHADE_MAX_SATURATION;
}

export { PALE_SHADE_KINDS };

export const CALIBRATION = {
  DIM_HUE_MAX_VALUE,
  PALE_SHADE_MAX_SATURATION,
  PALE_SHADE_MIN_VALUE,
  HUE_BANDS,
  OFF_HUE_MIN_SATURATION,
  WALL_HUE_NEIGHBOURHOOD_DEG,
  WALL_HUE_MIN_LAB_DISTANCE,
  PALE_PAPER_MIN_LAB_DISTANCE,
  PALE_PAPER_MIN_BRIGHTNESS,
  PALE_YELLOW_MAX_SATURATION,
  // How the floors themselves are measured lives in `floors.ts`, next to the
  // code that uses each number; the whole calibrated table is here.
  ...FLOOR_CALIBRATION,
} as const;
