import { describe, expect, it } from 'vitest';
import { IMPORT_NOTE_ORDER, ReportTally } from './notes';

describe('ReportTally', () => {
  it('returns only the kinds that occurred, in the spec order', () => {
    const tally = new ReportTally();
    tally.add('label-moved');
    tally.add('shape-unmatched', 2);
    tally.add('label-moved');
    tally.add('group-flattened', 0);
    expect(tally.notes()).toEqual([
      { kind: 'shape-unmatched', count: 2 },
      { kind: 'label-moved', count: 2 },
    ]);
  });

  it('tallies names, most frequent first, capped', () => {
    const tally = new ReportTally(2);
    for (const n of ['switch', 'router', 'router', 'hub', 'router', 'switch']) {
      tally.add('shape-unmatched');
      tally.name('shape-unmatched', n);
    }
    expect(tally.notes()[0]).toEqual({
      kind: 'shape-unmatched',
      count: 6,
      names: [
        { name: 'router', count: 3 },
        { name: 'switch', count: 2 },
      ],
      moreNames: 1,
    });
  });

  it('orders equal counts by name', () => {
    const tally = new ReportTally();
    tally.name('shape-unmatched', 'b');
    tally.name('shape-unmatched', 'a');
    tally.add('shape-unmatched', 2);
    expect(tally.notes()[0]!.names!.map((n) => n.name)).toEqual(['a', 'b']);
  });

  it('knows every kind in its order', () => {
    expect(new Set(IMPORT_NOTE_ORDER).size).toBe(IMPORT_NOTE_ORDER.length);
    expect(IMPORT_NOTE_ORDER[0]).toBe('shape-unmatched');
  });
});
