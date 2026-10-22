import { describe, expect, it } from 'vitest';
import { withMax, withMin } from './question-range';

describe('a question range', () => {
  it('clears the other end when the one just set would cross it', () => {
    expect(withMin({ max: 5 }, 8)).toEqual({ min: 8, max: undefined });
    expect(withMin({ max: 5 }, 5)).toEqual({ min: 5 });
    expect(withMax({ min: 3 }, 2)).toEqual({ max: 2, min: undefined });
    expect(withMax({ min: 3 }, 3)).toEqual({ max: 3 });
    expect(withMin({}, undefined)).toEqual({ min: undefined });
    expect(withMax({ min: 3 }, undefined)).toEqual({ max: undefined });
  });
});
