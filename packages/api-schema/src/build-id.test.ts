import { describe, expect, it } from 'vitest';
import { BUILD_ID_HEADER, parseBuildId } from './build-id';

// docs/specs/016-platform/stale-builds.md "Knowing which build is live".
describe('the build id', () => {
  it('rides the X-Livediagram-Build header', () => {
    expect(BUILD_ID_HEADER).toBe('X-Livediagram-Build');
  });

  it.each([
    ['14f19e191a2b3c4d5e6f708192a3b4c5d6e7f809', '14f19e191a2b3c4d5e6f708192a3b4c5d6e7f809'],
    ['v1.2.3_rc-1', 'v1.2.3_rc-1'],
    ['a'.repeat(64), 'a'.repeat(64)],
    ['a'.repeat(65), null],
    ['', null],
    ['has space', null],
    ['semi;colon', null],
    [42, null],
    [null, null],
    [undefined, null],
  ])('parses %j as %j', (value, expected) => {
    expect(parseBuildId(value)).toBe(expected);
  });
});
