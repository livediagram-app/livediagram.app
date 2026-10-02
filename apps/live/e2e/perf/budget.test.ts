import { describe, expect, it } from 'vitest';
import { budgetTable, evaluateBudget, medianOfRuns, type Measurement } from './budget';

// docs/specs/008-canvas/canvas-performance.md "The budget": each gesture's rule, read from what the
// probe measured.

const m = (over: Partial<Measurement> & Pick<Measurement, 'gesture'>): Measurement => ({
  tab: 'whiteboard',
  zoom: 'fit',
  longestTaskMs: 0,
  ...over,
});

describe('evaluateBudget', () => {
  it('passes a pan, a zoom, a marquee, a stroke and a hover with no task over 50 ms', () => {
    for (const gesture of ['pan', 'zoom', 'marquee', 'stroke', 'hover'] as const) {
      expect(evaluateBudget([m({ gesture, longestTaskMs: 50 })])[0]!.pass).toBe(true);
      expect(evaluateBudget([m({ gesture, longestTaskMs: 51 })])[0]!.pass).toBe(false);
    }
  });

  it('holds a drag to 50 ms tasks and a 33 ms median frame', () => {
    expect(
      evaluateBudget([m({ gesture: 'drag', longestTaskMs: 40, medianFrameMs: 33 })])[0]!.pass,
    ).toBe(true);
    expect(
      evaluateBudget([m({ gesture: 'drag', longestTaskMs: 40, medianFrameMs: 34 })])[0]!.pass,
    ).toBe(false);
    expect(
      evaluateBudget([m({ gesture: 'drag', longestTaskMs: 60, medianFrameMs: 16 })])[0]!.pass,
    ).toBe(false);
  });

  it('holds a select and a deselect to one task within 100 ms', () => {
    expect(evaluateBudget([m({ gesture: 'select', longestTaskMs: 100 })])[0]!.pass).toBe(true);
    expect(evaluateBudget([m({ gesture: 'deselect', longestTaskMs: 101 })])[0]!.pass).toBe(false);
  });

  it('holds a still board to almost no main-thread work', () => {
    expect(evaluateBudget([m({ gesture: 'idle', idleWorkMs: 5 })])[0]!.pass).toBe(true);
    expect(evaluateBudget([m({ gesture: 'idle', idleWorkMs: 6 })])[0]!.pass).toBe(false);
  });

  it('holds opening the board to 3 s', () => {
    expect(evaluateBudget([m({ gesture: 'open', openMs: 3000 })])[0]!.pass).toBe(true);
    expect(evaluateBudget([m({ gesture: 'open', openMs: 3001 })])[0]!.pass).toBe(false);
  });

  it("refuses a measurement without its row's metric", () => {
    expect(() => evaluateBudget([m({ gesture: 'drag', longestTaskMs: 10 })])).toThrow(
      'MissingMetric: drag',
    );
    expect(() => evaluateBudget([m({ gesture: 'idle' })])).toThrow('MissingMetric: idle');
  });
});

describe('budgetTable', () => {
  it('rounds up, so a value over its ceiling never reads as equal to it', () => {
    const [row] = evaluateBudget([m({ gesture: 'marquee', longestTaskMs: 50.3 })]);
    expect(row!.measured).toBe('51 ms');
    expect(row!.pass).toBe(false);
  });

  it('renders one row per measurement with its verdict', () => {
    const table = budgetTable(
      evaluateBudget([
        m({ gesture: 'pan', longestTaskMs: 12.4 }),
        m({ tab: 'diagram', zoom: '100%', gesture: 'drag', longestTaskMs: 80, medianFrameMs: 20 }),
      ]),
    );
    expect(table.split('\n')).toEqual([
      '| Tab | Zoom | Gesture | Rule | Measured | Verdict |',
      '| --- | --- | --- | --- | --- | --- |',
      '| whiteboard | fit | pan | longest task ≤ 50 ms | 13 ms | pass |',
      '| diagram | 100% | drag | longest task ≤ 50 ms, median frame ≤ 33 ms | 80 ms, 20 ms | **fail** |',
    ]);
  });
});

describe('medianOfRuns', () => {
  it('reads each metric as the median of the runs', () => {
    const runs = [12, 300, 40, 55, 41].map((t, i) =>
      m({ gesture: 'drag', longestTaskMs: t, medianFrameMs: [16, 50, 17, 16, 33][i] }),
    );
    expect(medianOfRuns(runs)).toEqual(
      m({ gesture: 'drag', longestTaskMs: 41, medianFrameMs: 17 }),
    );
  });

  it('keeps a metric only the runs carry', () => {
    const runs = [3, 1, 2].map((w) => m({ gesture: 'idle', idleWorkMs: w }));
    expect(medianOfRuns(runs)).toEqual(m({ gesture: 'idle', idleWorkMs: 2 }));
  });

  it('refuses no runs, or runs of different rows', () => {
    expect(() => medianOfRuns([])).toThrow('NoRuns');
    expect(() => medianOfRuns([m({ gesture: 'pan' }), m({ gesture: 'zoom' })])).toThrow(
      'MixedRuns',
    );
  });
});
