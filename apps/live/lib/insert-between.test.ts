import { describe, expect, it } from 'vitest';
import type { ArrowElement, Element, StickyElement } from '@livediagram/diagram';
import {
  DEFAULT_INSERTION_GAP,
  applyInsertionShift,
  canInsertBetweenOn,
  findInsertionSlot,
  insertElementAt,
  insertionGhostCentre,
} from './insert-between';

// A 200x200 workshop note at (x, y) — the event-storming square silhouette.
function note(id: string, x: number, y = 0, width = 200, height = 200): StickyElement {
  return { id, type: 'sticky', x, y, width, height, label: id } as StickyElement;
}

function arrow(id: string, from: { x: number; y: number }, to: { x: number; y: number }) {
  return {
    id,
    type: 'arrow',
    from: { kind: 'free', ...from },
    to: { kind: 'free', ...to },
  } as ArrowElement;
}

// A row of three 200-wide notes with 72 gaps: 0..200, 272..472, 544..744.
const ROW: Element[] = [note('a', 0), note('b', 272), note('c', 544)];

function slotAt(cursorX: number, cursorY = 100, elements: Element[] = ROW, incomingWidth = 200) {
  return findInsertionSlot({ cursorX, cursorY, incomingWidth, elements });
}

describe('findInsertionSlot', () => {
  it('offers no slot on an empty board', () => {
    expect(slotAt(100, 100, [])).toBeNull();
  });

  it('offers no slot with a single note — there is no gap between two things', () => {
    expect(slotAt(300, 100, [note('a', 0)])).toBeNull();
  });

  it('offers no slot while the cursor is over a note', () => {
    expect(slotAt(100)).toBeNull();
    expect(slotAt(350)).toBeNull();
  });

  it('offers no slot beyond the ends of the row (no leading / trailing insert in v1)', () => {
    expect(slotAt(-300)).toBeNull();
    expect(slotAt(1200)).toBeNull();
  });

  it('offers no slot when the cursor is nowhere near the row', () => {
    expect(slotAt(236, 900)).toBeNull();
  });

  it('opens a slot in the gap between two notes', () => {
    const slot = slotAt(236);
    expect(slot).not.toBeNull();
    expect(slot?.leftId).toBe('a');
    expect(slot?.rightId).toBe('b');
    // The insertion point is the right-hand note's LEFT EDGE: the new note
    // takes its place, so every existing gap is preserved exactly.
    expect(slot?.atX).toBe(272);
    // Slot width = the incoming note + the row's prevailing gap.
    expect(slot?.shiftDx).toBe(272);
    // Vertically it centres on the note it displaces.
    expect(slot?.atY).toBe(100);
  });

  it('shifts the right-hand note and everything after it, and nothing before', () => {
    const slot = slotAt(236);
    expect(new Set(slot?.shiftedIds)).toEqual(new Set(['b', 'c']));
  });

  // The second entry point (spec/139): a note ALREADY on the board is dragged
  // into a gap. It is the thing being inserted, so it must neither define the
  // row nor be pushed aside by its own arrival.
  describe('when the incoming note is already on the board', () => {
    // a, b, c as above plus d far to the right — d is the one being moved.
    const WITH_D: Element[] = [...ROW, note('d', 816)];
    const dragging = (cursorX: number, cursorY = 100) =>
      findInsertionSlot({
        cursorX,
        cursorY,
        incomingWidth: 200,
        elements: WITH_D,
        excludeId: 'd',
      });

    it('never pushes the dragged note aside to make room for itself', () => {
      const slot = dragging(236);
      expect(slot?.leftId).toBe('a');
      expect(slot?.rightId).toBe('b');
      expect(new Set(slot?.shiftedIds)).toEqual(new Set(['b', 'c']));
      expect(slot?.shiftedIds).not.toContain('d');
    });

    it('ignores the dragged note when reading the row it is hovering', () => {
      // The dragged note is sitting right where the cursor is; without the
      // exclusion it would be its own left-hand neighbour and the gap would
      // resolve against itself.
      const overlapping: Element[] = [note('a', 0), note('b', 272), note('drag', 210)];
      const slot = findInsertionSlot({
        cursorX: 236,
        cursorY: 100,
        incomingWidth: 200,
        elements: overlapping,
        excludeId: 'drag',
      });
      expect(slot?.leftId).toBe('a');
      expect(slot?.rightId).toBe('b');
    });

    it('leaves a hole where the note came from — nothing closes up behind it', () => {
      const slot = dragging(236)!;
      const after = applyInsertionShift(WITH_D, slot);
      const xOf = (id: string) => (after.find((el) => el.id === id) as StickyElement).x;
      // Everything from the insertion point rightwards opens up...
      expect(xOf('a')).toBe(0);
      expect(xOf('b')).toBe(272 + slot.shiftDx);
      expect(xOf('c')).toBe(544 + slot.shiftDx);
      // ...and the dragged note's ORIGINAL position is simply vacated. The
      // source gap is the author's to tidy; predictable beats clever.
      expect(xOf('d')).toBe(816);
    });

    it('reorders within the row it is already in, without counting its own width', () => {
      // Drag c back between a and b: the slot is still one note + one gap
      // wide, because c is no longer part of the row it is measuring.
      const slot = findInsertionSlot({
        cursorX: 236,
        cursorY: 100,
        incomingWidth: 200,
        elements: ROW,
        excludeId: 'c',
      });
      expect(slot?.rightId).toBe('b');
      expect(slot?.shiftDx).toBe(272);
      expect(new Set(slot?.shiftedIds)).toEqual(new Set(['b']));
    });

    it('offers no slot when excluding it leaves fewer than two notes in the row', () => {
      expect(
        findInsertionSlot({
          cursorX: 236,
          cursorY: 100,
          incomingWidth: 200,
          elements: [note('a', 0), note('b', 272)],
          excludeId: 'b',
        }),
      ).toBeNull();
    });
  });

  it('opens a slot in a gap narrower than the incoming note', () => {
    const tight: Element[] = [note('a', 0), note('b', 210)];
    const slot = findInsertionSlot({
      cursorX: 205,
      cursorY: 100,
      incomingWidth: 200,
      elements: tight,
    });
    expect(slot?.atX).toBe(210);
    // Prevailing gap = the row's only gap (10), narrow as it is.
    expect(slot?.shiftDx).toBe(210);
  });

  it('takes the row\u2019s prevailing (median) gap, not the hovered one', () => {
    const uneven: Element[] = [note('a', 0), note('b', 272), note('c', 544), note('d', 1000)];
    // Gaps: 72, 72, 256 -> median 72.
    const slot = findInsertionSlot({
      cursorX: 800,
      cursorY: 100,
      incomingWidth: 200,
      elements: uneven,
    });
    expect(slot?.rightId).toBe('d');
    expect(slot?.shiftDx).toBe(272);
  });

  it('falls back to the template gap when no gap is measurable', () => {
    // Overlapping notes: every gap is non-positive, so there is nothing to
    // learn from the row.
    const overlapping: Element[] = [note('a', 0), note('b', 150), note('c', 300)];
    const slot = findInsertionSlot({
      cursorX: 149,
      cursorY: 100,
      incomingWidth: 200,
      elements: overlapping,
    });
    // The cursor sits inside 'a' here, so no slot — pin the fallback through
    // a row whose ONE gap is zero instead.
    expect(slot).toBeNull();
    const flush: Element[] = [note('a', 0), note('b', 200)];
    const flushSlot = findInsertionSlot({
      cursorX: 200,
      cursorY: 100,
      incomingWidth: 200,
      elements: flush,
    });
    expect(flushSlot?.shiftDx).toBe(200 + DEFAULT_INSERTION_GAP);
  });

  it('picks the hovered row, but ripples the whole board', () => {
    const twoRows: Element[] = [
      note('a', 0, 0),
      note('b', 272, 0),
      note('x', 0, 400),
      note('y', 272, 400),
      note('z', 544, 400),
    ];
    const slot = findInsertionSlot({
      cursorX: 236,
      cursorY: 100,
      incomingWidth: 200,
      elements: twoRows,
    });
    expect(slot?.leftId).toBe('a');
    expect(slot?.rightId).toBe('b');
    // Decision 2: everything at or right of the insertion point moves, so a
    // column of related notes stays lined up with the event it annotates.
    expect(new Set(slot?.shiftedIds)).toEqual(new Set(['b', 'y', 'z']));
  });

  it('leaves a locked element where it is, and never lets it define the row', () => {
    const withLocked: Element[] = [
      note('a', 0),
      { ...note('pinned', 272), locked: true },
      note('c', 544),
    ];
    // 'pinned' is not a row candidate, so the gap here runs a -> c.
    const slot = findInsertionSlot({
      cursorX: 300,
      cursorY: 100,
      incomingWidth: 200,
      elements: withLocked,
    });
    expect(slot?.leftId).toBe('a');
    expect(slot?.rightId).toBe('c');
    expect(slot?.shiftedIds).toEqual(['c']);
  });

  it('keeps elements on an inert layer out of the row but still shifts them', () => {
    const withHidden: Element[] = [note('a', 0), note('b', 272), note('ghost', 600)];
    const slot = findInsertionSlot({
      cursorX: 236,
      cursorY: 100,
      incomingWidth: 200,
      elements: withHidden,
      inertIds: new Set(['ghost']),
    });
    expect(slot?.rightId).toBe('b');
    // Hidden today, visible tomorrow — it has to keep its place in the order.
    expect(new Set(slot?.shiftedIds)).toEqual(new Set(['b', 'ghost']));
  });

  it('moves a straddling group as one, by its centre', () => {
    const grouped: Element[] = [
      note('a', 0),
      note('b', 272),
      // A group straddling the insertion point (272): centre at 372 >= 272,
      // so the WHOLE group travels rather than being torn in half.
      { ...note('g1', 100, 400, 100, 100), groupId: 'g' },
      { ...note('g2', 500, 400, 100, 100), groupId: 'g' },
      // A group whose centre is left of the point stays put entirely.
      { ...note('h1', -400, 400, 100, 100), groupId: 'h' },
      { ...note('h2', 300, 400, 100, 100), groupId: 'h' },
    ];
    const slot = findInsertionSlot({
      cursorX: 236,
      cursorY: 100,
      incomingWidth: 200,
      elements: grouped,
    });
    expect(new Set(slot?.shiftedIds)).toEqual(new Set(['b', 'g1', 'g2']));
  });

  it('carries an arrow whose whole span is at or after the point', () => {
    const withArrows: Element[] = [
      note('a', 0),
      note('b', 272),
      arrow('after', { x: 300, y: 300 }, { x: 500, y: 300 }),
      arrow('before', { x: 10, y: 300 }, { x: 100, y: 300 }),
      arrow('straddling', { x: 100, y: 300 }, { x: 500, y: 300 }),
    ];
    const slot = findInsertionSlot({
      cursorX: 236,
      cursorY: 100,
      incomingWidth: 200,
      elements: withArrows,
    });
    expect(new Set(slot?.shiftedIds)).toEqual(new Set(['b', 'after']));
  });

  it('carries an arrow pinned to two notes that both move', () => {
    const pinned = {
      id: 'link',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'b', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'c', anchor: 'w' },
    } as ArrowElement;
    const slot = findInsertionSlot({
      cursorX: 236,
      cursorY: 100,
      incomingWidth: 200,
      elements: [...ROW, pinned],
    });
    expect(new Set(slot?.shiftedIds)).toEqual(new Set(['b', 'c', 'link']));
  });
});

describe('findInsertionSlot hysteresis', () => {
  it('holds an open slot while the cursor jitters across the boundary', () => {
    // 272 is 'b' left edge: one pixel right of it the cursor is ON the note.
    const opened = slotAt(271);
    expect(opened).not.toBeNull();
    const jittered = findInsertionSlot({
      cursorX: 273,
      cursorY: 100,
      incomingWidth: 200,
      elements: ROW,
      active: opened,
    });
    expect(jittered).toEqual(opened);
    const back = findInsertionSlot({
      cursorX: 271,
      cursorY: 100,
      incomingWidth: 200,
      elements: ROW,
      active: jittered,
    });
    expect(back).toEqual(opened);
  });

  it('lets go once the cursor leaves by more than the margin', () => {
    const opened = slotAt(236);
    const gone = findInsertionSlot({
      cursorX: 400,
      cursorY: 100,
      incomingWidth: 200,
      elements: ROW,
      active: opened,
    });
    expect(gone).toBeNull();
  });

  it('lets go when the cursor leaves the row vertically', () => {
    const opened = slotAt(236);
    const gone = findInsertionSlot({
      cursorX: 236,
      cursorY: 900,
      incomingWidth: 200,
      elements: ROW,
      active: opened,
    });
    expect(gone).toBeNull();
  });
});

describe('applyInsertionShift', () => {
  it('is the oracle for what the preview promised', () => {
    const slot = slotAt(236)!;
    const after = applyInsertionShift(ROW, slot);
    expect(after.map((el) => (el as StickyElement).x)).toEqual([
      0,
      272 + slot.shiftDx,
      544 + slot.shiftDx,
    ]);
  });

  it('leaves the element identities alone when nothing moves', () => {
    const slot = { ...slotAt(236)!, shiftedIds: [], shiftDx: 0 };
    expect(applyInsertionShift(ROW, slot)).toBe(ROW);
  });

  it('translates a free arrow that travels whole', () => {
    const els: Element[] = [...ROW, arrow('after', { x: 300, y: 300 }, { x: 500, y: 300 })];
    const slot = findInsertionSlot({
      cursorX: 236,
      cursorY: 100,
      incomingWidth: 200,
      elements: els,
    })!;
    const moved = applyInsertionShift(els, slot).find((el) => el.id === 'after') as ArrowElement;
    expect(moved.from).toEqual({ kind: 'free', x: 300 + slot.shiftDx, y: 300 });
    expect(moved.to).toEqual({ kind: 'free', x: 500 + slot.shiftDx, y: 300 });
  });

  it('stretches a free arrow that straddles the insertion point', () => {
    const els: Element[] = [...ROW, arrow('straddling', { x: 100, y: 300 }, { x: 500, y: 300 })];
    const slot = findInsertionSlot({
      cursorX: 236,
      cursorY: 100,
      incomingWidth: 200,
      elements: els,
    })!;
    const stretched = applyInsertionShift(els, slot).find(
      (el) => el.id === 'straddling',
    ) as ArrowElement;
    expect(stretched.from).toEqual({ kind: 'free', x: 100, y: 300 });
    expect(stretched.to).toEqual({ kind: 'free', x: 500 + slot.shiftDx, y: 300 });
  });

  it('leaves a pinned arrow untouched — it follows its endpoints', () => {
    const pinned = {
      id: 'link',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'b', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'c', anchor: 'w' },
    } as ArrowElement;
    const els: Element[] = [...ROW, pinned];
    const slot = findInsertionSlot({
      cursorX: 236,
      cursorY: 100,
      incomingWidth: 200,
      elements: els,
    })!;
    const after = applyInsertionShift(els, slot).find((el) => el.id === 'link');
    expect(after).toBe(pinned);
  });

  it('leaves a locked element where it is', () => {
    const els: Element[] = [note('a', 0), note('b', 272), { ...note('c', 544), locked: true }];
    const slot = findInsertionSlot({
      cursorX: 236,
      cursorY: 100,
      incomingWidth: 200,
      elements: els,
    })!;
    const after = applyInsertionShift(els, slot);
    expect((after.find((el) => el.id === 'c') as StickyElement).x).toBe(544);
  });
});

describe('canInsertBetweenOn', () => {
  const editable = { esBoard: true, readOnly: false, tabLocked: false, createBlocked: false };

  it('offers insertion on an editable event-storming board while Alt is held', () => {
    expect(canInsertBetweenOn(editable, true)).toBe(true);
  });

  it('offers nothing without the modifier, however willing the board', () => {
    // The whole point of the gesture: an ordinary drag on an event-storming
    // board behaves exactly as it does on every other board.
    expect(canInsertBetweenOn(editable, false)).toBe(false);
  });

  it('never offers it on an ordinary board', () => {
    expect(canInsertBetweenOn({ ...editable, esBoard: false }, true)).toBe(false);
  });

  it('never offers a slot the drop would refuse', () => {
    // A view-role session, a locked tab, and a hidden / locked active layer
    // each block creation — so none of them may see the board make room.
    expect(canInsertBetweenOn({ ...editable, readOnly: true }, true)).toBe(false);
    expect(canInsertBetweenOn({ ...editable, tabLocked: true }, true)).toBe(false);
    expect(canInsertBetweenOn({ ...editable, createBlocked: true }, true)).toBe(false);
  });
});

describe('insertElementAt', () => {
  it('lands the note exactly where the preview promised, in one value', () => {
    const slot = slotAt(236)!;
    const incoming = note('new', slot.atX);
    const after = insertElementAt(ROW, slot, incoming);
    // The ripple and the addition are one board, so one Undo restores both.
    expect(after.map((el) => el.id)).toEqual(['a', 'b', 'c', 'new']);
    expect(after.map((el) => (el as StickyElement).x)).toEqual([
      0,
      272 + slot.shiftDx,
      544 + slot.shiftDx,
      272,
    ]);
    // The gap the author already had between a and b survives untouched, and
    // the new note gets the row's prevailing gap on its right.
    const xs = after.map((el) => (el as StickyElement).x);
    expect(xs[3]! - (xs[0]! + 200)).toBe(72);
    expect(xs[1]! - (xs[3]! + 200)).toBe(72);
  });
});

describe('insertionGhostCentre', () => {
  it('centres the incoming note on the slot it opened', () => {
    const slot = slotAt(236)!;
    expect(insertionGhostCentre(slot, 200)).toEqual({ x: 372, y: 100 });
  });
});
