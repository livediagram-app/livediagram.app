import { describe, expect, it } from 'vitest';
import {
  balanceNotes,
  draftNodeNames,
  flowsToStore,
  nextRow,
  pasteRows,
  rowReasons,
  rowsFromFlows,
  type SankeyDraftRow,
} from './sankey-flow-rows';

const row = (from: string, to: string, value: string): SankeyDraftRow => ({
  key: 0,
  from,
  to,
  value,
});

describe('the Flows draft', () => {
  it('stores what was typed, dropping a wholly blank row and reading typed numbers', () => {
    expect(flowsToStore([row('A', 'B', '1,200'), row('', '', ''), row('B', 'C', 'abc')])).toEqual([
      { from: 'A', to: 'B', value: 1200 },
      { from: 'B', to: 'C', value: 0 },
    ]);
  });

  it('says why a row is not drawn, but not for a row still blank', () => {
    const reasons = rowReasons([
      row('A', 'B', '5'),
      row('B', 'A', '1'),
      row('', '', ''),
      row('C', 'C', '1'),
      row('C', 'D', '-1'),
    ]);
    expect([...reasons]).toEqual([
      [1, 'Loops back to an earlier node, so it is hidden'],
      [3, 'Flows into itself'],
      [4, 'Needs an amount above zero'],
    ]);
  });

  it('notes a middle node whose in and out differ', () => {
    expect(balanceNotes([row('A', 'B', '10'), row('B', 'C', '8')], '£')).toEqual([
      'B receives £10 and sends £8',
    ]);
    expect(balanceNotes([row('A', 'B', '10'), row('B', 'C', '10')])).toEqual([]);
    // While leftovers show, keeping some back is drawn, not a mistake; sending on more than arrived still is.
    expect(balanceNotes([row('A', 'B', '10'), row('B', 'C', '8')], '£', true)).toEqual([]);
    expect(balanceNotes([row('A', 'B', '10'), row('B', 'C', '12')], undefined, true)).toEqual([
      'B receives 10 and sends 12',
    ]);
  });

  it('suggests every name typed so far, once', () => {
    expect(draftNodeNames([row('A', ' B ', '1'), row('B', 'C', '1')])).toEqual(['A', 'B', 'C']);
  });

  it('starts a new row where the last one ended', () => {
    expect(nextRow([row('A', 'Budget ', '1')])).toMatchObject({
      from: 'Budget',
      to: '',
      value: '',
    });
    expect(nextRow([])).toMatchObject({ from: '' });
  });

  it('pastes over a blank row, or after a filled one', () => {
    const pasted = [{ from: 'X', to: 'Y', value: 2 }];
    expect(pasteRows([row('A', 'B', '1'), row('', '', '')], 1, pasted).map((r) => r.from)).toEqual([
      'A',
      'X',
    ]);
    expect(
      pasteRows([row('A', 'B', '1'), row('C', 'D', '1')], 0, pasted).map((r) => r.from),
    ).toEqual(['A', 'X', 'C']);
  });

  it('keys every row uniquely', () => {
    const rows = rowsFromFlows([
      { from: 'A', to: 'B', value: 1 },
      { from: 'A', to: 'B', value: 1 },
    ]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });
});
