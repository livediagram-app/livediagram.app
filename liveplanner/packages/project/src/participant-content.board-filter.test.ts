import { describe, expect, it } from 'vitest';
import { createShape } from './factories';
import type { Element, ShapeElement, Tab } from './index';
import {
  applyParticipantOp,
  participantTabChange,
  type ParticipantOpResult,
} from './participant-content';

// A Participant changes a board's filter and nothing else of its set-up (docs/specs/026-plan/board-widgets.md "The
// board's filter"; Work Tracker 842).
const ME = 'a'.repeat(32);

function board(planBoard: Record<string, unknown> = {}): ShapeElement {
  const b = { ...createShape('plan-board', 0, 0), id: 'b1' } as ShapeElement;
  return { ...b, planBoard: { ...b.planBoard!, ...planBoard } };
}
const tabOf = (elements: Element[]): Tab => ({ id: 't1', name: 'Board', elements });

function applied(r: ParticipantOpResult) {
  if (r.result !== 'applied') throw new Error(`refused: ${r.reason}`);
  return r;
}

describe('a Participant and the board filter', () => {
  it("takes the filter from a Participant's board update, and leaves every other set-up field as stored", () => {
    const stored = board({ title: 'Sprint' });
    const incoming = {
      ...stored,
      x: 999,
      planBoard: { ...stored.planBoard!, title: 'Renamed', filter: { text: 'login', mine: true } },
    } as ShapeElement;
    const r = applied(
      applyParticipantOp(tabOf([stored]), { kind: 'update', element: incoming }, ME),
    );
    const after = r.tab.elements[0] as ShapeElement;
    expect(after.planBoard?.filter).toEqual({ text: 'login', mine: true });
    expect(after.planBoard?.title).toBe('Sprint');
    expect(after.x).toBe(stored.x);
    expect(r.changed).toBe(true);
  });

  it('clears the filter when the update has none', () => {
    const stored = board({ filter: { text: 'login' } });
    const { filter: _gone, ...rest } = stored.planBoard!;
    const incoming = { ...stored, planBoard: rest } as ShapeElement;
    const r = applied(
      applyParticipantOp(tabOf([stored]), { kind: 'update', element: incoming }, ME),
    );
    expect((r.tab.elements[0] as ShapeElement).planBoard?.filter).toBeUndefined();
  });

  it('refuses a filter past its limits (words over 200, more than 8 chips, an unknown key)', () => {
    const stored = board();
    const chip = { by: 'type', key: 'bug' };
    for (const filter of [
      { text: 'x'.repeat(201) },
      { filters: Array.from({ length: 9 }, () => chip) },
      { colour: 'red' },
    ]) {
      const incoming = { ...stored, planBoard: { ...stored.planBoard!, filter } } as ShapeElement;
      const r = applyParticipantOp(tabOf([stored]), { kind: 'update', element: incoming }, ME);
      expect(r.result).toBe('refused');
    }
  });

  it("passes a Participant's filter-only commit in the editor, and holds back one that renames the board", () => {
    const stored = board();
    const before = tabOf([stored]);
    const filtered = tabOf([
      { ...stored, planBoard: { ...stored.planBoard!, filter: { type: 'bug' } } },
    ]);
    expect(participantTabChange(before, filtered, ME)).toBe(filtered);
    const renamed = tabOf([{ ...stored, planBoard: { ...stored.planBoard!, title: 'Mine now' } }]);
    expect(participantTabChange(before, renamed, ME)).toBeNull();
  });

  it('leaves a board whose stored set-up is missing alone', () => {
    const stored = { ...board(), planBoard: undefined } as unknown as ShapeElement;
    const incoming = {
      ...board(),
      planBoard: { filter: { text: 'x' } },
    } as unknown as ShapeElement;
    const r = applyParticipantOp(tabOf([stored]), { kind: 'update', element: incoming }, ME);
    if (r.result === 'applied') {
      expect((r.tab.elements[0] as ShapeElement).planBoard).toBeUndefined();
    }
  });
});
