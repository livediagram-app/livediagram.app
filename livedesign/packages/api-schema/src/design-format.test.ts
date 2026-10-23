import { describe, expect, it } from 'vitest';
import { DESIGN_FORMAT, DESIGN_FORMAT_HEADER, parseDesignFormat } from './design-format';

// docs/specs/016-platform/new-version-prompt.md "The design format number".
describe('the design format number', () => {
  it('is 2, packed stroke points, carried in one header', () => {
    expect(DESIGN_FORMAT).toBe(2);
    expect(DESIGN_FORMAT_HEADER).toBe('X-Livedesign-Format');
  });

  it.each([
    [2, 2],
    ['3', 3],
    [' 4 ', null],
    [0, null],
    [-1, null],
    [1.5, null],
    ['2a', null],
    ['', null],
    [null, null],
    [undefined, null],
    [Number.MAX_SAFE_INTEGER + 1, null],
    [{}, null],
  ])('parses %j as %j', (value, expected) => {
    expect(parseDesignFormat(value)).toBe(expected);
  });
});
