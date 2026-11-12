import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { blankQuotedAndComments } from './sql-blank';

describe('blankQuotedAndComments', () => {
  it('blanks quoted strings and comments, and keeps the rest', () => {
    expect(blankQuotedAndComments('SELECT \'a UNION b\', "x""y" FROM t')).toBe(
      'SELECT  ,   FROM t',
    );
    expect(blankQuotedAndComments("WHERE a = 'it''s' AND b LIKE ?")).toBe(
      'WHERE a =   AND b LIKE ?',
    );
    expect(blankQuotedAndComments('a -- LIKE ?\nb /* UNION */ c')).toBe('a  \nb   c');
    expect(blankQuotedAndComments('a - b / c * d')).toBe('a - b / c * d');
  });

  it('runs an unclosed quote or comment to the end', () => {
    expect(blankQuotedAndComments("a 'open")).toBe('a  ');
    expect(blankQuotedAndComments('a /* open')).toBe('a  ');
    expect(blankQuotedAndComments('a -- open')).toBe('a  ');
  });

  // CodeQL js/polynomial-redos (alert 241): the regex this replaced backtracked on '/*' and 'a/*' repeated. Four
  // times the input must stay under eight times the cost, and well inside a budget.
  it('stays linear on the inputs a backtracking pattern chokes on', () => {
    const worst = [
      (n: number) => `/*${'a/*'.repeat(n)}`,
      (n: number) => `'${"''".repeat(n)}`,
      (n: number) => `${'-'.repeat(n)}`,
    ];
    for (const make of worst) {
      const small = make(25_000);
      const large = make(100_000);
      blankQuotedAndComments(small);
      const a = cpuMsOf(() => blankQuotedAndComments(small));
      const b = cpuMsOf(() => blankQuotedAndComments(large));
      expect(b).toBeLessThan(Math.max(a, 1) * 8);
      expect(b).toBeLessThan(cpuBudgetMs(50));
    }
  });
});
