import { describe, expect, it } from 'vitest';
import { LINT_CODES, LINT_SEVERITY } from './lint';

describe('lint wire types', () => {
  it("fixes each code's severity as the spec's table does", () => {
    expect(LINT_CODES.map((code) => [code, LINT_SEVERITY[code]])).toEqual([
      ['label-overflow', 'warning'],
      ['text-overflow', 'warning'],
    ]);
  });
});
