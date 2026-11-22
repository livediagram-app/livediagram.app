import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { DEFAULT_FIND_OPTIONS, findInText, isWordUnit } from './find-text';

// docs/specs/007-editor/find-and-replace.md "Matching".
const any = DEFAULT_FIND_OPTIONS;
const exact = { matchCase: true, wholeWord: false };
const word = { matchCase: false, wholeWord: true };

describe('findInText', () => {
  it('finds every place, any case by default', () => {
    expect(findInText('Plan the plan, PLAN!', 'plan', any)).toEqual([0, 9, 15]);
  });

  it('matches case exactly with Match Case', () => {
    expect(findInText('Plan the plan, PLAN!', 'plan', exact)).toEqual([9]);
  });

  it('keeps to whole words with Whole Word', () => {
    expect(findInText('plan planner replan plan_b plan.', 'plan', word)).toEqual([0, 27]);
    // A word is letters, marks, digits and underscores in any script.
    expect(findInText('café cafés', 'café', word)).toEqual([0]);
  });

  it('never overlaps: the next match starts past the last', () => {
    expect(findInText('aaaa', 'aa', any)).toEqual([0, 2]);
    expect(findInText('abababa', 'aba', any)).toEqual([0, 4]);
  });

  it('carries on past a start Whole Word turned down', () => {
    // "aab" is not a word at 0 (it runs into "aab"), but the scan goes on to find it later.
    expect(findInText('aaab aab', 'aab', word)).toEqual([5]);
  });

  it('treats every character as itself, never as a pattern', () => {
    expect(findInText('a.b a*b (x) [y]', '.', any)).toEqual([1]);
    expect(findInText('a.b a*b (x) [y]', '(x)', any)).toEqual([8]);
    expect(findInText('price $5.00', '$5.00', any)).toEqual([6]);
  });

  it('stops at the limit and finds nothing for an empty or longer query', () => {
    expect(findInText('a a a a', 'a', any, 2)).toEqual([0, 2]);
    expect(findInText('abc', '', any)).toEqual([]);
    expect(findInText('ab', 'abc', any)).toEqual([]);
    expect(findInText('abc', 'a', any, 0)).toEqual([]);
  });

  it('folds letters outside ASCII and keeps offsets one to one', () => {
    expect(findInText('Ärger und ärger', 'ÄRGER', any)).toEqual([0, 10]);
    // A capital whose lower case is two units matches only as typed: offsets never drift.
    expect(findInText('İstanbul', 'İ', any)).toEqual([0]);
  });

  it('reads a word unit by one character', () => {
    expect(isWordUnit('a')).toBe(true);
    expect(isWordUnit('_')).toBe(true);
    expect(isWordUnit('7')).toBe(true);
    expect(isWordUnit(' ')).toBe(false);
    expect(isWordUnit(undefined)).toBe(false);
  });

  // The scan is linear whatever is typed: the classic worst case for a naive or a backtracking search (a long run
  // of one letter, searched for a run of it ending in another) stays well inside one frame.
  it('stays linear on a worst-case input', () => {
    const text = 'a'.repeat(200_000);
    const query = `${'a'.repeat(499)}b`;
    let found: number[] = [0];
    expect(cpuMsOf(() => (found = findInText(text, query, any)))).toBeLessThan(cpuBudgetMs(60));
    expect(found).toEqual([]);
    // Whole Word turning down every start (each run of 400 is inside the long word) is linear too.
    expect(cpuMsOf(() => (found = findInText(text, 'a'.repeat(400), word)))).toBeLessThan(
      cpuBudgetMs(60),
    );
    expect(found).toEqual([]);
  });
});
