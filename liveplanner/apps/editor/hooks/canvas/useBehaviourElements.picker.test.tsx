// @vitest-environment jsdom

// The Picker's draw and Reset (docs/specs/012-collaboration/picker.md "Remove once drawn"): the presser
// writes the result and the drawn list in one non-undoable tick, a roll only lands on a name not drawn
// yet, and only whoever spins for the room may reset.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement, type Tab } from '@liveplanner/project';
import type { Participant } from '@/lib/identity';
import { useBehaviourElements } from './useBehaviourElements';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const me = { id: 'me', name: 'Ada', color: '#0ea5e9', status: 'online' } as Participant;
const picker = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('picker', 0, 0),
  id: 'pk',
  pickerSource: 'options',
  pickerOptions: ['A', 'B'],
  ...over,
});

function setup(element: ShapeElement, blocked: { edits?: boolean } = {}) {
  let tabs: Tab[] = [{ id: 't1', name: 'Tab', elements: [element] }];
  const tickTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const { result } = renderHook(() =>
    useBehaviourElements({
      activeId: 't1',
      commitTabs: vi.fn(),
      tickTabs,
      editsBlocked: blocked.edits ?? false,
      selfParticipant: me,
      livePresence: [],
      activeTimer: undefined,
      activeVote: undefined,
      startTimer: vi.fn(),
      pauseTimer: vi.fn(),
      resumeTimer: vi.fn(),
      startVote: vi.fn(),
    }),
  );
  const el = () => tabs[0]!.elements[0] as ShapeElement;
  return { offer: result.current.pickerFor(element), tickTabs, el };
}

describe('the picker draw', () => {
  it('lands only on a name not drawn yet, and writes it to the drawn list', () => {
    const { offer, el } = setup(picker({ pickerRemoveDrawn: true, pickerDrawn: ['A'] }));
    expect(offer.roll()?.label).toBe('B');
    expect(el().pickerResult).toBe('B');
    expect(el().pickerDrawn).toEqual(['A', 'B']);
    // Stamped with the press, in the same write, so the room replays even a repeat landing.
    expect(el().pickerRolledAt).toBeGreaterThan(0);
  });

  it('puts every name back on Reset', () => {
    const { offer, el } = setup(
      picker({ pickerRemoveDrawn: true, pickerDrawn: ['A', 'B'], pickerResult: 'B' }),
    );
    offer.reset();
    expect(el().pickerResult).toBeUndefined();
    expect(el().pickerDrawn).toBeUndefined();
    expect(el().pickerRolledAt).toBeUndefined();
    expect(el().pickerRemoveDrawn).toBe(true);
  });

  it('writes nothing, and resets nothing, for a roll that is not the room’s', () => {
    const { offer, tickTabs } = setup(picker({ pickerDrawn: ['A'] }), { edits: true });
    expect(offer.shared).toBe(false);
    expect(offer.roll()).not.toBeNull();
    offer.reset();
    expect(tickTabs).not.toHaveBeenCalled();
  });
});
