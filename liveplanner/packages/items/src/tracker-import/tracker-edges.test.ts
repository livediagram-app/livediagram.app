import { afterEach, describe, expect, it } from 'vitest';
import { readJiraRows } from './jira';
import { trackerEstimate, trackerInstant } from './tracker-text';

// Edges of the tracker readers (docs/specs/026-plan/tracker-import.md): Jira's several Story Points columns, a
// zoneless time read the same on every device, and estimates written only as decimal numbers.
describe('tracker reader edges', () => {
  const zone = process.env['TZ'];
  afterEach(() => {
    if (zone === undefined) delete process.env['TZ'];
    else process.env['TZ'] = zone;
  });

  it('reads an estimate from whichever Story Points column a Jira row fills', () => {
    const rows = [
      ['Summary', 'Custom field (Story Points)', 'Custom field (Story point estimate)'],
      ['First', '', '5'],
      ['Second', '3', ''],
      ['Third', '2', '8'],
      ['Fourth', '', ''],
    ];
    expect(readJiraRows(rows).cards.map((c) => c.estimate)).toEqual([5, 3, 2, undefined]);
  });

  it('reads a time with no zone as UTC, wherever the import runs', () => {
    process.env['TZ'] = 'Pacific/Kiritimati';
    expect(trackerInstant('2026-10-31 23:30')).toBe(Date.UTC(2026, 9, 31, 23, 30));
    expect(trackerInstant('2026-10-31T02:00:15')).toBe(Date.UTC(2026, 9, 31, 2, 0, 15));
    expect(trackerInstant('2026-10-31')).toBe(Date.UTC(2026, 9, 31));
    expect(trackerInstant('2026-10-31T02:00:00+02:00')).toBe(Date.UTC(2026, 9, 31, 0, 0));
  });

  it('takes an estimate only as a decimal number', () => {
    expect(trackerEstimate('0x10')).toBeUndefined();
    expect(trackerEstimate('1e2')).toBeUndefined();
    expect(trackerEstimate(' 2.5 ')).toBe(2.5);
    expect(trackerEstimate('8')).toBe(8);
  });
});
