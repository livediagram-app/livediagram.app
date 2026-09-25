import { describe, expect, it } from 'vitest';
import {
  ES_NOTE_GAP,
  nextNoteBounds,
  type Element,
  type StickyElement,
} from '@livediagram/diagram';
import { applyInsertionShift } from './insert-between';
import { planNextNote } from './next-note-add';

// Next-note placement (spec/139 Phase 7): the note lands one gutter beside, and
// where that spot is occupied the board OPENS with the shipped insertion ripple
// rather than refusing — the same behaviour the Alt gesture already taught.

function note(id: string, kind: string, x: number, y = 500, w = 200, h = 200): StickyElement {
  return {
    id,
    type: 'sticky',
    esKind: kind,
    fixedSize: true,
    x,
    y,
    width: w,
    height: h,
  } as StickyElement;
}

const from = note('e', 'domain-event', 1000);

describe('planNextNote', () => {
  it('puts the note one gutter beside and moves nothing', () => {
    const plan = planNextNote([from], 'e', 'before', 'command')!;
    expect(plan.bounds).toEqual(nextNoteBounds(from, 'before', 'command'));
    expect(plan.ripple).toBeNull();
  });

  it('knows nothing about a note that is not a workshop note', () => {
    const shape = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    } as Element;
    expect(planNextNote([shape], 's', 'before', 'command')).toBeNull();
    expect(planNextNote([], 'gone', 'before', 'command')).toBeNull();
  });

  it('opens the board when the spot AFTER is taken, leaving the note put', () => {
    const spot = nextNoteBounds(from, 'after', 'policy');
    const squatter = note('sq', 'domain-event', spot.x);
    const plan = planNextNote([from, squatter], 'e', 'after', 'policy')!;
    expect(plan.ripple).not.toBeNull();
    const after = applyInsertionShift([from, squatter], plan.ripple!);
    expect((after.find((el) => el.id === 'e') as StickyElement).x).toBe(1000);
    // The squatter stood aside by exactly the note plus a gutter…
    expect((after.find((el) => el.id === 'sq') as StickyElement).x).toBe(
      spot.x + spot.width + ES_NOTE_GAP,
    );
    // …and the note lands in the space that opened, touching nothing.
    expect(plan.bounds).toEqual(spot);
  });

  it('opens the board when the spot BEFORE is taken, carrying the note right', () => {
    const spot = nextNoteBounds(from, 'before', 'command');
    const squatter = note('sq', 'domain-event', spot.x);
    const plan = planNextNote([from, squatter], 'e', 'before', 'command')!;
    const after = applyInsertionShift([from, squatter], plan.ripple!);
    const movedFrom = after.find((el) => el.id === 'e') as StickyElement;
    // The note travelled; the squatter, being LEFT of it, did not.
    expect(movedFrom.x).toBe(1000 + 200 + ES_NOTE_GAP);
    expect((after.find((el) => el.id === 'sq') as StickyElement).x).toBe(spot.x);
    // The note lands on the moved note's spot — and clear of the squatter.
    expect(plan.bounds).toEqual(nextNoteBounds(movedFrom, 'before', 'command'));
    expect(plan.bounds.x).toBeGreaterThanOrEqual(spot.x + spot.width);
  });

  it('is not disturbed by a note on the OTHER side', () => {
    const before = note('c', 'command', nextNoteBounds(from, 'before', 'command').x);
    const plan = planNextNote([from, before], 'e', 'after', 'policy')!;
    expect(plan.ripple).toBeNull();
  });

  it('cannot be blocked by something the author cannot see', () => {
    const spot = nextNoteBounds(from, 'after', 'policy');
    const hidden = note('h', 'domain-event', spot.x);
    const plan = planNextNote([from, hidden], 'e', 'after', 'policy', new Set(['h']))!;
    expect(plan.ripple).toBeNull();
  });

  it('opens around a LOCKED squatter rather than shoving it', () => {
    const spot = nextNoteBounds(from, 'after', 'policy');
    const locked = { ...note('sq', 'domain-event', spot.x), locked: true } as Element;
    const plan = planNextNote([from, locked], 'e', 'after', 'policy')!;
    // Nothing movable sits at or after the point, so there is no ripple to
    // make — the board has nothing it is allowed to move.
    expect(plan.ripple).toBeNull();
  });
});
