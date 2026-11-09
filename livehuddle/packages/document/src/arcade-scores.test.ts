import { describe, expect, it } from 'vitest';
import {
  ARCADE_NAME_MAX,
  ARCADE_RUN_MS_MAX,
  ARCADE_SCORES_MAX,
  arcadeName,
  arcadePlaceOf,
  arcadeScoreCeiling,
  arcadeTableWith,
  compareArcadeScores,
  isArcadeScore,
  isArcadeScores,
  type ArcadeScore,
} from './arcade-scores';
import { isValidElement } from './validate';

// docs/specs/009-elements/social-pieces.md "High Scores".

const score = (
  id: string,
  points: number,
  at = 1,
  over: Partial<ArcadeScore> = {},
): ArcadeScore => ({
  id,
  name: 'Ann',
  score: points,
  ms: 60_000,
  by: 'adder-a',
  at,
  ...over,
});

describe('a score', () => {
  it('takes a whole score from 1 to its run ceiling', () => {
    expect(isArcadeScore(score('a', 1))).toBe(true);
    expect(isArcadeScore(score('a', arcadeScoreCeiling(60_000)))).toBe(true);
    expect(isArcadeScore(score('a', arcadeScoreCeiling(60_000) + 1))).toBe(false);
    expect(isArcadeScore(score('a', 0))).toBe(false);
    expect(isArcadeScore(score('a', 10.5))).toBe(false);
  });
  it('holds the run, name, id, signer and time to their bounds', () => {
    expect(isArcadeScore(score('a', 10, 1, { ms: 0 }))).toBe(false);
    expect(isArcadeScore(score('a', 10, 1, { ms: 1.5 }))).toBe(false);
    expect(isArcadeScore(score('a', 10, 1, { ms: ARCADE_RUN_MS_MAX }))).toBe(true);
    expect(isArcadeScore(score('a', 10, 1, { ms: ARCADE_RUN_MS_MAX + 1 }))).toBe(false);
    expect(isArcadeScore(score('a', 10, 1, { name: 'x'.repeat(ARCADE_NAME_MAX) }))).toBe(true);
    expect(isArcadeScore(score('a', 10, 1, { name: 'x'.repeat(ARCADE_NAME_MAX + 1) }))).toBe(false);
    expect(isArcadeScore(score('a', 10, 1, { name: '   ' }))).toBe(false);
    expect(isArcadeScore(score('a', 10, 1, { name: '' }))).toBe(false);
    expect(isArcadeScore(score('', 10))).toBe(false);
    expect(isArcadeScore(score('x'.repeat(65), 10))).toBe(false);
    expect(isArcadeScore(score('a', 10, 1, { by: '' }))).toBe(false);
    expect(isArcadeScore(score('a', 10, 1, { by: 'b'.repeat(129) }))).toBe(false);
    expect(isArcadeScore(score('a', 10, Number.NaN))).toBe(false);
    // A time the table can show as a day: past Date's range, formatting it throws for everyone opening the machine.
    expect(isArcadeScore(score('a', 10, 8.64e15))).toBe(true);
    expect(isArcadeScore(score('a', 10, 1e16))).toBe(false);
    expect(isArcadeScore(score('a', 10, -1))).toBe(false);
    expect(isArcadeScore(score('a', 10, 1.5))).toBe(false);
    expect(isArcadeScore(null)).toBe(false);
    expect(isArcadeScore('a')).toBe(false);
  });
  it('is bounded by the letters a run could collect, each at ×5', () => {
    expect(arcadeScoreCeiling(1)).toBe(150);
    expect(arcadeScoreCeiling(899)).toBe(150);
    expect(arcadeScoreCeiling(900)).toBe(200);
    expect(arcadeScoreCeiling(ARCADE_RUN_MS_MAX)).toBe((3 + 8_000) * 50);
  });
  it('is posted under the display name, cut, or Guest', () => {
    expect(arcadeName('  Ann  ')).toBe('Ann');
    expect(arcadeName('x'.repeat(40))).toHaveLength(ARCADE_NAME_MAX);
    // Never between an emoji's two halves, which would post a lone surrogate.
    const atEdge = arcadeName('x'.repeat(ARCADE_NAME_MAX - 1) + '\u{1F600}');
    expect(atEdge).toBe('x'.repeat(ARCADE_NAME_MAX - 1));
    expect(arcadeName('')).toBe('Guest');
    expect(arcadeName(undefined)).toBe('Guest');
  });
});

describe('the table', () => {
  const full = Array.from({ length: ARCADE_SCORES_MAX }, (_, i) => score(`s${i}`, 100 - i * 5));
  it('is at most ten valid scores with unique ids', () => {
    expect(isArcadeScores(full)).toBe(true);
    expect(isArcadeScores([...full, score('x', 1)])).toBe(false);
    expect(isArcadeScores([score('a', 1), score('a', 2)])).toBe(false);
    expect(isArcadeScores([score('a', 0)])).toBe(false);
    expect(isArcadeScores('scores')).toBe(false);
  });
  it('orders by score, then the earlier, then the id', () => {
    const rows = [score('b', 10, 5), score('a', 10, 5), score('c', 10, 2), score('d', 20, 9)];
    expect(rows.sort(compareArcadeScores).map((s) => s.id)).toEqual(['d', 'c', 'a', 'b']);
    expect(compareArcadeScores(score('a', 1), score('a', 1))).toBe(0);
    expect(compareArcadeScores(score('b', 1), score('a', 1))).toBe(1);
    expect(compareArcadeScores(score('a', 1), score('b', 1))).toBe(-1);
  });
  it('says where a score would land, or that it would not', () => {
    expect(arcadePlaceOf(undefined, score('x', 1))).toBe(1);
    expect(arcadePlaceOf(full, score('x', 101))).toBe(1);
    expect(arcadePlaceOf(full, score('x', 80, 0))).toBe(5);
    // A tie keeps the earlier above.
    expect(arcadePlaceOf(full, score('x', 80, 2))).toBe(6);
    expect(arcadePlaceOf(full, score('x', 50, 0))).toBe(null);
  });
  it('takes a score in its place and cuts to ten', () => {
    const next = arcadeTableWith(full, score('x', 82))!;
    expect(next).toHaveLength(ARCADE_SCORES_MAX);
    expect(next.map((s) => s.id).slice(3, 6)).toEqual(['s3', 'x', 's4']);
    expect(next.some((s) => s.id === 's9')).toBe(false);
    expect(arcadeTableWith(undefined, score('x', 5))).toEqual([score('x', 5)]);
  });
  it('changes nothing for a replay, a score that misses, or a bad one', () => {
    expect(arcadeTableWith(full, score('s0', 999))).toBe(null);
    expect(arcadeTableWith(full, score('x', 1))).toBe(null);
    expect(arcadeTableWith(full, { id: 'x' })).toBe(null);
  });
  it('keeps only the fields a score has, so nothing the wire lacks is stored on the machine', () => {
    const padded = { ...score('x', 5), pad: 'x'.repeat(100_000) };
    expect(arcadeTableWith(undefined, padded)).toEqual([score('x', 5)]);
  });
  it('is checked on a stored element', () => {
    const machine = (arcadeScores: unknown) => ({
      id: 'm',
      type: 'shape',
      shape: 'arcade-machine',
      x: 0,
      y: 0,
      width: 64,
      height: 112,
      arcadeScores,
    });
    expect(isValidElement(machine(full))).toBe(true);
    expect(isValidElement(machine([score('a', 0)]))).toBe(false);
  });
});
