import { erodePaperMask, labelComponents, type Component } from './components';
import { splitOversized, SPLIT_CALIBRATION } from './split';
import { cutAtNotches } from './chords';
import { cutAtSeam, type Luminance } from './seam';

// From blobs to stickies (spec/139 Phase 8).
//
// A blob is not a sticky. Handwriting cuts one note into several blobs of the
// same colour; two notes of the same colour lapped over each other are one
// blob. Both are the normal case on a real wall, so both are handled here —
// merge what belongs together, split what does not.

export type Box = {
  classId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  pixels: number;
  // The boxes this one was assembled from, when it is a merge of several.
  // Kept so the assembly can be UNDONE: a merge that turns out not to look
  // like paper must hand its pieces back rather than take them down with it
  // (on a real wall one over-eager merge was taking six real notes with it).
  parts?: Box[];
};

// Smaller than this fraction of the median NOTE in each dimension and it is a
// speck: a highlighter mark, a JPEG artefact, a coloured pen lid.
//
// Measured against the median of the MERGED boxes, and nothing else. Against
// the largest blob it was wrong on a real wall — one run of three touching
// notes set the scale and every single note fell under the threshold; against
// the raw median it is wrong too, because a thousand ink fragments are the
// median. Merge first, then measure, then filter.
const MIN_AREA_FRACTION = 0.35;
// Two same-colour boxes this close (relative to the note size) are one note
// the handwriting split in half.
const MERGE_GAP_FRACTION = 0.12;
// …and only while the result still looks like paper. The merge is
// TRANSITIVE — each union grows the box, which brings the next fragment
// within reach — so on a real wall a sprinkling of stray paper-coloured
// pixels chains every note in the frame into one blob (measured: 856×497 at
// fill 0.20, holding a dozen real notes, thrown away whole by the shape
// filters). A note's own fragments all live inside the note, so merging them
// keeps the box dense; two specks a hand's width apart do not. Too low and
// the chain comes back; too high and a note shattered by heavy handwriting is
// left in pieces.
const MERGE_MIN_FILL = 0.55;
// How far apart two pieces may be when the merge would leave them nearly
// solid, and how solid that has to be. See `mergeFragments`.
const MERGE_REACH_FRACTION = 0.3;
const MERGE_REACH_MIN_FILL = 0.7;
// A pen stroke, as a fraction of the working image's long side. This is what
// separates one fragment of a note from the next.
const PEN_STROKE_FRACTION = 0.006;
// Enough for a note shattered into a long chain of fragments; the loop exits
// as soon as a pass changes nothing.
const MAX_MERGE_PASSES = 12;
// Anything thinner than this, in either direction, is noise rather than paper.
const NOISE_FLOOR_FRACTION = 0.008;
// Below this fill a box is a patch of wall seen through gaps, not paper.
// Two numbers, because the two questions differ: to CUT a blob into several
// notes it has to be convincingly solid, but to KEEP one it only has to be
// more paper than holes — a note covered by its neighbour, or written on
// edge to edge, is still a note.
export const MIN_SOLID_FILL = 0.55;
const MIN_PAPER_FILL = 0.45;
// A sticky is roughly square, and the widest silhouette the notation has is
// 300×180. Anything longer and thinner than this is not paper: masking tape
// along a wall, the edge of a radiator, a cable.
const MAX_PAPER_ASPECT = 2.4;
// …and anything far BIGGER than the notes around it is not a note either: a
// radiator, a whiteboard, a patch of sunlit wall.
const MAX_PAPER_SIZE_RATIO = 2.6;
// …and the floor under it. See `isPaper`.
const MIN_PAPER_SIZE_RATIO = 0.7;
// …and the floor under a piece of a notch or seam CUT, lower: a cut stands
// when each side is at least this thick, and a side between this and the
// floor above is a sliver of the note underneath, cut off and then dropped
// with the other non-notes, so it no longer inflates the box of the note on
// top. Keeping those slivers as notes found few and invented many. Any value
// from 0.575 to 0.65 scores within a note of the best.
const CUT_PIECE_SIZE_RATIO = 0.6;

// How much of a box's area is actually its own colour. A sticky is nearly
// solid (handwriting takes a little off); a patch of wall that scraped past
// the colour floor is mostly holes.
export function fillRatio(box: Box): number {
  return box.pixels / Math.max(1, box.w * box.h);
}

function boxOf(c: Component): Box {
  return {
    classId: c.classId,
    x: c.minX,
    y: c.minY,
    w: c.maxX - c.minX + 1,
    h: c.maxY - c.minY + 1,
    pixels: c.pixels,
  };
}

// The UPPER median on an even count. With a handful of boxes the difference
// decides everything: a photo of one note beside one speck has median 'speck'
// under the lower median, and every threshold derived from it then throws the
// note away.
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

// The note size this photo is working at: the median blob's SHORT side.
//
// The short side, not the long one, and not the area: a sticky lapped over
// another is twice as long as it should be but exactly as tall, and two notes
// side by side are one blob whose height is still one note. The short side is
// the dimension overlap does not inflate.
export function medianNoteSize(boxes: Box[]): number {
  return median(boxes.map((b) => Math.min(b.w, b.h)));
}

// How solid, and how square, a blob has to be before it is allowed to have an
// opinion about how big a note is on this wall. A note is a filled rectangle;
// a strip of masking tape, a shadow line along a seam and the web left by a
// patch of sunlit kraft are none of those, and they outnumber the notes.
const SIZE_SAMPLE_MIN_FILL = 0.5;
const SIZE_SAMPLE_MAX_ASPECT = 2.4;
// Below this many note-shaped blobs there is no population to take a median
// of, only a coincidence.
const MIN_SIZE_SAMPLE = 3;
// …and before ONE COLOUR gets a size of its own, eight of them. A scarce
// colour on a wall is as likely to be junk as notes — pale masking tape reads
// as a yellow note, a cardboard corner as an orange one — and measured from
// three or four of those scraps it came out a third of a real note, which let
// every scrap of its colour through. Measured on the hand-labelled walls: the
// colours that were really a smaller pad had 21 whole notes behind them; the
// ones that were tape had 3 to 7. Any value from 8 to 20 scores the same on
// all eight walls; 10 sits in that plateau rather than on its edge.
const MIN_CLASS_SIZE_SAMPLE = 10;

// The note size, measured BEFORE anything is fused.
//
// This is the number every threshold below divides by, and it was being taken
// after the morphological close — which is exactly where it cannot be trusted,
// because a close that welds four notes into a bar has already destroyed the
// population it would be measured from. Measured here instead, on the raw
// blobs, with the obvious non-notes dropped first: on the operator's six walls
// that lands within a few pixels of the hand-labelled median (50 vs 52, 49 vs
// 55, 36 vs 38), where the old number was less than half of it (24 vs 55) and
// every rule that divides by it — the close radius, the split, the too-big
// filter — was wrong by the same factor.
// A raw blob that could be a whole note: bigger than noise, not a strip, and
// mostly paper. What the note size is measured from.
function isPlausibleNote(b: Box, noiseFloor: number): boolean {
  const short = Math.max(1, Math.min(b.w, b.h));
  if (short < noiseFloor) return false;
  if (Math.max(b.w, b.h) / short > SIZE_SAMPLE_MAX_ASPECT) return false;
  return fillRatio(b) >= SIZE_SAMPLE_MIN_FILL;
}

export function estimateNoteSize(boxes: Box[], noiseFloor: number): number {
  const plausible = boxes.filter((b) => isPlausibleNote(b, noiseFloor));
  // Nothing on this wall looks like a whole note — every blob is a strip of a
  // note the handwriting cut up, or a scrap. Say so (0) rather than answer
  // with the median of the scraps: the caller then falls back to what it can
  // know without the wall, which is the frame's own pen stroke.
  if (plausible.length < MIN_SIZE_SAMPLE) return 0;
  return medianNoteSize(plausible);
}

// The note size of each paper colour, measured the same way as the wall's
// (see `estimateNoteSize`), for every colour with enough whole notes to
// measure. Colours too scarce to measure are absent: the wall's size stands.
export function estimateNoteSizes(
  boxes: Box[],
  noiseFloor: number,
  minSample = MIN_CLASS_SIZE_SAMPLE,
): Map<number, number> {
  const byClass = new Map<number, Box[]>();
  for (const b of boxes) byClass.set(b.classId, [...(byClass.get(b.classId) ?? []), b]);
  const sizes = new Map<number, number>();
  for (const [classId, group] of byClass) {
    const plausible = group.filter((g) => isPlausibleNote(g, noiseFloor));
    if (plausible.length < minSample) continue;
    sizes.set(classId, medianNoteSize(plausible));
  }
  return sizes;
}

function gapBetween(a: Box, b: Box): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.hypot(dx, dy);
}

function partsOf(box: Box): Box[] {
  return box.parts ?? [box];
}

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    classId: a.classId,
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
    pixels: a.pixels + b.pixels,
    parts: [...partsOf(a), ...partsOf(b)],
  };
}

// A piece at least this thick (in notes) is a WHOLE note already, not a
// fragment of one: two such pieces are never merged. A line of handwriting or
// a shadow cuts a note into pieces thinner than half a note, while two narrow
// actors or two notes a pen stroke apart are each thicker, and their union is
// a solid rectangle the fill test happily accepts. Measured on the eight
// labelled walls, of 62 unions of several pieces 25 joined two labelled notes;
// any value from 0.4 to 0.5 scores the same (0.55 lets one pair back in).
const WHOLE_NOTE_SIDE = 0.45;

function isWholeNote(b: Box, noteSize: number): boolean {
  return Math.min(b.w, b.h) >= noteSize * WHOLE_NOTE_SIDE;
}

// Merge same-colour boxes that are touching or nearly so: one sticky with a
// word written across it arrives as two or three blobs of paper.
export function mergeFragments(boxes: Box[], noteSize: number): Box[] {
  const gap = noteSize * MERGE_GAP_FRACTION;
  // A merge that would turn two pieces of paper into a mostly-empty rectangle
  // is not a note being reassembled; it is two different notes, or two specks.
  // …and a SECOND reach, further out, for a merge that comes back nearly
  // solid. A shadow edge crossing a note leaves two pieces a quarter of a note
  // apart with nothing but wall-coloured paper between them, which no
  // pen-stroke reach will ever join; two scraps of junk that far apart
  // practically never make a solid rectangle together.
  const reach = noteSize * MERGE_REACH_FRACTION;
  const joins = (a: Box, b: Box) => {
    if (a.classId !== b.classId) return false;
    if (isWholeNote(a, noteSize) && isWholeNote(b, noteSize)) return false;
    const between = gapBetween(a, b);
    if (between > reach) return false;
    const fill = fillRatio(union(a, b));
    return between <= gap ? fill >= MERGE_MIN_FILL : fill >= MERGE_REACH_MIN_FILL;
  };
  let out: Box[] = boxes.map((b) => ({ ...b }));
  // To a FIXED POINT, not one pass. Merging a fragment into a box grows that
  // box, which brings the next fragment within reach — one pass leaves a note
  // as three boxes and the note size as a fragment's, which poisons every
  // threshold downstream. Bounded by the fact that each pass strictly reduces
  // the count.
  for (let pass = 0; pass < MAX_MERGE_PASSES; pass += 1) {
    const next: Box[] = [];
    for (const box of out) {
      const hit = next.findIndex((o) => joins(o, box));
      if (hit === -1) next.push({ ...box });
      else next[hit] = union(next[hit]!, box);
    }
    if (next.length === out.length) return next;
    out = next;
  }
  return out;
}

// How deep the rescue erodes, as a fraction of the note size, before counting
// the pieces of a block that no geometric rule could take apart. Deep enough
// to break the seam between two lapped notes, shallow enough that a note is
// still most of itself afterwards.
const RESCUE_ERODE_FRACTION = 0.12;
// How many times the rescue may go deeper on a piece that still has not come
// apart. Three is where it stops paying on a real wall: what is left after
// that is a poster, a radiator or a patch of sunlight, not a block of notes.
const RESCUE_ROUNDS = 3;

// The class mask the components came from. Optional everywhere: the geometry
// works without it, and works BETTER with it, because a cut can then land in a
// real gap and each piece can be measured against real pixels.
export type PaperMask = { width: number; height: number; classes: Uint8Array };

// Why a box was dropped: which gate refused it. Reported, never acted on, so a
// sweep can say which rule costs which note.
export type DropReason =
  'noise' | 'area' | 'aspect' | 'too-big' | 'size-floor' | 'fill' | 'piece-small' | 'rescue';
export type OnDrop = (box: Box, reason: DropReason) => void;

export function fitBoxes(
  components: Component[],
  opts: {
    imageSize?: number;
    mask?: PaperMask;
    seams?: PaperMask;
    noteSize?: number;
    // The note size of each paper colour on this wall, where it could be
    // measured (see `estimateNoteSizes`).
    classNoteSize?: Map<number, number>;
    // How bright the photograph is, pixel by pixel: where it is on hand, a
    // flush seam with no notch can still be found by its shadow (see `seam.ts`).
    luminance?: Luminance;
    // Told of every box a gate refuses, and why (see `DropReason`).
    onDrop?: OnDrop;
  } = {},
): Box[] {
  const drop = opts.onDrop ?? (() => {});
  if (components.length === 0) return [];
  // True when the box passes; otherwise reports the reason and returns false.
  const refuse = (b: Box, reason: DropReason | false): boolean => {
    if (reason === false) return true;
    drop(b, reason);
    return false;
  };
  const raw = components.map(boxOf);
  // Merge FIRST, and by an absolute gap rather than a derived one.
  //
  // On a real wall the handwriting cuts every note into dozens of paper
  // fragments, so fragments outnumber notes twenty to one and EVERY statistic
  // taken before the merge describes the fragments: the median is a fragment,
  // the mode is a fragment, the area-weighted bulk is whichever blob happens
  // to be biggest. What the gap actually is, though, is known without any of
  // them — it is the width of a pen stroke, a few pixels at any sane working
  // resolution.
  // Every threshold below is a FRACTION of something in the picture: of the
  // image's long edge (the pen stroke, the noise floor) or of the note size
  // measured from the picture itself (the speck filter, the split, the
  // too-big filter). Nothing here may be an absolute pixel count, or the
  // detector finds a different number of notes in the same photograph
  // depending on how much of it the caller happened to decode.
  //
  // When the caller does not say how big the image was, take the extent of
  // the content as a lower bound rather than assuming a size: guessing 1000
  // for a 2048px photo is the same bug wearing a default value.
  const imageSize = opts.imageSize ?? raw.reduce((m, b) => Math.max(m, b.x + b.w, b.y + b.h), 0);
  // The reach is a fraction of the NOTE when the caller has measured one, and
  // a pen stroke off the frame when it has not. A shadow edge crossing a note
  // splits it into two pieces a good deal further apart than a pen stroke, and
  // only the note says how far that is.
  const gap = Math.max(2, Math.round(imageSize * PEN_STROKE_FRACTION));
  const merged = mergeFragments(
    raw,
    opts.noteSize && opts.noteSize > 0 ? opts.noteSize : gap / MERGE_GAP_FRACTION,
  );
  // Sensor noise and single stray pixels of paper colour, gone before anything
  // is measured against them. An absolute floor relative to the IMAGE, because
  // it is a property of the camera rather than of the wall — on a real photo
  // half the merged boxes are 1 to 5 pixels across, and they sit exactly where
  // a median would otherwise land.
  const noiseFloor = Math.max(4, Math.round(imageSize * NOISE_FLOOR_FRACTION));
  const solid = merged.filter((b) => refuse(b, Math.min(b.w, b.h) < noiseFloor && 'noise'));
  if (solid.length === 0) return [];
  // The note size the caller measured before the close, when one was measured:
  // by this point the blobs have been through a close and a merge, and a run
  // of welded notes is indistinguishable from one big note to a median.
  const size = opts.noteSize && opts.noteSize > 0 ? opts.noteSize : medianNoteSize(solid);
  const minArea = (size * MIN_AREA_FRACTION) ** 2;
  const kept = solid.filter((b) => refuse(b, b.w * b.h < minArea && 'area'));
  if (kept.length === 0) return [];
  // Shape and scale, LAST: a blob only has its final proportions once the
  // fragments are merged and the runs are cut. A strip of tape is a strip of
  // tape at every stage, but a row of three notes only stops looking like one
  // after the split.
  const isPaper = (b: Box) => notPaper(b, MIN_PAPER_SIZE_RATIO) === null;
  const paperAt = (b: Box, sizeRatio: number) => notPaper(b, sizeRatio) === null;
  const notPaper = (b: Box, sizeRatio: number): DropReason | null => {
    const long = Math.max(b.w, b.h);
    const short = Math.max(1, Math.min(b.w, b.h));
    if (long / short > MAX_PAPER_ASPECT) return 'aspect';
    if (long > size * MAX_PAPER_SIZE_RATIO) return 'too-big';
    // …and a note is not much SMALLER than the wall's other notes either.
    // Stationery comes in one size: measured against the hand-labelled walls,
    // nine in ten real notes are within a quarter of the median and half the
    // spurious boxes are under three quarters of it — scraps of tape, shadow
    // in a paper seam, a corner of cardboard.
    //
    // Measured per paper COLOUR where the wall has enough of it: stationery
    // comes in one size per pad, not one size per wall. A wall of big orange
    // events with small yellow actors on it has two sizes, and a floor set by
    // the orange threw every actor away — while an orange sliver among orange
    // notes is still a sliver.
    const own = opts.classNoteSize?.get(b.classId);
    const floorSize = own !== undefined && own > 0 && own < size ? own : size;
    if (short < floorSize * sizeRatio) return 'size-floor';
    // A box that is mostly holes is wall seen through the gaps, whatever its
    // size: paper is solid.
    return fillRatio(b) >= MIN_PAPER_FILL ? null : 'fill';
  };
  const bigEnough = (b: Box) => Math.min(b.w, b.h) >= noiseFloor && b.w * b.h >= minArea;
  // Keeps a box as paper, or reports why it is not.
  const keepPaper = (b: Box) => refuse(b, notPaper(b, MIN_PAPER_SIZE_RATIO) ?? false);
  const keepPiece = (b: Box) => refuse(b, !bigEnough(b) && 'piece-small');

  // A piece the splitter left whole may still be two lapped notes too short
  // for its length rule; the notches in its outline say so (see `chords.ts`).
  // A cut stands only when every piece it makes is paper, and solid: the
  // same bar the splitter holds a blob to before cutting it, with the lower
  // size floor of a cut (see `CUT_PIECE_SIZE_RATIO`).
  const standsAsCut = (cuts: Box[]) =>
    cuts.length > 1 &&
    cuts.every((c) => paperAt(c, CUT_PIECE_SIZE_RATIO) && fillRatio(c) >= MIN_SOLID_FILL);
  const notched = (b: Box): Box[] => {
    if (!opts.mask) return [b];
    const cuts = cutAtNotches(b, opts.mask, size);
    return standsAsCut(cuts) ? cuts : [b];
  };
  const seamed = (b: Box): Box[] => {
    if (!opts.mask || !opts.luminance) return [b];
    const cuts = cutAtSeam(b, opts.luminance, opts.mask, size);
    return standsAsCut(cuts) ? cuts : [b];
  };

  return kept.flatMap((box) => {
    const pieces = splitOversized(box, size, opts.mask, opts.seams)
      .flatMap(notched)
      .flatMap(seamed)
      .filter((b) => keepPaper(b) && (b === box || keepPiece(b)));
    if (pieces.length > 0) return pieces;
    // Nothing survived. If this box was ASSEMBLED, the assembly is what failed
    // — hand the pieces back instead of taking them down with it. A single
    // over-eager merge was otherwise losing a whole row of real notes at once,
    // because a row of notes lapped over each other reaches neither the
    // solidity the splitter wants nor the squareness the filter wants, while
    // each note on its own is plainly paper.
    const parts = partsOf(box)
      .filter(keepPiece)
      .flatMap((part) => splitOversized(part, size, opts.mask, opts.seams))
      .filter(keepPaper);
    if (parts.length > 0) return parts;
    // A block of touching notes, then: one component too square for the
    // splitter's arithmetic and too big for the filters. Rather than lose
    // eight real notes to it, pull it apart at the seams the paper itself has
    // (see `erodePaperMask`) and keep whatever comes out looking like paper.
    if (!opts.mask) return [];
    const rescued = rescue(box, opts.mask, size, isPaper, bigEnough, opts.seams);
    if (rescued.length === 0) drop(box, 'rescue');
    return rescued;
  });
}

// Pull a block apart, as deep as it takes. A pass that leaves a piece still
// too big to be a note is a pass that did not reach that seam, so the piece
// goes round again with a deeper erosion — up to three times, after which a
// thing that still will not come apart is not a block of notes.
function rescue(
  box: Box,
  mask: PaperMask,
  noteSize: number,
  isPaper: (b: Box) => boolean,
  bigEnough: (b: Box) => boolean,
  seams?: PaperMask,
): Box[] {
  const base = Math.max(1, Math.round(noteSize * RESCUE_ERODE_FRACTION));
  const out: Box[] = [];
  let pending = [box];
  for (let round = 1; round <= RESCUE_ROUNDS && pending.length > 0; round += 1) {
    const next: Box[] = [];
    for (const piece of pending) {
      const cuts = rescueBlock(piece, mask, base * round).flatMap((p) =>
        splitOversized(p, noteSize, mask, seams),
      );
      for (const cut of cuts) {
        if (!bigEnough(cut)) continue;
        // A rescued piece has to be SOLID, not merely more paper than holes.
        // The ordinary bar is for a note the detector already believes in;
        // this one is for a piece cut out of something that failed every
        // other test, and a sunlit patch of kraft wall will happily yield a
        // hundred note-sized scraps of web if the bar is set where a real
        // note only just clears it.
        if (isPaper(cut) && fillRatio(cut) >= MIN_SOLID_FILL) out.push(cut);
        else next.push(cut);
      }
    }
    pending = next;
  }
  return out;
}

// Take a block apart at its seams: erode its region until the notes separate,
// label what is left, and grow each piece back by what the erosion took.
function rescueBlock(box: Box, mask: PaperMask, radius: number): Box[] {
  const x0 = Math.max(0, box.x);
  const y0 = Math.max(0, box.y);
  const x1 = Math.min(mask.width, box.x + box.w);
  const y1 = Math.min(mask.height, box.y + box.h);
  const width = x1 - x0;
  const height = y1 - y0;
  if (width <= 0 || height <= 0) return [];
  const classes = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // Only this box's own colour: a neighbour of another kind is not part
      // of the block being counted.
      const c = mask.classes[(y + y0) * mask.width + (x + x0)]!;
      classes[y * width + x] = c === box.classId ? c : 0;
    }
  }
  const eroded = erodePaperMask({ width, height, classes }, radius);
  return labelComponents(eroded).map((piece) => ({
    classId: box.classId,
    // Back out the erosion, so a piece is the note again rather than the note
    // minus a margin.
    x: x0 + Math.max(0, piece.minX - radius),
    y: y0 + Math.max(0, piece.minY - radius),
    w: Math.min(width, piece.maxX + radius) - Math.max(0, piece.minX - radius) + 1,
    h: Math.min(height, piece.maxY + radius) - Math.max(0, piece.minY - radius) + 1,
    pixels: piece.pixels,
  }));
}

// The stationery silhouette a box implies (spec/139 Phase 4). Measured against
// the photo's own median note, so it works at any distance.
export function silhouetteOf(box: Box, noteSize: number): 'square' | 'wide' | 'small' {
  if (noteSize <= 0) return 'square';
  const ratio = box.w / Math.max(1, box.h);
  if (ratio >= 1.35) return 'wide';
  if (Math.max(box.w, box.h) <= noteSize * 0.8) return 'small';
  return 'square';
}

export const BOX_CALIBRATION = {
  ...SPLIT_CALIBRATION,
  SIZE_SAMPLE_MIN_FILL,
  SIZE_SAMPLE_MAX_ASPECT,
  MIN_SIZE_SAMPLE,
  MIN_AREA_FRACTION,
  MERGE_GAP_FRACTION,
  MERGE_MIN_FILL,
  MERGE_REACH_FRACTION,
  MERGE_REACH_MIN_FILL,
  WHOLE_NOTE_SIDE,
  RESCUE_ERODE_FRACTION,
  RESCUE_ROUNDS,
  MAX_PAPER_ASPECT,
  MAX_PAPER_SIZE_RATIO,
  MIN_PAPER_SIZE_RATIO,
  CUT_PIECE_SIZE_RATIO,
  MIN_SOLID_FILL,
  MIN_PAPER_FILL,
} as const;
