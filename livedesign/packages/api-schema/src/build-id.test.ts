import { describe, expect, it } from 'vitest';
import { BUILD_ID_HEADER } from './build-id';

// docs/specs/016-platform/stale-builds.md "Knowing which build is live". The token's parsing is tested in
// @liveworkspace/api-schema.
describe('the build id', () => {
  it('rides the X-Livedesign-Build header', () => {
    expect(BUILD_ID_HEADER).toBe('X-Livedesign-Build');
  });
});
