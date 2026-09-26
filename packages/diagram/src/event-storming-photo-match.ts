// Matching a photographed wall against the board it is being imported into
// (docs/specs/021-event-storming/event-storming.md Phase 8), and working out where the photo sits on the canvas.
//
// This is the half the model is NEVER asked about. "Which of these notes are
// already on the board" is a question about our data: its answer has to be
// deterministic, inspectable and testable, and a model's answer to it could
// not be checked. So the model reports what it SEES and this module decides
// what that means.

import type { EventStormingNoteKind } from './event-storming';

// One note as the model read it, in photo space: every box field a fraction of
// the photo's WIDTH, on both axes, so one scale carries the photo onto the board.
export type PhotoNote = {
  id: number;
  text: string;
  kind: EventStormingNoteKind | 'unknown';
  size: 'square' | 'wide' | 'small';
  cx: number;
  cy: number;
  w: number;
  h: number;
  row: number;
  order: number;
};

// One note as the board holds it, in canvas space.
export type BoardNote = {
  id: string;
  text: string;
  kind: EventStormingNoteKind | 'unknown';
  x: number;
  y: number;
  width: number;
  height: number;
};

// Two readings of the same words. Uppercase because the notation is written in
// capitals anyway; punctuation and repeated spaces go because a marker on
// paper is not careful about either, and "Order placed." and "ORDER  PLACED"
// are the same note by any reading that matters.
export function normaliseNoteText(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(
        prev[j]! + 1,
        row[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length]!;
}

// 0..1, where 1 is "the same words".
//
// The containment FLOOR is what makes this work on a real wall: a sticky with
// another one lapped over its corner reads as a truncation, not as a typo, and
// plain edit distance punishes a missing tail as hard as a wrong word. So a
// reading that is a prefix of (or contained in) the other scores at least half
// its length ratio above the midpoint.
export function noteTextSimilarity(a: string, b: string): number {
  const x = normaliseNoteText(a);
  const y = normaliseNoteText(b);
  if (x === '' || y === '') return 0;
  if (x === y) return 1;
  const ratio = 1 - levenshtein(x, y) / Math.max(x.length, y.length);
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  const contained = long.includes(short);
  return contained ? Math.max(ratio, 0.5 + (0.5 * short.length) / long.length) : Math.max(0, ratio);
}

// How much a kind agreement / disagreement is worth. Small on purpose: the
// words are the evidence, and the colour is corroboration. An 'unknown' kind
// (bad light, a colour the notation does not have) is worth nothing either
// way rather than counting against a note.
const KIND_BONUS = 0.05;
const KIND_PENALTY = 0.15;

export const DEFAULT_MATCH_THRESHOLD = 0.72;

export type PhotoMatch = { detectedId: number; boardId: string; score: number };

function rankOf<T>(items: T[], key: (item: T) => [number, number]): Map<T, number> {
  const sorted = [...items].sort((a, b) => {
    const [ay, ax] = key(a);
    const [by, bx] = key(b);
    return ay - by || ax - bx;
  });
  return new Map(sorted.map((item, i) => [item, sorted.length <= 1 ? 0 : i / (sorted.length - 1)]));
}

// Which photographed notes are notes the board already has. ONE-TO-ONE and
// best-first: the strongest pairing is taken, both sides are struck off, and
// the next strongest is considered against what is left. A wall says the same
// word twice often enough ("PAYMENT FAILED" in two places) that "best overall"
// beats "first that clears the bar".
//
// Where two pairings score the same — which is exactly what duplicate text
// produces — the tie breaks on GEOMETRY: the note whose position in the photo's
// reading order best matches its position in the board's wins, so the left one
// in the photo pairs with the left one on the board.
export function matchDetectedNotes(
  detected: PhotoNote[],
  existing: BoardNote[],
  opts: { threshold?: number } = {},
): PhotoMatch[] {
  const threshold = opts.threshold ?? DEFAULT_MATCH_THRESHOLD;
  const detectedRank = rankOf(detected, (n) => [n.row, n.order]);
  const boardRank = rankOf(existing, (n) => [n.y, n.x]);

  const candidates: (PhotoMatch & { rankGap: number })[] = [];
  for (const d of detected) {
    for (const b of existing) {
      let score = noteTextSimilarity(d.text, b.text);
      if (score <= 0) continue;
      if (d.kind !== 'unknown' && b.kind !== 'unknown') {
        score += d.kind === b.kind ? KIND_BONUS : -KIND_PENALTY;
      }
      if (score < threshold) continue;
      candidates.push({
        detectedId: d.id,
        boardId: b.id,
        score: Math.min(1, score),
        rankGap: Math.abs((detectedRank.get(d) ?? 0) - (boardRank.get(b) ?? 0)),
      });
    }
  }
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.rankGap - b.rankGap ||
      a.detectedId - b.detectedId ||
      a.boardId.localeCompare(b.boardId),
  );

  const takenDetected = new Set<number>();
  const takenBoard = new Set<string>();
  const matches: PhotoMatch[] = [];
  for (const c of candidates) {
    if (takenDetected.has(c.detectedId) || takenBoard.has(c.boardId)) continue;
    takenDetected.add(c.detectedId);
    takenBoard.add(c.boardId);
    matches.push({ detectedId: c.detectedId, boardId: c.boardId, score: c.score });
  }
  return matches;
}

// Photo space -> canvas space. Uniform scale plus translation: a photo of a
// wall is a rectangle photographed roughly square-on, so there is one scale,
// and rotation is not worth guessing at (a few degrees of camera tilt would
// make every note wrong in a way nobody could correct by hand).
export type PhotoTransform = { scale: number; tx: number; ty: number };

// The scale a photo implies on its own: a SQUARE note is 200 canvas px, so the
// median square note's photo width says how many canvas px one photo unit is.
// The median rather than the mean, because one badly-read box should not
// stretch the whole import.
export function defaultPhotoScale(detected: PhotoNote[]): number {
  const widths = detected.filter((n) => n.size === 'square').map((n) => n.w);
  const all = widths.length > 0 ? widths : detected.map((n) => n.w);
  if (all.length === 0) return 200;
  const sorted = [...all].sort((a, b) => a - b);
  const median = sorted[Math.floor((sorted.length - 1) / 2)]!;
  return median > 0 ? 200 / median : 200;
}

// How far the fitted scale may stray from what the photo itself implies. A
// least-squares fit over two matches that happen to sit close together can
// otherwise produce a wild scale from almost no evidence.
const SCALE_CLAMP = [0.5, 2] as const;

export function fitPhotoTransform(
  matches: PhotoMatch[],
  detected: PhotoNote[],
  existing: BoardNote[],
  defaultScale: number,
): PhotoTransform {
  const pairs = matches
    .map((m) => ({
      photo: detected.find((d) => d.id === m.detectedId),
      board: existing.find((b) => b.id === m.boardId),
    }))
    .filter((p): p is { photo: PhotoNote; board: BoardNote } => !!p.photo && !!p.board)
    .map((p) => ({
      px: p.photo.cx,
      py: p.photo.cy,
      qx: p.board.x + p.board.width / 2,
      qy: p.board.y + p.board.height / 2,
    }));

  if (pairs.length === 0) return { scale: defaultScale, tx: 0, ty: 0 };

  const mean = (get: (p: (typeof pairs)[number]) => number) =>
    pairs.reduce((sum, p) => sum + get(p), 0) / pairs.length;
  const pxm = mean((p) => p.px);
  const pym = mean((p) => p.py);
  const qxm = mean((p) => p.qx);
  const qym = mean((p) => p.qy);

  let scale = defaultScale;
  if (pairs.length >= 2) {
    // Least squares over both axes at once: the one scale that best carries
    // every matched centre onto its board counterpart.
    let num = 0;
    let den = 0;
    for (const p of pairs) {
      num += (p.px - pxm) * (p.qx - qxm) + (p.py - pym) * (p.qy - qym);
      den += (p.px - pxm) ** 2 + (p.py - pym) ** 2;
    }
    if (den > 1e-9 && num > 0) scale = num / den;
    scale = Math.min(defaultScale * SCALE_CLAMP[1], Math.max(defaultScale * SCALE_CLAMP[0], scale));
  }
  return { scale, tx: qxm - scale * pxm, ty: qym - scale * pym };
}

export function applyPhotoTransform(
  note: { cx: number; cy: number },
  t: PhotoTransform,
): { x: number; y: number } {
  return { x: t.tx + t.scale * note.cx, y: t.ty + t.scale * note.cy };
}
