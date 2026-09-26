// Turning a photographed wall into notes on the board (docs/specs/021-event-storming/event-storming.md Phase 8).
//
// `reconcilePhoto` is the one entry point the dialog calls. Everything here is
// pure and deterministic: given the same photo reading and the same board, it
// answers the same way, every time — which is what lets a review screen tell
// the author exactly what is about to happen.
//
// The rule the whole module is built around: EXISTING NOTES ARE UNTOUCHABLE.
// An import adds. It never moves, resizes, re-kinds or re-words a note that is
// already there, because the board is the record and the photo is a reading of
// one moment of the wall.

import {
  eventStormingKindOf,
  eventStormingNoteSize,
  type EventStormingNoteKind,
} from './event-storming';
import type { Element, StickyElement } from './index';
import { placeNewNotes } from './event-storming-photo-place';
import {
  applyPhotoTransform,
  defaultPhotoScale,
  fitPhotoTransform,
  matchDetectedNotes,
  noteTextSimilarity,
  type BoardNote,
  type PhotoMatch,
  type PhotoNote,
  type PhotoTransform,
} from './event-storming-photo-match';

export * from './event-storming-photo-match';
export { placeNewNotes, PHOTO_COLUMN_RADIUS } from './event-storming-photo-place';

// How far clear of the board a photo with nothing in common lands.
const SEED_CLEARANCE = 200;

export type PhotoAddition = {
  detectedId: number;
  kind: EventStormingNoteKind;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PhotoDifference = { detectedId: number; boardId: string; boardText: string };

export type PhotoReconciliation = {
  matches: PhotoMatch[];
  additions: PhotoAddition[];
  transform: PhotoTransform;
  // Matched notes whose photo text differs from the board's. SHOWN in review,
  // never applied: the board is the record.
  differences: PhotoDifference[];
};

// A note with no readable kind still has to land as something. Domain event is
// the board's own default — it is the kind the template seeds and the one a
// facilitator corrects fastest, because it is what most of a wall is.
export const UNKNOWN_KIND_FALLBACK: EventStormingNoteKind = 'domain-event';

function kindOf(note: PhotoNote): EventStormingNoteKind {
  return note.kind === 'unknown' ? UNKNOWN_KIND_FALLBACK : note.kind;
}

// Where the whole photo goes when NOTHING in it matches the board: clear to the
// right of everything, with its top row lined up with the board's top row. The
// x axis is time on this board, so a fresh piece of wall is most likely a
// continuation of the story rather than a replacement for it.
function seedOffset(existing: BoardNote[]): { dx: number; dy: number } | null {
  if (existing.length === 0) return null;
  const right = Math.max(...existing.map((n) => n.x + n.width));
  const top = Math.min(...existing.map((n) => n.y));
  return { dx: right + SEED_CLEARANCE, dy: top };
}

// The whole reconciliation, in one call: what the photo shows that the board
// already has, what it shows that is new, where the new things go, and what
// disagrees.
export function reconcilePhoto(
  detected: PhotoNote[],
  existing: BoardNote[],
  opts: { threshold?: number } = {},
): PhotoReconciliation {
  const matches = matchDetectedNotes(detected, existing, { threshold: opts.threshold });
  const matchedDetected = new Map(matches.map((m) => [m.detectedId, m.boardId]));

  const scale = defaultPhotoScale(detected);
  let transform = fitPhotoTransform(matches, detected, existing, scale);
  if (matches.length === 0) {
    // Nothing in common: park the photo clear of the board rather than on top
    // of it (a photo's own coordinates start at 0,0, which is usually exactly
    // where somebody's first note is).
    const seed = seedOffset(existing);
    const minX = Math.min(...detected.map((n) => n.cx - n.w / 2));
    const minY = Math.min(...detected.map((n) => n.cy - n.h / 2));
    transform = seed
      ? { scale, tx: seed.dx - minX * scale, ty: seed.dy - minY * scale }
      : { scale, tx: -minX * scale, ty: -minY * scale };
  }

  const additions: PhotoAddition[] = detected
    .filter((n) => !matchedDetected.has(n.id))
    .map((n) => {
      const kind = kindOf(n);
      // The SILHOUETTE comes from the kind, never from the photo: the
      // stationery is fixed (docs/specs/021-event-storming/event-storming.md Phase 4), and a note photographed at an
      // angle would otherwise arrive slightly the wrong shape forever.
      const size = eventStormingNoteSize(kind);
      const centre = applyPhotoTransform(n, transform);
      return {
        detectedId: n.id,
        kind,
        text: n.text,
        x: centre.x - size.width / 2,
        y: centre.y - size.height / 2,
        width: size.width,
        height: size.height,
      };
    });

  // Photo import is an event-storming verb, and every such board has lanes:
  // rows to lanes, columns lined up, nothing already there moved.
  const placed = placeNewNotes(additions, existing);

  const differences: PhotoDifference[] = [];
  for (const m of matches) {
    const photo = detected.find((d) => d.id === m.detectedId);
    const board = existing.find((b) => b.id === m.boardId);
    if (!photo || !board) continue;
    if (noteTextSimilarity(photo.text, board.text) < 1) {
      differences.push({ detectedId: m.detectedId, boardId: m.boardId, boardText: board.text });
    }
  }

  return { matches, additions: placed, transform, differences };
}

// The board as the reconciliation sees it: the workshop notes, and nothing
// else. A shape or an arrow on the tab is not something a photograph of paper
// can be matched against — and neither is a note still in DRAFT, which is not
// on the board yet in any sense that matters.
export function boardNotesOfElements(elements: Element[]): BoardNote[] {
  const out: BoardNote[] = [];
  for (const el of elements) {
    if (el.type !== 'sticky' || el.esDraft === true) continue;
    const kind = eventStormingKindOf(el);
    if (!kind) continue;
    out.push({
      id: el.id,
      text: el.label ?? '',
      kind,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
    });
  }
  return out;
}

// ---------------------------------------------------------------------
// The draft (docs/specs/021-event-storming/event-storming.md Phase 8)
// ---------------------------------------------------------------------
//
// An import lands ON the board rather than in a dialog: the new notes appear at
// their final positions carrying `esDraft`, and the author reviews them by
// typing into them, dragging them and deleting them — the machinery they
// already know, rather than a second copy of it inside an overlay. These three
// functions are the whole lifecycle.

export function draftNotesOf(elements: Element[]): StickyElement[] {
  return elements.filter((el): el is StickyElement => el.type === 'sticky' && el.esDraft === true);
}

export function hasDraftNotes(elements: Element[]): boolean {
  return elements.some((el) => el.type === 'sticky' && el.esDraft === true);
}

// Accept: the notes stay exactly where the author left them and simply stop
// being a draft. Returns the SAME array when there is no draft, so an ordinary
// commit never churns the memoised views.
export function acceptDraft(elements: Element[]): Element[] {
  if (!hasDraftNotes(elements)) return elements;
  return elements.map((el) => {
    if (el.type !== 'sticky' || el.esDraft !== true) return el;
    const { esDraft: _gone, ...rest } = el;
    void _gone;
    return rest as StickyElement;
  });
}

// Discard: the draft never happened.
export function discardDraft(elements: Element[]): Element[] {
  if (!hasDraftNotes(elements)) return elements;
  return elements.filter((el) => !(el.type === 'sticky' && el.esDraft === true));
}

// Does this change touch ONLY the notes a photo draft brought in?
//
// While a draft is open it owns the history: the landing, and every correction
// the author makes to a draft note, are one gesture that ends at Add or
// Discard. So an edit confined to draft notes is written without a history
// step of its own — and an edit to anything ELSE is not, because the author's
// unrelated work must survive a Discard.
export function onlyDraftNotesChanged(before: Element[], after: Element[]): boolean {
  const isDraft = (el: Element) => el.type === 'sticky' && el.esDraft === true;
  const beforeById = new Map(before.map((el) => [el.id, el] as const));
  const afterById = new Map(after.map((el) => [el.id, el] as const));
  let changed = false;
  for (const el of before) {
    const next = afterById.get(el.id);
    if (next === el) continue;
    // Removed, or edited: either way it has to be a draft note.
    if (!isDraft(el)) return false;
    changed = true;
  }
  for (const el of after) {
    if (beforeById.has(el.id)) continue;
    // Newly arrived: a draft note joining the batch is still the gesture.
    if (!isDraft(el)) return false;
    changed = true;
  }
  return changed;
}
