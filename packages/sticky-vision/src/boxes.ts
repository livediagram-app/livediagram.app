import { erodePaperMask, labelComponents, type Component } from './components';

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
const MIN_SOLID_FILL = 0.55;
const MIN_PAPER_FILL = 0.3;
// A sticky is roughly square, and the widest silhouette the notation has is
// 300×180. Anything longer and thinner than this is not paper: masking tape
// along a wall, the edge of a radiator, a cable.
const MAX_PAPER_ASPECT = 2.4;
// …and anything far BIGGER than the notes around it is not a note either: a
// radiator, a whiteboard, a patch of sunlit wall.
const MAX_PAPER_SIZE_RATIO = 2.6;
// How elongated a blob has to be before it is more than one note.
//
// The notation's own widest stationery is 300×180 — a ratio of 1.67 — so the
// threshold has to sit above that or every policy would be sawn in half. Two
// squares lapped over each other reach 1.9 even at a generous overlap, which
// is where the line goes.
const SPLIT_RATIO = 1.8;
// …and below this an over-long axis is one note, not two. The gap between the
// two is the dead band: see `splitOversized`.
const SPLIT_KEEP_RATIO = 1.4;
// A blob no thicker than this (in notes) is a BAND — a row or a column of
// notes lapped over each other — and a band gets cut even when it is not
// solid, because a row that sags across a wall leaves half its bounding box
// empty and would otherwise be thrown away whole. A patch of wall that
// squeaked past the colour floor is thick in BOTH directions and is not a
// band, so it is still never diced into notes that were never there.
const SPLIT_BAND_THICKNESS = 2.6;
// How far a cut may wander from the even step to land in a gap, as a fraction
// of the step. Far enough to find the seam between two lapped notes, near
// enough that it cannot walk into the next note.
const CUT_SNAP_FRACTION = 0.3;
// How full the emptiest line near a proposed cut may be, as a fraction of the
// blob's mean density along that axis, before the cut is refused for want of
// a seam. See `cutLines`.
const VALLEY_MAX_FILL = 0.85;

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
export function estimateNoteSize(boxes: Box[], noiseFloor: number): number {
  const plausible = boxes.filter((b) => {
    const short = Math.max(1, Math.min(b.w, b.h));
    if (short < noiseFloor) return false;
    if (Math.max(b.w, b.h) / short > SIZE_SAMPLE_MAX_ASPECT) return false;
    return fillRatio(b) >= SIZE_SAMPLE_MIN_FILL;
  });
  // Nothing on this wall looks like a whole note — every blob is a strip of a
  // note the handwriting cut up, or a scrap. Say so (0) rather than answer
  // with the median of the scraps: the caller then falls back to what it can
  // know without the wall, which is the frame's own pen stroke.
  if (plausible.length < MIN_SIZE_SAMPLE) return 0;
  return medianNoteSize(plausible);
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

// Merge same-colour boxes that are touching or nearly so: one sticky with a
// word written across it arrives as two or three blobs of paper.
export function mergeFragments(boxes: Box[], noteSize: number): Box[] {
  const gap = noteSize * MERGE_GAP_FRACTION;
  // A merge that would turn two pieces of paper into a mostly-empty rectangle
  // is not a note being reassembled; it is two different notes, or two specks.
  const joins = (a: Box, b: Box) =>
    a.classId === b.classId && gapBetween(a, b) <= gap && fillRatio(union(a, b)) >= MERGE_MIN_FILL;
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

// Split a box that is plainly more than one note along its long axis. Two
// overlapping orange events are one blob and two stickies, and a wall has
// plenty of those — so a blob longer than any real silhouette gets cut into
// the number of notes its length implies.
//
// Cut at the even step, SNAPPED to the emptiest line near it when the mask is
// on hand: the valley between two lapped stickies is often only a paper edge,
// so an even cut is the right starting guess, but a few pixels of search finds
// the real seam where there is one. Each cut cell is then tightened back onto
// its own pixels, which is what makes a sagging row of notes come out as
// notes rather than as tall slices of mostly wall.
export function splitOversized(
  box: Box,
  noteSize: number,
  mask?: PaperMask,
  seams?: PaperMask,
): Box[] {
  if (noteSize <= 0) return [box];
  // ONE AXIS AT A TIME, and tighten between cuts.
  //
  // A blob can be several notes wide AND several deep, so a whole field of
  // touching notes has to come apart in both directions — but cutting both at
  // once, as a grid over the bounding box, gets a SAGGING ROW wrong: six notes
  // lapped along a line that drops across the paper have a bounding box two
  // notes tall, and the grid then halves every note in the row. Cutting the
  // longer axis first and tightening each piece onto its own paper answers
  // that: a column of the row tightens back to one note and is not cut again,
  // while a real 2x2 block tightens to a column of two and is.
  //
  // The guard against dicing a patch of wall that squeaked past the colour
  // floor is the same as it was: without a mask to tighten against, a blob is
  // only cut if it is SOLID, or is a thin BAND (a sagging row is neither
  // solid nor square, and only its thickness says it is a single file of
  // paper).
  const band = Math.min(box.w, box.h) <= noteSize * SPLIT_BAND_THICKNESS;
  if (!mask && fillRatio(box) < MIN_SOLID_FILL && !band) return [box];
  return splitAxis(box, noteSize, mask, seams, 0);
}

// How many times a piece may be cut again after being cut. Four is past any
// real block on a wall; it only stops a pathological loop.
const SPLIT_MAX_DEPTH = 4;

function splitAxis(
  box: Box,
  noteSize: number,
  mask: PaperMask | undefined,
  seams: PaperMask | undefined,
  depth: number,
): Box[] {
  // An axis is cut on its length against the NOTE, with a dead band so the
  // two failure modes cannot trade places. Under `SPLIT_KEEP_RATIO` an
  // over-long axis is one note photographed nearer than its neighbours, or
  // the notation's own wide silhouette (1.67 of its height), and is left
  // alone. Over `SPLIT_RATIO` it is as many notes as it is long — the
  // operator's own rule: a box four times the area of a note is not a note.
  //
  // The cut lands on the SEAM between two notes when the paper shows one, and
  // on the even step when it does not. Requiring a seam was tried and cost
  // fifteen points of recall on the operator's walls: two notes of the same
  // colour flush against each other genuinely have no boundary in the mask,
  // and refusing to cut them leaves two notes wearing one box, which is the
  // complaint this work started from.
  const ratioW = box.w / noteSize;
  const ratioH = box.h / noteSize;
  const horizontal = ratioW >= ratioH;
  const ratio = horizontal ? ratioW : ratioH;
  if (depth >= SPLIT_MAX_DEPTH || ratio < SPLIT_RATIO) return [box];
  const pieces = Math.max(2, Math.round(ratio));
  const lines = cutLines(box, pieces, mask, horizontal, seams);
  if (lines.length < 3) return [box];
  const out: Box[] = [];
  for (let i = 0; i + 1 < lines.length; i += 1) {
    const cell: Box = {
      classId: box.classId,
      x: horizontal ? lines[i]! : box.x,
      y: horizontal ? box.y : lines[i]!,
      w: horizontal ? lines[i + 1]! - lines[i]! : box.w,
      h: horizontal ? box.h : lines[i + 1]! - lines[i]!,
      pixels: Math.round(box.pixels / (lines.length - 1)),
    };
    const tight = mask ? tightenTo(cell, mask) : cell;
    if (!tight) continue;
    out.push(...splitAxis(tight, noteSize, mask, seams, depth + 1));
  }
  return out.length > 0 ? out : [box];
}

// The boundaries of the cuts across one axis of a box: the even steps, each
// nudged to the emptiest line within reach of it.
//
// The nudge is worth the pixels it costs: two notes lapped over each other
// leave a seam of shadow and paper edge, and a cut that lands ON it puts both
// notes where they really are instead of a few pixels either side. Where
// there is no seam at all — two flush rectangles of identical paper — the
// even step is the honest answer and the nudge changes nothing.
function cutLines(
  box: Box,
  pieces: number,
  mask: PaperMask | undefined,
  horizontal: boolean,
  seams: PaperMask | undefined,
): number[] {
  const from = horizontal ? box.x : box.y;
  const extent = horizontal ? box.w : box.h;
  if (pieces < 2) return [from, from + extent];
  const step = extent / pieces;
  const lines = [from];
  if (!mask) {
    for (let i = 1; i < pieces; i += 1) lines.push(Math.round(from + i * step));
    lines.push(from + extent);
    return lines;
  }
  const reach = Math.round(step * CUT_SNAP_FRACTION);
  // How full a line may be and still be a seam. Mean density along the axis is
  // what a line through the middle of solid paper looks like; a seam between
  // two lapped notes — a paper edge, its shadow — reads a good deal emptier.
  const across = horizontal ? box.h : box.w;
  const mean = Math.min(across, box.pixels / Math.max(1, extent));
  const seamBar = mean * VALLEY_MAX_FILL;
  for (let i = 1; i < pieces; i += 1) {
    const found = emptiestLine(box, Math.round(from + i * step), reach, seams ?? mask, horizontal);
    // NO SEAM, NO CUT. Size alone cannot tell four notes lapped into a square
    // from one note photographed nearer than its neighbours — they are the
    // same rectangle of the same colour at the same fill, and guessing from
    // the size is precisely how the detector came to cut single stickies in
    // half while leaving a 2x2 cluster whole. The paper itself says which:
    // four notes have edges between them and one note does not.
    const cutAt = found.count > seamBar ? Math.round(from + i * step) : found.at;
    if (cutAt > lines[lines.length - 1]!) lines.push(cutAt);
  }
  lines.push(from + extent);
  return lines;
}

function emptiestLine(
  box: Box,
  at: number,
  reach: number,
  mask: PaperMask,
  horizontal: boolean,
): { at: number; count: number } {
  let best = at;
  let bestCount = Infinity;
  for (let offset = -reach; offset <= reach; offset += 1) {
    const line = at + offset;
    let count = 0;
    if (horizontal) {
      if (line <= box.x || line >= box.x + box.w) continue;
      for (let y = box.y; y < box.y + box.h; y += 1) {
        if (mask.classes[y * mask.width + line] === box.classId) count += 1;
      }
    } else {
      if (line <= box.y || line >= box.y + box.h) continue;
      for (let x = box.x; x < box.x + box.w; x += 1) {
        if (mask.classes[line * mask.width + x] === box.classId) count += 1;
      }
    }
    // Ties go to the line nearest the even step, which is why this walks out
    // from the middle and keeps only a STRICT improvement.
    if (count < bestCount) {
      bestCount = count;
      best = line;
    }
  }
  return { at: best, count: bestCount };
}

// Shrink a cut cell back onto the paper actually inside it. Without this a row
// of notes that sags leaves every cell half full of wall, and the shape
// filters reject the lot.
function tightenTo(cell: Box, mask: PaperMask): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let pixels = 0;
  const x1 = Math.min(mask.width, cell.x + cell.w);
  const y1 = Math.min(mask.height, cell.y + cell.h);
  for (let y = Math.max(0, cell.y); y < y1; y += 1) {
    for (let x = Math.max(0, cell.x); x < x1; x += 1) {
      if (mask.classes[y * mask.width + x] !== cell.classId) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      pixels += 1;
    }
  }
  if (pixels === 0) return null;
  return {
    classId: cell.classId,
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    pixels,
  };
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

export function fitBoxes(
  components: Component[],
  opts: { imageSize?: number; mask?: PaperMask; seams?: PaperMask; noteSize?: number } = {},
): Box[] {
  if (components.length === 0) return [];
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
  const gap = Math.max(2, Math.round(imageSize * PEN_STROKE_FRACTION));
  const merged = mergeFragments(raw, gap / MERGE_GAP_FRACTION);
  // Sensor noise and single stray pixels of paper colour, gone before anything
  // is measured against them. An absolute floor relative to the IMAGE, because
  // it is a property of the camera rather than of the wall — on a real photo
  // half the merged boxes are 1 to 5 pixels across, and they sit exactly where
  // a median would otherwise land.
  const noiseFloor = Math.max(4, Math.round(imageSize * NOISE_FLOOR_FRACTION));
  const solid = merged.filter((b) => Math.min(b.w, b.h) >= noiseFloor);
  if (solid.length === 0) return [];
  // The note size the caller measured before the close, when one was measured:
  // by this point the blobs have been through a close and a merge, and a run
  // of welded notes is indistinguishable from one big note to a median.
  const size = opts.noteSize && opts.noteSize > 0 ? opts.noteSize : medianNoteSize(solid);
  const minArea = (size * MIN_AREA_FRACTION) ** 2;
  const kept = solid.filter((b) => b.w * b.h >= minArea);
  if (kept.length === 0) return [];
  // Shape and scale, LAST: a blob only has its final proportions once the
  // fragments are merged and the runs are cut. A strip of tape is a strip of
  // tape at every stage, but a row of three notes only stops looking like one
  // after the split.
  const isPaper = (b: Box) => {
    const long = Math.max(b.w, b.h);
    const short = Math.max(1, Math.min(b.w, b.h));
    if (long / short > MAX_PAPER_ASPECT) return false;
    if (long > size * MAX_PAPER_SIZE_RATIO) return false;
    // A box that is mostly holes is wall seen through the gaps, whatever its
    // size: paper is solid.
    return fillRatio(b) >= MIN_PAPER_FILL;
  };
  const bigEnough = (b: Box) => Math.min(b.w, b.h) >= noiseFloor && b.w * b.h >= minArea;

  return kept.flatMap((box) => {
    const pieces = splitOversized(box, size, opts.mask, opts.seams).filter(
      (b) => isPaper(b) && (b === box || bigEnough(b)),
    );
    if (pieces.length > 0) return pieces;
    // Nothing survived. If this box was ASSEMBLED, the assembly is what failed
    // — hand the pieces back instead of taking them down with it. A single
    // over-eager merge was otherwise losing a whole row of real notes at once,
    // because a row of notes lapped over each other reaches neither the
    // solidity the splitter wants nor the squareness the filter wants, while
    // each note on its own is plainly paper.
    const parts = partsOf(box)
      .filter(bigEnough)
      .flatMap((part) => splitOversized(part, size, opts.mask, opts.seams))
      .filter(isPaper);
    if (parts.length > 0) return parts;
    // A block of touching notes, then: one component too square for the
    // splitter's arithmetic and too big for the filters. Rather than lose
    // eight real notes to it, pull it apart at the seams the paper itself has
    // (see `erodePaperMask`) and keep whatever comes out looking like paper.
    return opts.mask ? rescue(box, opts.mask, size, isPaper, bigEnough, opts.seams) : [];
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
  SIZE_SAMPLE_MIN_FILL,
  SIZE_SAMPLE_MAX_ASPECT,
  MIN_SIZE_SAMPLE,
  MIN_AREA_FRACTION,
  MERGE_GAP_FRACTION,
  MERGE_MIN_FILL,
  SPLIT_BAND_THICKNESS,
  CUT_SNAP_FRACTION,
  VALLEY_MAX_FILL,
  RESCUE_ERODE_FRACTION,
  RESCUE_ROUNDS,
  SPLIT_RATIO,
  SPLIT_KEEP_RATIO,
  MAX_PAPER_ASPECT,
  MAX_PAPER_SIZE_RATIO,
  MIN_SOLID_FILL,
  MIN_PAPER_FILL,
} as const;
