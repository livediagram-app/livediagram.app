import { describe, expect, it } from 'vitest';
import { type Element, type StickyElement } from '@livediagram/diagram';
import type { ShapeBounds } from '@/lib/canvas';
import { landNoteInSlot, resolveNoteInsertion } from './note-insertion-drag';

function note(id: string, x: number, y = 0): StickyElement {
  return { id, type: 'sticky', x, y, width: 200, height: 200, label: id } as StickyElement;
}

// a: 0..200, b: 272..472, c: 544..744, plus the note being dragged, parked
// well clear of the row at the far right.
const BOARD: Element[] = [note('a', 0), note('b', 272), note('c', 544), note('drag', 1200)];

const GATE = { esBoard: true, readOnly: false, tabLocked: false, createBlocked: false };

function boundsOf(elements: Element[], ...ids: string[]): Map<string, ShapeBounds> {
  const map = new Map<string, ShapeBounds>();
  for (const id of ids) {
    const el = elements.find((e) => e.id === id) as StickyElement;
    map.set(id, { x: el.x, y: el.y, width: el.width, height: el.height });
  }
  return map;
}

// Drag 'drag' from (1200, 0) so its centre lands in the a|b gap at (236, 100).
const TO_GAP = { dx: 236 - (1200 + 100), dy: 0 };

function resolve(overrides: Partial<Parameters<typeof resolveNoteInsertion>[0]> = {}) {
  return resolveNoteInsertion({
    gate: GATE,
    altHeld: true,
    shiftHeld: false,
    elements: BOARD,
    primaryId: 'drag',
    startBounds: boundsOf(BOARD, 'drag'),
    dx: TO_GAP.dx,
    dy: TO_GAP.dy,
    inertIds: new Set<string>(),
    active: null,
    timeline: null,
    ...overrides,
  });
}

describe('resolveNoteInsertion', () => {
  it('offers the gap the dragged note is aiming at', () => {
    const slot = resolve();
    expect(slot?.leftId).toBe('a');
    expect(slot?.rightId).toBe('b');
    expect(slot?.shiftedIds).not.toContain('drag');
  });

  // The regression this whole gesture exists to protect: without Alt an
  // ordinary move over a gap must do nothing at all.
  it('offers nothing without Alt', () => {
    expect(resolve({ altHeld: false })).toBeNull();
  });

  it('offers nothing on an ordinary board', () => {
    expect(resolve({ gate: { ...GATE, esBoard: false } })).toBeNull();
  });

  it('offers nothing where the board would refuse the edit', () => {
    expect(resolve({ gate: { ...GATE, readOnly: true } })).toBeNull();
    expect(resolve({ gate: { ...GATE, tabLocked: true } })).toBeNull();
    expect(resolve({ gate: { ...GATE, createBlocked: true } })).toBeNull();
  });

  // Q1: a multi-selection drag behaves exactly as it does today, Alt or not.
  it('offers nothing for a multi-selection drag', () => {
    expect(resolve({ startBounds: boundsOf(BOARD, 'drag', 'c') })).toBeNull();
  });

  // Q2: the gesture is about the note grammar, so only a sticky inserts.
  it('offers nothing for a shape, an icon or any other element', () => {
    const withShape: Element[] = [
      ...BOARD.filter((el) => el.id !== 'drag'),
      {
        id: 'drag',
        type: 'shape',
        shape: 'square',
        x: 1200,
        y: 0,
        width: 200,
        height: 200,
      } as Element,
    ];
    expect(resolve({ elements: withShape })).toBeNull();
  });

  // Shift already means drag-duplicate (spec/80); the gesture is spoken for.
  it('yields to a drag-duplicate when Shift is also held', () => {
    expect(resolve({ shiftHeld: true })).toBeNull();
  });

  it('offers nothing when the note is nowhere near a gap', () => {
    expect(resolve({ dx: 0, dy: 0 })).toBeNull();
  });

  it('aims with the note itself, not the grab point', () => {
    // Grabbing the note by its left edge and dropping that edge in the gap
    // must not insert: it is where the NOTE lands that decides, which is what
    // the preview shows.
    const slot = resolve({ dx: 236 - 1200, dy: 0 });
    expect(slot).toBeNull();
  });

  it('keeps an open offer through a shaky hand', () => {
    const first = resolve()!;
    // A pixel of wobble back over the boundary must not close the slot.
    const second = resolve({ dx: TO_GAP.dx - 30, active: first });
    expect(second).toBe(first);
  });
});

describe('landNoteInSlot', () => {
  it('sits the note in the slot the board has opened, so what you see is what you get', () => {
    const slot = resolve()!;
    const after = landNoteInSlot(BOARD, 'drag', slot);
    const moved = after.find((el) => el.id === 'drag') as StickyElement;
    expect(moved.x).toBe(slot.atX);
    // Vertically centred on the note it displaces, not on the cursor's wobble.
    expect(moved.y).toBe(slot.atY - 100);
    // Nothing else is touched: the ripple is a render-time preview until the
    // drop commits it.
    expect((after.find((el) => el.id === 'b') as StickyElement).x).toBe(272);
  });
});

// Timeline lanes (spec/139 Phase 6): the ripple opens by the incoming note
// plus the row's own gap, on a lanes board exactly as on any other. It used to
// round up to a column lattice; the lattice is gone, because it could not
// express the row's gutter in the first place.
describe('resolveNoteInsertion — on a lanes-on board', () => {
  it('opens by the row rhythm, not a lattice', () => {
    const slot = resolve({ timeline: { originX: 0, originY: 0, enabled: true } });
    expect(slot!.shiftDx).toBe(272);
  });

  it('opens by the same rhythm when lanes are off', () => {
    expect(resolve()!.shiftDx).toBe(272);
  });
});
