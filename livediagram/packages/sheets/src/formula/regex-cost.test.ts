import { describe, expect, it } from 'vitest';
import { REGEX_BACKTRACK_MAX } from '../limits';
import { regexShape, regexWork } from './regex-cost';

// docs/specs/029-sheets/formulas.md "Functions": Text. A pattern that could backtrack for minutes is refused before
// it runs; an everyday one is not.
const allowed = (pattern: string, text: number) =>
  regexWork(regexShape(pattern), text) <= REGEX_BACKTRACK_MAX;

describe('regexShape', () => {
  it('counts open-ended repeats and how deep repeats nest', () => {
    expect(regexShape('abc')).toEqual({ repeats: 0, height: 1 });
    expect(regexShape('a+b*')).toEqual({ repeats: 2, height: 1 });
    expect(regexShape('(a+)+')).toEqual({ repeats: 2, height: 2 });
    expect(regexShape('((a+)+)+')).toEqual({ repeats: 3, height: 3 });
    expect(regexShape('(a|ab)*')).toEqual({ repeats: 1, height: 2 });
    expect(regexShape('(\\w+\\s?)+')).toEqual({ repeats: 2, height: 2 });
  });

  it('reads a fixed count, an optional group and a group prefix as no nesting', () => {
    expect(regexShape('(\\d{3}-)+').height).toBe(1);
    expect(regexShape('(a+)?').height).toBe(1);
    expect(regexShape('(?:ab)+').height).toBe(1);
    expect(regexShape('(?<year>\\d{4})-(?=\\d)').height).toBe(1);
    expect(regexShape('[(+*]+').height).toBe(1);
    expect(regexShape('\\(a+\\)+')).toEqual({ repeats: 2, height: 1 });
  });
});

describe('regexWork against the budget', () => {
  it('lets everyday patterns run on long text', () => {
    expect(allowed('^\\d{3}-\\d{4}$', 10_000)).toBe(true);
    expect(allowed('(\\w+)@(\\w+)\\.com', 10_000)).toBe(true);
    expect(allowed('(\\d{3}-)+', 5_000)).toBe(true);
    expect(allowed('.*a.*a.*a.*a.*a.*b', 40)).toBe(true);
  });

  it('refuses a pattern that could backtrack for seconds', () => {
    expect(allowed('(a+)+$', 40)).toBe(false);
    expect(allowed('((a+)+)+$', 18)).toBe(false);
    expect(allowed('(\\w+\\s?)+$', 60)).toBe(false);
    expect(allowed('(\\d+)-(\\d+)-(\\d+)', 10_000)).toBe(false);
    expect(allowed('.*a.*a.*a.*a.*a.*b', 80)).toBe(false);
  });
});
