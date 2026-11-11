import { describe, expect, it } from 'vitest';
import type { ElementDelta, NoticeNote, ShapeElement, Tab } from './index';
import {
  applyElementDelta,
  elementChangeIsDeltaOnly,
  graftLiveTabState,
  mergeIncomingElement,
  mergeLedgerAnswersIntoTab,
  mergeLedgerIntoTab,
  NOTES_MAX,
  recordInLedger,
  type ElementLedger,
  type TabLedger,
} from './index';

// A Notice Board's notes travel as deltas (docs/specs/009-elements/social-pieces.md "Notice Board";
// docs/specs/012-collaboration/collab-race-hardening.md).

const board = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'board',
  type: 'shape',
  shape: 'notice-board',
  x: 0,
  y: 0,
  width: 176,
  height: 128,
  ...over,
});

const note = (id: string, by = 'adder-a', at = 1): NoticeNote => ({
  id,
  text: `note ${id}`,
  author: 'Sam',
  by,
  at,
});

const pin = (n: NoticeNote): ElementDelta => ({ kind: 'notice-pin', note: n });
const unpin = (noteId: string, by: string): ElementDelta => ({ kind: 'notice-unpin', noteId, by });

const apply = (el: ShapeElement, ...deltas: ElementDelta[]) =>
  deltas.reduce<ShapeElement>((e, d) => applyElementDelta(e, d) as ShapeElement, el);

const ids = (el: ShapeElement) => (el.noticeNotes ?? []).map((n) => n.id);

describe('notice-pin and notice-unpin', () => {
  it('stores only the fields a note has, so a padded pin cannot grow the tab', () => {
    const full: NoticeNote = { ...note('a'), title: 'T', color: 'yellow', day: '2026-11-09' };
    const padded = { ...full, pad: 'x'.repeat(100_000) } as NoticeNote;
    expect(apply(board(), pin(padded)).noticeNotes).toEqual([full]);
    expect(apply(board(), pin(note('b'))).noticeNotes).toEqual([note('b')]);
  });

  it('pins a note at the end and unpins it by id and signer', () => {
    const pinned = apply(board(), pin(note('a')), pin(note('b', 'adder-b')));
    expect(ids(pinned)).toEqual(['a', 'b']);
    const unpinned = apply(pinned, unpin('a', 'adder-a'));
    expect(ids(unpinned)).toEqual(['b']);
    // The last note gone drops the field.
    expect(apply(unpinned, unpin('b', 'adder-b'))).not.toHaveProperty('noticeNotes');
  });

  it('returns the same element when nothing changes', () => {
    const one = apply(board(), pin(note('a')));
    // A replay of the same id.
    expect(applyElementDelta(one, pin(note('a')))).toBe(one);
    // An unpin naming another signer: a Participant can never take down someone else's note.
    expect(applyElementDelta(one, unpin('a', 'adder-b'))).toBe(one);
    // A note that is not there.
    expect(applyElementDelta(one, unpin('zz', 'adder-a'))).toBe(one);
  });

  it('refuses a pin past the cap, so two pins racing for the last place settle in order', () => {
    const notes = Array.from({ length: NOTES_MAX - 1 }, (_, i) => note(`n${i}`));
    const nearlyFull = board({ noticeNotes: notes });
    const first = apply(nearlyFull, pin(note('x')), pin(note('y')));
    expect(first.noticeNotes).toHaveLength(NOTES_MAX);
    expect(ids(first)).toContain('x');
    expect(ids(first)).not.toContain('y');
  });

  it('refuses another shape and a malformed note', () => {
    const square = board({ shape: 'focus-button' });
    expect(applyElementDelta(square, pin(note('a')))).toBe(square);
    const plain = board();
    const bad = [
      { ...note('a'), text: '   ' },
      { ...note('a'), text: 'x'.repeat(281) },
      { ...note('a'), by: '' },
      { ...note('a'), color: 'orange' },
      null,
    ];
    for (const n of bad) {
      expect(applyElementDelta(plain, { kind: 'notice-pin', note: n as NoticeNote })).toBe(plain);
    }
    const one = apply(board(), pin(note('a')));
    expect(
      applyElementDelta(one, { kind: 'notice-unpin', noteId: 5, by: 'adder-a' } as never),
    ).toBe(one);
    expect(applyElementDelta(one, { kind: 'notice-unpin', noteId: 'a' } as never)).toBe(one);
  });
});

describe('a whole-element update never carries notes', () => {
  it('keeps the receiver notes when a peer update arrives', () => {
    const local = board({ noticeNotes: [note('a'), note('b')] });
    const moved = board({ x: 50, noticeNotes: [note('a')] });
    const merged = mergeIncomingElement(local, moved) as ShapeElement;
    expect(merged.x).toBe(50);
    expect(ids(merged)).toEqual(['a', 'b']);
    // A peer copy with notes, onto a board that has none here.
    const empty = mergeIncomingElement(board(), moved) as ShapeElement;
    expect(empty.x).toBe(50);
    expect(empty).not.toHaveProperty('noticeNotes');
    // The same array: nothing to carry.
    const same = board({ x: 9, noticeNotes: local.noticeNotes });
    expect(mergeIncomingElement(local, same)).toBe(same);
  });

  it('lands a pin and a concurrent move on every peer, in either order', () => {
    const start = board({ noticeNotes: [note('a')] });
    // The Editor moves the board: its update carries the notes it had.
    const move = { ...start, x: 300 };
    const pinNew = pin(note('new', 'adder-p', 2));
    // Pin first, then the move arrives.
    const pinThenMove = mergeIncomingElement(apply(start, pinNew), move) as ShapeElement;
    // Move first, then the pin arrives.
    const moveThenPin = apply(mergeIncomingElement(start, move) as ShapeElement, pinNew);
    for (const end of [pinThenMove, moveThenPin]) {
      expect(end.x).toBe(300);
      expect(ids(end)).toEqual(['a', 'new']);
    }
  });

  it('lands two Editors pinning at once, in either order', () => {
    const start = board();
    const p1 = pin(note('one', 'k1', 1));
    const p2 = pin(note('two', 'k2', 2));
    expect(ids(apply(start, p1, p2)).sort()).toEqual(ids(apply(start, p2, p1)).sort());
    expect(ids(apply(start, p1, p2))).toHaveLength(2);
  });

  it('sends no element update when only the notes changed', () => {
    const before = board();
    const after = apply(before, pin(note('a')));
    expect(elementChangeIsDeltaOnly(before, after)).toBe(true);
    expect(elementChangeIsDeltaOnly(before, { ...after, x: 1 })).toBe(false);
  });

  it('keeps the live notes over an undo or redo', () => {
    const tab = (el: ShapeElement): Tab => ({ id: 't', name: 'T', elements: [el] });
    const live = tab(board({ x: 10, noticeNotes: [note('a'), note('b')] }));
    // An undo to before the move and before the second pin.
    const restored = graftLiveTabState([live], [tab(board({ noticeNotes: [note('a')] }))]);
    const el = restored[0]!.elements[0] as ShapeElement;
    expect(el.x).toBe(0);
    expect(ids(el)).toEqual(['a', 'b']);
    // Every note unpinned since the snapshot stays unpinned.
    const cleared = graftLiveTabState([tab(board())], [tab(board({ noticeNotes: [note('a')] }))]);
    expect(cleared[0]!.elements[0]).not.toHaveProperty('noticeNotes');
  });
});

describe('the ledger keeps notes', () => {
  const op = (delta: ElementDelta) => ({ kind: 'el-delta', tabId: 't', elementId: 'board', delta });
  const record = (...steps: [ElementDelta, number][]) =>
    steps.reduce<ElementLedger | undefined>(
      (prev, [delta, seq]) => recordInLedger(prev, op(delta), seq) ?? prev,
      undefined,
    );
  const ledgerOf = (entry: ElementLedger | undefined): TabLedger => ({
    elements: entry ? { board: entry } : {},
  });
  const tabOf = (el: ShapeElement): Tab => ({ id: 't', name: 'T', elements: [el] });
  const boardIn = (tab: Tab) => tab.elements[0] as ShapeElement;

  it('records pins and unpins, refusing malformed ones and replays', () => {
    const entry = record([pin(note('a')), 1], [unpin('a', 'adder-a'), 2]);
    // The unpin takes its pin's place: the pair is one event.
    expect(Object.keys(entry!.notes!.pins)).toEqual([]);
    expect(entry!.notes!.unpins.a).toEqual({ by: 'adder-a', seq: 2 });
    // One naming another signer removes nothing, so the pin stays.
    const forged = record([pin(note('b')), 1], [unpin('b', 'adder-x'), 2]);
    expect(Object.keys(forged!.notes!.pins)).toEqual(['b']);
    expect(recordInLedger(entry, op(pin(note('a'))), 3)).toBeNull();
    expect(recordInLedger(undefined, op(pin({ ...note('a'), text: '' })), 1)).toBeNull();
    expect(
      recordInLedger(undefined, op({ kind: 'notice-unpin', noteId: 7 } as never), 1),
    ).toBeNull();
  });

  it('stays bounded by letting its oldest events go, so new pins are still recorded', () => {
    let entry: ElementLedger | undefined;
    for (let i = 0; i < NOTES_MAX * 4; i++) {
      entry = recordInLedger(entry, op(pin(note(`n${i}`))), i + 1) ?? entry;
    }
    const late = recordInLedger(entry, op(pin(note('late'))), 999);
    expect(late!.notes!.pins).toHaveProperty('late');
    expect(late!.notes!.pins).not.toHaveProperty('n0');
    expect(Object.keys(late!.notes!.pins)).toHaveLength(NOTES_MAX * 4);
    const unpinned = recordInLedger(late!, op(unpin('gone', 'adder-a')), 1000);
    expect(unpinned!.notes!.unpins).toHaveProperty('gone');
    expect(Object.keys(unpinned!.notes!.pins)).toHaveLength(NOTES_MAX * 4 - 1);
    // A replayed unpin overwrites its own event and lets nothing go.
    const again = recordInLedger(unpinned!, op(unpin('gone', 'adder-a')), 1001);
    expect(Object.keys(again!.notes!.pins)).toHaveLength(NOTES_MAX * 4 - 1);
  });

  it("keeps writing a Participant's pins on a busy board, past hundreds of pins and unpins", () => {
    let entry: ElementLedger | undefined;
    for (let i = 0; i < NOTES_MAX * 5; i++) {
      entry = recordInLedger(entry, op(pin(note(`n${i}`, 'adder-p'))), 2 * i + 1) ?? entry;
      entry = recordInLedger(entry, op(unpin(`n${i}`, 'adder-p')), 2 * i + 2) ?? entry;
    }
    entry = recordInLedger(entry, op(pin(note('today', 'adder-p'))), 9999) ?? entry;
    const written = boardIn(mergeLedgerAnswersIntoTab(tabOf(board()), ledgerOf(entry)));
    expect(ids(written)).toEqual(['today']);
  });

  it("never writes a pin refused on a full board once the board has room, given the last write's position", () => {
    const full = Array.from({ length: NOTES_MAX }, (_, i) => note(`n${i}`, 'adder-e'));
    // Refused live at seq 1: the board was full. Written through seq 1, then an Editor unpins at seq 2.
    let entry = record([pin(note('late', 'adder-p')), 1]);
    const first = boardIn(
      mergeLedgerAnswersIntoTab(tabOf(board({ noticeNotes: full })), ledgerOf(entry), 0),
    );
    expect(ids(first)).not.toContain('late');
    entry = recordInLedger(entry, op(unpin('n0', 'adder-e')), 2) ?? entry;
    const roomy = tabOf(board({ noticeNotes: full.slice(1) }));
    expect(ids(boardIn(mergeLedgerAnswersIntoTab(roomy, ledgerOf(entry), 1)))).not.toContain(
      'late',
    );
  });

  it('stores only the fields a note has', () => {
    const padded = { ...note('a'), junk: 'x'.repeat(1000) } as NoticeNote;
    const entry = record([pin(padded), 1]);
    expect(entry!.notes!.pins.a!.note).not.toHaveProperty('junk');
  });

  it('merges the pins a save had not seen, after a whole-element save snapshotted before them', () => {
    const entry = record([pin(note('early')), 1], [pin(note('late', 'adder-b')), 5]);
    // The Editor saved its move at cursor 4: it already had `early`, not `late`.
    const saved = tabOf(board({ x: 300, noticeNotes: [note('early')] }));
    const merged = boardIn(mergeLedgerIntoTab(saved, ledgerOf(entry), 4));
    expect(merged.x).toBe(300);
    expect(ids(merged)).toEqual(['early', 'late']);
    // An unpin after the cursor lands too, a pin before it does not come back.
    const withUnpin = record([pin(note('early')), 1], [unpin('early', 'adder-a'), 6]);
    expect(boardIn(mergeLedgerIntoTab(saved, ledgerOf(withUnpin), 4))).not.toHaveProperty(
      'noticeNotes',
    );
    const noNotes = tabOf(board());
    expect(mergeLedgerIntoTab(noNotes, ledgerOf(record([pin(note('a')), 1])), 4)).toBe(noNotes);
  });

  it("writes a Participant's notes into the stored board, checked against the stored signer", () => {
    const stored = tabOf(board({ noticeNotes: [note('theirs', 'adder-b')] }));
    const entry = record(
      [pin(note('mine', 'adder-p')), 1],
      // A forged unpin of someone else's note (the room's gate stops it; the stored signer stops it too).
      [unpin('theirs', 'adder-p'), 2],
    );
    const written = boardIn(mergeLedgerAnswersIntoTab(stored, ledgerOf(entry)));
    expect(ids(written)).toEqual(['theirs', 'mine']);
    // Applying it twice changes nothing more.
    const again = mergeLedgerAnswersIntoTab(tabOf(written), ledgerOf(entry));
    expect(ids(boardIn(again))).toEqual(['theirs', 'mine']);
  });
});
