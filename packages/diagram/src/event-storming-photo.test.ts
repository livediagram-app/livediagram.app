import { describe, expect, it } from 'vitest';
import {
  acceptDraft,
  defaultPhotoScale,
  discardDraft,
  draftNotesOf,
  hasDraftNotes,
  onlyDraftNotesChanged,
  fitPhotoTransform,
  matchDetectedNotes,
  normaliseNoteText,
  noteTextSimilarity,
  placeNewNotes,
  reconcilePhoto,
  UNKNOWN_KIND_FALLBACK,
  type BoardNote,
  type PhotoAddition,
  type PhotoNote,
} from './event-storming-photo';
import type { Element } from './index';
import { ES_LANE_PITCH, laneCentre, type EsTimeline } from './event-storming-lanes';

// Reconciling a photographed wall against the board (spec/139 Phase 8). The
// rule every one of these protects: an import ADDS. Whatever the photo says,
// the notes already on the board are not touched.

function photo(over: Partial<PhotoNote> & { id: number }): PhotoNote {
  return {
    text: 'Order placed',
    kind: 'domain-event',
    size: 'square',
    cx: 0.2,
    cy: 0.2,
    w: 0.1,
    h: 0.1,
    row: 0,
    order: 0,
    ...over,
  };
}

function board(over: Partial<BoardNote> & { id: string }): BoardNote {
  return {
    text: 'Order placed',
    kind: 'domain-event',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    ...over,
  };
}

describe('normaliseNoteText', () => {
  it('reads two writings of the same words as the same', () => {
    expect(normaliseNoteText('Order placed.')).toBe(normaliseNoteText('ORDER   PLACED'));
    expect(normaliseNoteText("  Payment's received! ")).toBe('PAYMENT S RECEIVED');
  });
});

describe('noteTextSimilarity', () => {
  it('is 1 for the same words however they were written', () => {
    expect(noteTextSimilarity('Order placed', 'ORDER PLACED.')).toBe(1);
  });

  it('survives a typo', () => {
    expect(noteTextSimilarity('Order placed', 'Order placed')).toBeGreaterThan(0.8);
  });

  it('survives a note read through another note lapped over it', () => {
    // A quarter of the phrase hidden is the commonest real failure.
    expect(noteTextSimilarity('Payment received', 'Payment rec')).toBeGreaterThan(0.72);
  });

  it('is near zero for unrelated notes', () => {
    expect(noteTextSimilarity('Order placed', 'Refund issued')).toBeLessThan(0.4);
  });

  it('is zero against nothing at all', () => {
    expect(noteTextSimilarity('', 'Order placed')).toBe(0);
  });
});

describe('matchDetectedNotes', () => {
  it('finds nothing on an empty board', () => {
    expect(matchDetectedNotes([photo({ id: 1 })], [])).toEqual([]);
  });

  it('pairs a note with the one it already is', () => {
    const out = matchDetectedNotes([photo({ id: 1 })], [board({ id: 'a' })]);
    expect(out).toEqual([{ detectedId: 1, boardId: 'a', score: 1 }]);
  });

  it('pairs one-to-one, never two photos onto one note', () => {
    const out = matchDetectedNotes(
      [photo({ id: 1 }), photo({ id: 2, order: 1 })],
      [board({ id: 'a' })],
    );
    expect(out).toHaveLength(1);
  });

  it('leaves an unrelated note unmatched', () => {
    const out = matchDetectedNotes([photo({ id: 1, text: 'Refund issued' })], [board({ id: 'a' })]);
    expect(out).toEqual([]);
  });

  it('lets the colour corroborate, and disagree', () => {
    const near = { text: 'Order plaeced' };
    const agreeing = matchDetectedNotes(
      [photo({ id: 1, ...near, kind: 'domain-event' })],
      [board({ id: 'a', kind: 'domain-event' })],
    );
    const disagreeing = matchDetectedNotes(
      [photo({ id: 1, ...near, kind: 'command' })],
      [board({ id: 'a', kind: 'domain-event' })],
    );
    expect(agreeing[0]!.score).toBeGreaterThan(disagreeing[0]?.score ?? 0);
  });

  it('lets an unreadable colour match on the words alone', () => {
    const out = matchDetectedNotes(
      [photo({ id: 1, kind: 'unknown' })],
      [board({ id: 'a', kind: 'domain-event' })],
    );
    expect(out).toHaveLength(1);
  });

  it('breaks a duplicate-text tie on where the notes sit', () => {
    // The same words twice. The ids run the OPPOSITE way to the geometry, so
    // an id-order tie-break would cross the pairs over: the left note in the
    // photo must pair with the left note on the board regardless.
    const detected = [
      photo({ id: 1, row: 0, order: 1, cx: 0.8 }),
      photo({ id: 2, row: 0, order: 0, cx: 0.1 }),
    ];
    const existing = [board({ id: 'a-left', x: 0 }), board({ id: 'z-right', x: 900 })];
    const out = matchDetectedNotes(detected, existing);
    expect(new Set(out.map((m) => `${m.detectedId}->${m.boardId}`))).toEqual(
      new Set(['2->a-left', '1->z-right']),
    );
  });

  it('honours a threshold the caller chooses', () => {
    const near = [photo({ id: 1, text: 'Payment rec' })];
    expect(matchDetectedNotes(near, [board({ id: 'a', text: 'Payment received' })])).toHaveLength(
      1,
    );
    expect(
      matchDetectedNotes(near, [board({ id: 'a', text: 'Payment received' })], {
        threshold: 0.99,
      }),
    ).toHaveLength(0);
  });
});

describe('defaultPhotoScale', () => {
  it('reads the scale off the median SQUARE note', () => {
    // A square note is 200 canvas px; at 0.1 of the image it implies 2000.
    expect(defaultPhotoScale([photo({ id: 1, w: 0.1 }), photo({ id: 2, w: 0.1 })])).toBe(2000);
  });

  it('is not thrown by one badly-read box', () => {
    const notes = [photo({ id: 1, w: 0.1 }), photo({ id: 2, w: 0.1 }), photo({ id: 3, w: 0.9 })];
    expect(defaultPhotoScale(notes)).toBe(2000);
  });

  it('falls back to the other silhouettes when there is no square', () => {
    expect(defaultPhotoScale([photo({ id: 1, size: 'wide', w: 0.2 })])).toBe(1000);
  });
});

describe('fitPhotoTransform', () => {
  const scale = 2000;

  it('recovers a known scale and offset from two matches', () => {
    const detected = [photo({ id: 1, cx: 0.1, cy: 0.1 }), photo({ id: 2, cx: 0.3, cy: 0.1 })];
    // Board centres 400 apart for 0.2 of photo => scale 2000, offset 100.
    const existing = [board({ id: 'a', x: 0, y: 0 }), board({ id: 'b', x: 400, y: 0 })];
    const t = fitPhotoTransform(
      [
        { detectedId: 1, boardId: 'a', score: 1 },
        { detectedId: 2, boardId: 'b', score: 1 },
      ],
      detected,
      existing,
      scale,
    );
    expect(t.scale).toBeCloseTo(2000, 6);
    expect(t.tx).toBeCloseTo(-100, 6);
  });

  it('uses the photo’s own scale when there is only one match to go on', () => {
    const t = fitPhotoTransform(
      [{ detectedId: 1, boardId: 'a', score: 1 }],
      [photo({ id: 1, cx: 0.5, cy: 0.5 })],
      [board({ id: 'a', x: 900, y: 400 })],
      scale,
    );
    expect(t.scale).toBe(scale);
    // The one match lands exactly on its counterpart.
    expect(t.tx + t.scale * 0.5).toBeCloseTo(1000, 6);
    expect(t.ty + t.scale * 0.5).toBeCloseTo(500, 6);
  });

  it('clamps a wild fit back towards what the photo itself implies', () => {
    // Two matches almost on top of each other in the photo, far apart on the
    // board: least squares would infer an enormous scale from nothing.
    const detected = [photo({ id: 1, cx: 0.5, cy: 0.5 }), photo({ id: 2, cx: 0.51, cy: 0.5 })];
    const existing = [board({ id: 'a', x: 0 }), board({ id: 'b', x: 5000 })];
    const t = fitPhotoTransform(
      [
        { detectedId: 1, boardId: 'a', score: 1 },
        { detectedId: 2, boardId: 'b', score: 1 },
      ],
      detected,
      existing,
      scale,
    );
    expect(t.scale).toBeLessThanOrEqual(scale * 2);
    expect(t.scale).toBeGreaterThanOrEqual(scale * 0.5);
  });
});

describe('placeNewNotes', () => {
  const transform = { scale: 2000, tx: 0, ty: 0 };

  const addition = (over: Partial<PhotoAddition> & { detectedId: number }): PhotoAddition => ({
    kind: 'domain-event',
    text: 'New',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    ...over,
  });

  it('leaves an addition where the transform put it when nothing is there', () => {
    const out = placeNewNotes([addition({ detectedId: 1, x: 500, y: 300 })], transform, []);
    expect(out[0]).toMatchObject({ x: 500, y: 300 });
  });

  it('joins the row it nearly landed in', () => {
    const existing = [board({ id: 'a', x: 0, y: 500 })];
    const out = placeNewNotes([addition({ detectedId: 1, x: 900, y: 560 })], transform, existing);
    expect(out[0]!.y).toBe(500);
  });

  it('starts its own row when it is nowhere near one', () => {
    const existing = [board({ id: 'a', x: 0, y: 500 })];
    const out = placeNewNotes([addition({ detectedId: 1, x: 900, y: 900 })], transform, existing);
    expect(out[0]!.y).toBe(900);
  });

  it('pushes only the NEW note aside when they collide', () => {
    const existing = [board({ id: 'a', x: 500, y: 0 })];
    const frozen = JSON.stringify(existing);
    const out = placeNewNotes([addition({ detectedId: 1, x: 520, y: 0 })], transform, existing);
    expect(out[0]!.x).toBe(500 + 200 + 72);
    expect(JSON.stringify(existing)).toBe(frozen);
  });

  it('keeps additions off each other too', () => {
    const out = placeNewNotes(
      [addition({ detectedId: 1, x: 0, y: 0 }), addition({ detectedId: 2, x: 40, y: 0 })],
      transform,
      [],
    );
    expect(out[1]!.x).toBeGreaterThanOrEqual(out[0]!.x + 200);
  });

  it('lands on the lanes when the board has them on, without moving x', () => {
    const timeline: EsTimeline = { originY: 0 };
    const out = placeNewNotes(
      [addition({ detectedId: 1, x: 307, y: ES_LANE_PITCH + 9 })],
      transform,
      [],
      { timeline },
    );
    // Rows are tidied; x is left exactly where the wall had it.
    expect(out[0]!.x).toBe(307);
    expect(out[0]!.y).toBe(laneCentre(1, timeline) - 100);
  });
});

describe('reconcilePhoto', () => {
  it('adds everything, in the photo’s own layout, on an empty board', () => {
    const detected = [
      photo({ id: 1, text: 'Order placed', cx: 0.1, cy: 0.1, w: 0.1, h: 0.1 }),
      photo({ id: 2, text: 'Payment received', cx: 0.3, cy: 0.1, w: 0.1, h: 0.1, order: 1 }),
    ];
    const out = reconcilePhoto(detected, []);
    expect(out.matches).toEqual([]);
    expect(out.additions.map((a) => a.text)).toEqual(['Order placed', 'Payment received']);
    // The second sits to the right of the first, by the photo's own spacing.
    expect(out.additions[1]!.x).toBeGreaterThan(out.additions[0]!.x);
    expect(out.additions[0]!.width).toBe(200);
  });

  it('adds NOTHING for a photo of a region already on the board', () => {
    const detected = [
      photo({ id: 1, text: 'Order placed', cx: 0.1, cy: 0.1 }),
      photo({ id: 2, text: 'Payment received', cx: 0.3, cy: 0.1, order: 1 }),
    ];
    const existing = [
      board({ id: 'a', text: 'Order placed', x: 0 }),
      board({ id: 'b', text: 'Payment received', x: 400 }),
    ];
    const out = reconcilePhoto(detected, existing);
    expect(out.additions).toEqual([]);
    expect(out.matches).toHaveLength(2);
  });

  it('adds only what is new when the photo overlaps the board', () => {
    const detected = [
      photo({ id: 1, text: 'Order placed', cx: 0.1, cy: 0.1, w: 0.1, h: 0.1 }),
      photo({ id: 2, text: 'Payment received', cx: 0.3, cy: 0.1, w: 0.1, h: 0.1, order: 1 }),
      photo({ id: 3, text: 'Order shipped', cx: 0.5, cy: 0.1, w: 0.1, h: 0.1, order: 2 }),
    ];
    const existing = [
      board({ id: 'a', text: 'Order placed', x: 0 }),
      board({ id: 'b', text: 'Payment received', x: 400 }),
    ];
    const frozen = JSON.stringify(existing);
    const out = reconcilePhoto(detected, existing);
    expect(out.additions.map((a) => a.text)).toEqual(['Order shipped']);
    // Placed where the photo says it was: to the right of the matched pair.
    expect(out.additions[0]!.x).toBeGreaterThan(400);
    expect(out.additions[0]!.y).toBe(0);
    // And not one existing note was touched.
    expect(JSON.stringify(existing)).toBe(frozen);
  });

  it('parks a photo with nothing in common clear of the board', () => {
    const detected = [photo({ id: 1, text: 'Refund issued', cx: 0.1, cy: 0.1, w: 0.1, h: 0.1 })];
    const existing = [board({ id: 'a', text: 'Order placed', x: 0, y: 240 })];
    const out = reconcilePhoto(detected, existing);
    expect(out.additions[0]!.x).toBeGreaterThanOrEqual(200 + 200);
    expect(out.additions[0]!.y).toBe(240);
  });

  it('shows a text difference without applying it', () => {
    const detected = [photo({ id: 1, text: 'Order plaeced' })];
    const existing = [board({ id: 'a', text: 'Order placed' })];
    const out = reconcilePhoto(detected, existing);
    expect(out.matches).toHaveLength(1);
    expect(out.differences).toEqual([{ detectedId: 1, boardId: 'a', boardText: 'Order placed' }]);
    expect(out.additions).toEqual([]);
  });

  it('lands an unreadable colour as the board’s default kind', () => {
    const out = reconcilePhoto([photo({ id: 1, kind: 'unknown', text: 'Something' })], []);
    expect(out.additions[0]!.kind).toBe(UNKNOWN_KIND_FALLBACK);
  });

  it('lands additions on the lanes — every event-storming board has them', () => {
    const timeline: EsTimeline = { originY: 0 };
    const out = reconcilePhoto(
      [photo({ id: 1, text: 'New', cx: 0.1, cy: 0.1, w: 0.1, h: 0.1 })],
      [],
    );
    expect(out.additions[0]!.y).toBe(laneCentre(0, timeline) - out.additions[0]!.height / 2);
  });
});

// The draft lifecycle (spec/139 Phase 8). The notes are IN the document while
// the author reviews them, so these three answers are what keep that honest.
describe('the photo draft', () => {
  const draft = (id: string, over: Record<string, unknown> = {}) =>
    ({
      id,
      type: 'sticky',
      esKind: 'domain-event',
      fixedSize: true,
      esDraft: true,
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      ...over,
    }) as unknown as Element;
  const settled = (id: string) =>
    ({
      id,
      type: 'sticky',
      esKind: 'domain-event',
      fixedSize: true,
      x: 900,
      y: 0,
      width: 200,
      height: 200,
    }) as unknown as Element;

  it('finds the notes a photo landed', () => {
    expect(draftNotesOf([settled('a'), draft('d')]).map((n) => n.id)).toEqual(['d']);
    expect(hasDraftNotes([settled('a')])).toBe(false);
  });

  it('accepts by dropping the flag and nothing else', () => {
    const after = acceptDraft([settled('a'), draft('d', { label: 'Typed by hand', x: 42 })]);
    const accepted = after[1] as { esDraft?: unknown; label?: string; x: number };
    expect('esDraft' in accepted).toBe(false);
    expect(accepted).toMatchObject({ label: 'Typed by hand', x: 42 });
    // The note that was already there is not even re-created.
    expect(after[0]).toMatchObject({ id: 'a', x: 900 });
    expect('esDraft' in (after[0] as object)).toBe(false);
  });

  it('leaves a board with no draft alone, object identity included', () => {
    const board = [settled('a')];
    expect(acceptDraft(board)).toBe(board);
    expect(discardDraft(board)).toBe(board);
  });

  it('discards by removing the notes, leaving everything else untouched', () => {
    const board = [settled('a'), draft('d')];
    const after = discardDraft(board);
    expect(after).toHaveLength(1);
    expect(after[0]).toBe(board[0]);
  });
});

// Who owns the history while a draft is open (spec/139 Phase 8).
describe('onlyDraftNotesChanged', () => {
  const draft = {
    id: 'd',
    type: 'sticky',
    esDraft: true,
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  } as unknown as Element;
  const settled = {
    id: 'a',
    type: 'sticky',
    x: 900,
    y: 0,
    width: 200,
    height: 200,
  } as unknown as Element;

  it('is false when nothing changed', () => {
    expect(onlyDraftNotesChanged([settled, draft], [settled, draft])).toBe(false);
  });

  it('is true for an edit to a draft note', () => {
    const edited = { ...(draft as object), label: 'Typed' } as Element;
    expect(onlyDraftNotesChanged([settled, draft], [settled, edited])).toBe(true);
  });

  it('is true for a draft note deleted from the batch', () => {
    expect(onlyDraftNotesChanged([settled, draft], [settled])).toBe(true);
  });

  it('is FALSE the moment the author touches something else', () => {
    const edited = { ...(settled as object), label: 'Their own work' } as Element;
    expect(onlyDraftNotesChanged([settled, draft], [edited, draft])).toBe(false);
  });

  it('is false when a non-draft element arrives', () => {
    const other = { ...(settled as object), id: 'new' } as Element;
    expect(onlyDraftNotesChanged([settled, draft], [settled, draft, other])).toBe(false);
  });
});

// An illegible crop (spec/139 Phase 8): the detector SAW the paper, the model
// could not read it. The note still has to land — empty, for the author to
// fill in — and it must never be mistaken for a note the board already has.
describe('a note the model could not read', () => {
  it('never matches anything, however empty the board note is', () => {
    const empty = [photo({ id: 1, text: '' })];
    expect(matchDetectedNotes(empty, [board({ id: 'a', text: 'Order placed' })])).toEqual([]);
    expect(matchDetectedNotes(empty, [board({ id: 'a', text: '' })])).toEqual([]);
  });

  it('lands as an empty draft note of the kind the DETECTOR measured', () => {
    const out = reconcilePhoto([photo({ id: 1, text: '', kind: 'policy' })], []);
    expect(out.additions).toHaveLength(1);
    expect(out.additions[0]).toMatchObject({ text: '', kind: 'policy', width: 300 });
  });

  it('does not report a difference it cannot have', () => {
    const out = reconcilePhoto([photo({ id: 1, text: '' })], [board({ id: 'a' })]);
    expect(out.differences).toEqual([]);
  });
});
