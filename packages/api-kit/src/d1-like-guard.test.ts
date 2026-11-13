import { describe, expect, it } from 'vitest';
import { assertD1LikePatterns, D1_LIKE_PATTERN_MAX } from './d1-like-guard';

const TOO_COMPLEX = 'D1_ERROR: LIKE or GLOB pattern too complex: SQLITE_ERROR';
const of = (n: number) => `%${'a'.repeat(n - 2)}%`;

describe('assertD1LikePatterns', () => {
  it('takes a pattern of up to 50 bytes and refuses a longer one, as production does', () => {
    expect(D1_LIKE_PATTERN_MAX).toBe(50);
    expect(() => assertD1LikePatterns('SELECT 1 WHERE x LIKE ?', [of(50)])).not.toThrow();
    expect(() => assertD1LikePatterns('SELECT 1 WHERE x LIKE ?', [of(51)])).toThrow(TOO_COMPLEX);
    expect(() => assertD1LikePatterns('SELECT 1 WHERE x GLOB ?', [of(51)])).toThrow(TOO_COMPLEX);
  });

  it('counts bytes, not characters', () => {
    expect(() => assertD1LikePatterns('SELECT 1 WHERE x LIKE ?', [`%${'é'.repeat(25)}%`])).toThrow(
      TOO_COMPLEX,
    );
  });

  it('finds the pattern among positional and numbered parameters', () => {
    const q = "SELECT 1 WHERE a = ? AND b LIKE ? ESCAPE '\\' AND c = ?";
    expect(() => assertD1LikePatterns(q, [of(60), of(10), of(60)])).not.toThrow();
    expect(() => assertD1LikePatterns(q, ['a', of(51), 'c'])).toThrow(TOO_COMPLEX);
    const numbered = 'SELECT 1 WHERE a = ?1 AND (b LIKE ?3 OR c LIKE ?2)';
    expect(() => assertD1LikePatterns(numbered, [of(60), of(10), of(10)])).not.toThrow();
    expect(() => assertD1LikePatterns(numbered, ['a', of(51), 'b'])).toThrow(TOO_COMPLEX);
  });

  it('ignores what sits in quotes and comments, values that are not text, and instr', () => {
    expect(() =>
      assertD1LikePatterns("SELECT 'x LIKE ?' AS t, ? -- LIKE ?\nWHERE y LIKE ?", [of(60), 'ok']),
    ).not.toThrow();
    expect(() => assertD1LikePatterns('SELECT 1 WHERE x LIKE ?', [null])).not.toThrow();
    expect(() => assertD1LikePatterns('SELECT 1 WHERE instr(x, ?) > 0', [of(500)])).not.toThrow();
  });
});
