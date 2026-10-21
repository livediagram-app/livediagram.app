import { describe, expect, it } from 'vitest';
import { parseRules, showRule, type Rule } from './junk-rule';

describe('showRule', () => {
  it('writes a rule as its thresholds joined by AND', () => {
    const rule: Rule = [
      { f: 'edge1', lt: true, t: 0.02 },
      { f: 'valIn', lt: false, t: 0.45 },
    ];
    expect(showRule(rule)).toBe('edge1 < 0.020 AND valIn > 0.450');
  });
});

describe('parseRules', () => {
  it('reads back the rules the learner prints, joined by OR', () => {
    expect(
      parseRules('edge1 < 0.020 AND valIn > 0.450 OR rough > 1.5', ['edge1', 'valIn', 'rough']),
    ).toEqual([
      [
        { f: 'edge1', lt: true, t: 0.02 },
        { f: 'valIn', lt: false, t: 0.45 },
      ],
      [{ f: 'rough', lt: false, t: 1.5 }],
    ]);
  });

  it('reads negative and exponent thresholds, with or without spaces', () => {
    expect(parseRules('dH<-0.5 AND area>1e-3', ['dH', 'area'])).toEqual([
      [
        { f: 'dH', lt: true, t: -0.5 },
        { f: 'area', lt: false, t: 0.001 },
      ],
    ]);
  });

  it('refuses a condition that is not a feature, a < or > and a number', () => {
    expect(() => parseRules('edge1 <= 0.02', ['edge1'])).toThrow(/edge1 <= 0.02/);
    expect(() => parseRules('f.edge1 < 0.02', ['edge1'])).toThrow(/f\.edge1 < 0\.02/);
    expect(() => parseRules('edge1 < abc', ['edge1'])).toThrow(/edge1 < abc/);
    expect(() => parseRules('', ['edge1'])).toThrow();
  });

  it('refuses a feature the rows do not have, rather than let it never fire', () => {
    expect(() => parseRules('edgeOne < 0.02', ['edge1', 'valIn'])).toThrow(/edgeOne/);
  });
});
