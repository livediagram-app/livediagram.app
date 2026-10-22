import { describe, expect, it } from 'vitest';
import { PROJECT_FORMAT, PROJECT_FORMAT_HEADER, parseProjectFormat } from './project-format';

// docs/specs/016-platform/new-version-prompt.md "The project format number".
describe('the project format number', () => {
  it('is 2, packed stroke points, carried in one header', () => {
    expect(PROJECT_FORMAT).toBe(2);
    expect(PROJECT_FORMAT_HEADER).toBe('X-Liveplanner-Format');
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
    expect(parseProjectFormat(value)).toBe(expected);
  });
});
