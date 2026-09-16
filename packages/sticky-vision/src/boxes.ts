import type { Component } from './components';

// From blobs to stickies (spec/139 Phase 8).
//
// A blob is not a sticky. Handwriting cuts one note into several blobs of the
// same colour; two notes of the same colour lapped over each other are one
// blob. Both are the normal case on a real wall, so both are handled here —
// merge what belongs together, split what does not.

export type Box = { classId: number; x: number; y: number; w: number; h: number; pixels: number };

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
const SPLIT_RATIO = 1.9;

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

function gapBetween(a: Box, b: Box): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.hypot(dx, dy);
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
  };
}

// Merge same-colour boxes that are touching or nearly so: one sticky with a
// word written across it arrives as two or three blobs of paper.
export function mergeFragments(boxes: Box[], noteSize: number): Box[] {
  const gap = noteSize * MERGE_GAP_FRACTION;
  let out: Box[] = boxes.map((b) => ({ ...b }));
  // To a FIXED POINT, not one pass. Merging a fragment into a box grows that
  // box, which brings the next fragment within reach — one pass leaves a note
  // as three boxes and the note size as a fragment's, which poisons every
  // threshold downstream. Bounded by the fact that each pass strictly reduces
  // the count.
  for (let pass = 0; pass < MAX_MERGE_PASSES; pass += 1) {
    const next: Box[] = [];
    for (const box of out) {
      const hit = next.findIndex((o) => o.classId === box.classId && gapBetween(o, box) <= gap);
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
// Cut evenly rather than at a measured valley: the valley between two lapped
// stickies is a paper edge, not a gap in the mask, so there is often nothing
// to find. An even cut puts each note within a few pixels of its real place,
// which is all the reconciler needs — and the author can drag it.
export function splitOversized(box: Box, noteSize: number): Box[] {
  if (noteSize <= 0) return [box];
  // Per AXIS, and as a grid: a blob can be several notes wide AND several
  // deep. On a real wall a whole field of touching notes arrives as one blob
  // — cutting only along its longer side left the rest of it a single box
  // that the "too big to be paper" filter then threw away, notes and all.
  //
  // An axis is only cut when it is clearly longer than any real silhouette
  // (the widest the notation has is 1.67 of its own height), so a wide policy
  // is never sawn in half.
  // …and only when the blob is SOLID. A run of touching notes is a filled
  // rectangle of paper; a sprawling patch of wall that squeaked past the
  // colour floor is a thin web with a big bounding box, and dicing that into
  // a grid invents dozens of notes that were never there.
  if (fillRatio(box) < MIN_SOLID_FILL) return [box];
  // An axis is cut only when it is long against the note size AND against the
  // box's OWN other side. Both, because each alone gets it wrong on a real
  // wall: the note size can be dragged down by half-notes at the frame edge
  // (and then a single sticky is diced into four), while the box's own ratio
  // alone cannot see a square block of four touching notes. Between the two,
  // the common case — a ROW of notes abutting, which the operator's wall has
  // several of — is what gets cut, and a lone note never is.
  const short = Math.max(1, Math.min(box.w, box.h));
  const cuts = (extent: number) =>
    extent / noteSize >= SPLIT_RATIO && extent / short >= SPLIT_RATIO
      ? Math.max(1, Math.round(extent / noteSize))
      : 1;
  const nx = cuts(box.w);
  const ny = cuts(box.h);
  if (nx * ny < 2) return [box];
  const stepX = box.w / nx;
  const stepY = box.h / ny;
  const out: Box[] = [];
  for (let iy = 0; iy < ny; iy += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      out.push({
        classId: box.classId,
        x: Math.round(box.x + ix * stepX),
        y: Math.round(box.y + iy * stepY),
        w: Math.round(stepX),
        h: Math.round(stepY),
        pixels: Math.round(box.pixels / (nx * ny)),
      });
    }
  }
  return out;
}

export function fitBoxes(components: Component[], opts: { imageSize?: number } = {}): Box[] {
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
  // NOW a box is a note, so the median of them is the note size.
  const size = medianNoteSize(solid);
  const minArea = (size * MIN_AREA_FRACTION) ** 2;
  const kept = solid.filter((b) => b.w * b.h >= minArea);
  if (kept.length === 0) return [];
  const split = kept.flatMap((b) => splitOversized(b, size));
  // Shape and scale, LAST: a blob only has its final proportions once the
  // fragments are merged and the runs are cut. A strip of tape is a strip of
  // tape at every stage, but a row of three notes only stops looking like one
  // after the split.
  return split.filter((b) => {
    const long = Math.max(b.w, b.h);
    const short = Math.max(1, Math.min(b.w, b.h));
    if (long / short > MAX_PAPER_ASPECT) return false;
    if (long > size * MAX_PAPER_SIZE_RATIO) return false;
    // A box that is mostly holes is wall seen through the gaps, whatever its
    // size: paper is solid.
    return fillRatio(b) >= MIN_PAPER_FILL;
  });
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
  MIN_AREA_FRACTION,
  MERGE_GAP_FRACTION,
  SPLIT_RATIO,
  MAX_PAPER_ASPECT,
  MAX_PAPER_SIZE_RATIO,
  MIN_SOLID_FILL,
  MIN_PAPER_FILL,
} as const;
