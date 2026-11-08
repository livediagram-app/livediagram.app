import { describe, expect, it } from 'vitest';
import { CARD_RUN_MAX, RUN_SPREAD, cardRuns } from './card-runs';

// docs/specs/026-plan/plan-board.md "A busy board"; blueprint plan-board.md "Card runs".
const cards = (n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: `item-${from + i}` }));

describe('a busy cell drawn in runs', () => {
  it('keeps every card, in order, in runs of at most the cap', () => {
    const all = cards(2000);
    const runs = cardRuns(all);
    expect(runs.flat()).toEqual(all);
    expect(Math.max(...runs.map((r) => r.length))).toBeLessThanOrEqual(CARD_RUN_MAX);
    expect(runs.every((r) => r.length > 0)).toBe(true);
    // A few cards a run on average, so a long column is many runs.
    expect(all.length / runs.length).toBeGreaterThan(RUN_SPREAD / 2);
  });

  it('draws nothing for an empty cell', () => {
    expect(cardRuns([])).toEqual([]);
  });

  it('a card moved in changes only the run it lands in', () => {
    const all = cards(400);
    const before = cardRuns(all);
    const moved = [...all.slice(0, 200), { id: 'newcomer' }, ...all.slice(200)];
    const after = cardRuns(moved);
    const keys = (rs: { id: string }[][]) => rs.map((r) => r.map((c) => c.id).join(','));
    const kept = new Set(keys(before));
    const changed = keys(after).filter((k) => !kept.has(k));
    // The run it joins (or the two it splits into, when it starts one).
    expect(changed.length).toBeLessThanOrEqual(2);
  });

  it('a card taken out changes only the run it leaves', () => {
    const all = cards(400);
    const before = cardRuns(all).map((r) => r.map((c) => c.id).join(','));
    const after = cardRuns([...all.slice(0, 100), ...all.slice(101)]).map((r) =>
      r.map((c) => c.id).join(','),
    );
    const kept = new Set(before);
    expect(after.filter((k) => !kept.has(k)).length).toBeLessThanOrEqual(1);
  });
});
