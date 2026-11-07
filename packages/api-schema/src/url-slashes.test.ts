import { describe, expect, it } from 'vitest';
import { withoutEdgeSlashes, withoutTrailingSlashes } from './url-slashes';

describe('withoutTrailingSlashes', () => {
  it.each([
    ['https://www.liveworkspace.app', 'https://www.liveworkspace.app'],
    ['https://www.liveworkspace.app/', 'https://www.liveworkspace.app'],
    ['https://a.b/api///', 'https://a.b/api'],
    ['/explorer/', '/explorer'],
    ['/', ''],
    ['///', ''],
    ['', ''],
    ['a//b', 'a//b'],
  ])('%j → %j', (input, expected) => {
    expect(withoutTrailingSlashes(input)).toBe(expected);
    expect(withoutTrailingSlashes(input)).toBe(input.replace(/\/+$/, ''));
  });

  it('stays linear on a long run of slashes that is not at the end', () => {
    const worst = `${'/'.repeat(200_000)}x`;
    // No timer: vitest's test timeout is the budget. `/\/+$/` takes minutes at this length, the scan a millisecond.
    expect(withoutTrailingSlashes(worst)).toBe(worst);
    expect(withoutEdgeSlashes(worst)).toBe('x');
  });
});

describe('withoutEdgeSlashes', () => {
  it.each([
    ['', ''],
    ['/', ''],
    ['//a/b//', 'a/b'],
    ['a/b', 'a/b'],
    ['/teams', 'teams'],
  ])('%j → %j', (input, expected) => {
    expect(withoutEdgeSlashes(input)).toBe(expected);
    expect(withoutEdgeSlashes(input)).toBe(input.replace(/^\/+|\/+$/g, ''));
  });
});
