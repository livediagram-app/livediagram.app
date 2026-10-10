// @vitest-environment jsdom

// Editing an Agenda's rows carries the current segment along
// (docs/specs/012-collaboration/agenda.md "The current segment").

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  moveAgendaCurrent,
  removeAgendaCurrent,
  type Element,
  type ShapeElement,
} from '@livediagram/document';
import { useDataShapeSetters } from './useDataShapeSetters';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const rows = ['A', 'B', 'C'].map((label) => ({ label, minutes: 5 }));

function setup(over: Partial<ShapeElement>) {
  let els: Element[] = [
    {
      id: 'ag',
      type: 'shape',
      shape: 'agenda',
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      agendaItems: rows,
      ...over,
    } as ShapeElement,
  ];
  const { result } = renderHook(() =>
    useDataShapeSetters({
      currentSelectionIds: () => new Set(['ag']),
      commit: (fn) => {
        els = fn(els);
      },
      elements: () => els,
      notify: vi.fn(),
    }),
  );
  return { set: result.current.setAgendaItemsSelected, el: () => els[0] as ShapeElement };
}

describe('setAgendaItemsSelected', () => {
  it('moves the current segment with its row', () => {
    const { set, el } = setup({ agendaCurrent: 2, agendaTimerStartedAt: 7 });
    set([rows[2]!, rows[0]!, rows[1]!], (c) => moveAgendaCurrent(c, 2, 0));
    expect(el()).toMatchObject({ agendaCurrent: 0, agendaTimerStartedAt: 7 });
  });

  it('clears it, and its run, when its row is removed', () => {
    const { set, el } = setup({ agendaCurrent: 1, agendaTimerStartedAt: 7 });
    set([rows[0]!, rows[2]!], (c) => removeAgendaCurrent(c, 1));
    expect(el().agendaCurrent).toBeUndefined();
    expect(el().agendaTimerStartedAt).toBeUndefined();
  });

  it('clears an index past the new rows even without a mapping', () => {
    const { set, el } = setup({ agendaCurrent: 2 });
    set([rows[0]!]);
    expect(el().agendaCurrent).toBeUndefined();
  });

  it('keeps it on a rename', () => {
    const { set, el } = setup({ agendaCurrent: 1 });
    set([rows[0]!, { label: 'Bee', minutes: 5 }, rows[2]!]);
    expect(el().agendaCurrent).toBe(1);
  });
});
