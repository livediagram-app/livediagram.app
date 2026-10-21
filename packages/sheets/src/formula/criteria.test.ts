import { describe, expect, it } from 'vitest';
import { makeCriterion } from './criteria';

describe('criteria', () => {
  it.each([
    [5, 5, true],
    [5, '5', false],
    [true, true, true],
    [true, 1, false],
    ['5', 5, true],
    ['>3', 5, true],
    ['>3', 'x', false],
    ['>=5', 5, true],
    ['<5', 5, false],
    ['<=5', 5, true],
    ['<>5', 4, true],
    ['<>5', 5, false],
    ['done', 'Done', true],
    ['do*', 'Done', true],
    ['d?ne', 'Done', true],
    ['~*', '*', true],
    ['~*', 'a', false],
    ['a~~', 'a~', true],
    ['', null, true],
    ['', '', true],
    ['', 'x', false],
    ['<>', 'x', true],
    ['<>', null, false],
    ['=TRUE', true, true],
    ['>b', 'c', true],
    [null, null, true],
    [null, 0, false],
    [{ e: '#N/A' }, { e: '#N/A' }, true],
    [{ e: '#N/A' }, 1, false],
    ['>3', null, false],
    ['>3', { e: '#N/A' }, false],
    [5, null, false],
    ['5', null, false],
    ['*', '', true],
    ['?', '', false],
    ['a*b*c', 'AxxBxxC', true],
    ['a*b*c', 'abcx', false],
    ['*ab', 'aab', true],
    ['*a?', 'ba', false],
    ['*~?', 'why?', true],
    ['*~?', 'why', false],
    ['<>*x*', 'abc', true],
    ['İ*', 'İstanbul', true],
  ])('%j matches %j: %s', (crit, v, ok) => {
    expect(makeCriterion(crit as never)(v as never)).toBe(ok);
  });

  it('matches a pattern of many wildcards in time proportional to the text', () => {
    const many = makeCriterion('*a*a*a*a*a*a*a*b');
    const text = 'a'.repeat(2_000);
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) expect(many(text)).toBe(false);
    expect(performance.now() - t0).toBeLessThan(2_000);
  });
});
