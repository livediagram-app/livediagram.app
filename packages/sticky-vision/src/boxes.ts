import type { Component } from './components';

// From blobs to stickies (spec/139 Phase 8).
//
// A blob is not a sticky. Handwriting cuts one note into several blobs of the
// same colour; two notes of the same colour lapped over each other are one
// blob. Both are the normal case on a real wall, so both are handled here —
// merge what belongs together, split what does not.

export type Box = { classId: number; x: number; y: number; w: number; h: number; pixels: number };

// Smaller than this fraction of the LARGEST blob's long side and it is a
// speck: a highlighter mark, a JPEG artefact, a coloured pen lid. Measured
// against the largest rather than the median, because the median is exactly
// what a handful of specks poisons.
const MIN_AREA_FRACTION = 0.15;
// Two same-colour boxes this close (relative to the median note) are one note
// the handwriting split in half.
const MERGE_GAP_FRACTION = 0.12;
// How elongated a blob has to be before it is more than one note.
//
// The notation's own widest stationery is 300×180 — a ratio of 1.67 — so the
// threshold has to sit above that or every policy would be sawn in half. Two
// squares lapped over each other reach 1.9 even at a generous overlap, which
// is where the line goes.
const SPLIT_RATIO = 1.9;

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

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
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
  const out: Box[] = [];
  for (const box of boxes) {
    const hit = out.findIndex((o) => o.classId === box.classId && gapBetween(o, box) <= gap);
    if (hit === -1) out.push({ ...box });
    else out[hit] = union(out[hit]!, box);
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
  const along = box.w >= box.h ? 'x' : 'y';
  const extent = along === 'x' ? box.w : box.h;
  // Against the blob's OWN short side as well as the photo's median: a single
  // wide note is 1.67 of its own height, whatever else is in the picture.
  const ownRatio = extent / Math.max(1, Math.min(box.w, box.h));
  const n = Math.round(extent / noteSize);
  if (n < 2 || ownRatio < SPLIT_RATIO) return [box];
  const step = extent / n;
  return Array.from({ length: n }, (_, i) => ({
    classId: box.classId,
    x: along === 'x' ? Math.round(box.x + i * step) : box.x,
    y: along === 'y' ? Math.round(box.y + i * step) : box.y,
    w: along === 'x' ? Math.round(step) : box.w,
    h: along === 'y' ? Math.round(step) : box.h,
    pixels: Math.round(box.pixels / n),
  }));
}

export function fitBoxes(components: Component[]): Box[] {
  if (components.length === 0) return [];
  const raw = components.map(boxOf);
  // Specks go FIRST, and against the largest blob rather than the median: the
  // median is the very thing a scattering of specks destroys.
  const largest = Math.max(...raw.map((b) => Math.max(b.w, b.h)));
  const minArea = (largest * MIN_AREA_FRACTION) ** 2;
  const kept = raw.filter((b) => b.w * b.h >= minArea);
  if (kept.length === 0) return [];
  const merged = mergeFragments(kept, medianNoteSize(kept));
  const size = medianNoteSize(merged);
  return merged.flatMap((b) => splitOversized(b, size));
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

export const BOX_CALIBRATION = { MIN_AREA_FRACTION, MERGE_GAP_FRACTION, SPLIT_RATIO } as const;
