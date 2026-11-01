import { describe, expect, it } from 'vitest';
import { landedKindLabel, mergeNotes, reportHasLosses } from './report';

// docs/specs/020-import-export/board-scene.md "The report".
describe('mergeNotes', () => {
  it('adds counts per rule and kind, in first-seen order, dropping empty ones', () => {
    expect(
      mergeNotes([
        { rule: 'B', count: 1 },
        { rule: 'A', count: 2, kind: 'degraded' },
        { rule: 'B', count: 3 },
        { rule: 'B', count: 4, kind: 'skipped' },
        { rule: 'C', count: 0 },
      ]),
    ).toEqual({
      degraded: [
        { rule: 'B', count: 4 },
        { rule: 'A', count: 2 },
      ],
      skipped: [{ rule: 'B', count: 4 }],
    });
  });
});

describe('landedKindLabel', () => {
  it('counts in words', () => {
    expect(landedKindLabel('ink', 1)).toBe('1 pen stroke');
    expect(landedKindLabel('sticky', 3)).toBe('3 sticky notes');
    expect(landedKindLabel('connector', 2)).toBe('2 arrows');
  });
});

describe('reportHasLosses', () => {
  it('is true only with degraded or skipped rules', () => {
    expect(reportHasLosses({ landed: { ink: 2 }, degraded: [], skipped: [] })).toBe(false);
    expect(reportHasLosses({ landed: {}, degraded: [{ rule: 'x', count: 1 }], skipped: [] })).toBe(
      true,
    );
  });
});
