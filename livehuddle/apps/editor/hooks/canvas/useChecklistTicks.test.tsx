// @vitest-environment jsdom

// Ticking a checklist row (docs/specs/009-elements/checklist.md): one delta per tick, sent through the room's
// delta path (docs/specs/012-collaboration/collab-race-hardening.md), and nothing for a session that may not edit.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { useChecklistTicks } from './useChecklistTicks';

const list = {
  ...createShape('checklist', 0, 0),
  id: 'list',
  checklistItems: [
    { text: 'Agenda', done: false },
    { text: 'Notes', done: true },
  ],
} as Element;

function setup(editsBlocked = false, elements: Element[] = [list]) {
  const applyElementDelta = vi.fn();
  const { result } = renderHook(() =>
    useChecklistTicks({ applyElementDelta, activeElements: elements, editsBlocked }),
  );
  return { toggle: result.current.toggleChecklistItem, applyElementDelta };
}

describe('useChecklistTicks', () => {
  it('ticks a row as one delta naming the row by index and text', () => {
    const { toggle, applyElementDelta } = setup();
    toggle('list', 0);
    expect(applyElementDelta).toHaveBeenCalledWith('list', {
      kind: 'check',
      index: 0,
      text: 'Agenda',
      done: true,
    });
    toggle('list', 1);
    expect(applyElementDelta).toHaveBeenLastCalledWith('list', {
      kind: 'check',
      index: 1,
      text: 'Notes',
      done: false,
    });
  });

  it('sends nothing for a session that may not edit, a missing row or a missing element', () => {
    const blocked = setup(true);
    blocked.toggle('list', 0);
    expect(blocked.applyElementDelta).not.toHaveBeenCalled();
    const open = setup();
    open.toggle('list', 5);
    open.toggle('gone', 0);
    expect(open.applyElementDelta).not.toHaveBeenCalled();
  });
});
