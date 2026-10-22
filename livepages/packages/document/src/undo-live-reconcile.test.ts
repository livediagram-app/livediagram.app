import { describe, expect, it } from 'vitest';
import type { ShapeElement, Tab } from './index';
import { graftLiveTabState } from './index';

// Undo keeps the room's presses (graftLiveTabState), but a press that was
// about an authored field follows that field back
// (docs/specs/012-collaboration/agenda.md).

const el = (over: Partial<ShapeElement>): ShapeElement => ({
  id: 'e',
  type: 'shape',
  shape: 'agenda',
  x: 0,
  y: 0,
  width: 300,
  height: 300,
  ...over,
});
const tabOf = (e: ShapeElement): Tab[] => [{ id: 't', name: 'T', elements: [e] }];
const undo = (present: ShapeElement, snapshot: ShapeElement) =>
  graftLiveTabState(tabOf(present), tabOf(snapshot))[0]!
    .elements[0] as ShapeElement;

describe('undoing an agenda edit', () => {
  const a = { label: 'A', minutes: 5 };
  const b = { label: 'B', minutes: 5 };
  const c = { label: 'C', minutes: 5 };
  const agenda = (over: Partial<ShapeElement>) => el({ shape: 'agenda', ...over });

  it('follows the current row to where the restored rows put it', () => {
    // Present: rows moved to C A B with C current (0); undo restores A B C.
    const restored = undo(
      agenda({ agendaItems: [c, a, b], agendaCurrent: 0, agendaTimerStartedAt: 9 }),
      agenda({ agendaItems: [a, b, c] }),
    );
    expect(restored.agendaCurrent).toBe(2);
    expect(restored.agendaTimerStartedAt).toBe(9);
  });

  it('clears it when the restored rows do not have the current row', () => {
    // Present: C was added and started; undo removes it.
    const restored = undo(
      agenda({ agendaItems: [a, b, c], agendaCurrent: 2, agendaTimerStartedAt: 9 }),
      agenda({ agendaItems: [a, b] }),
    );
    expect(restored.agendaCurrent).toBeUndefined();
    expect(restored.agendaTimerStartedAt).toBeUndefined();
  });
});
