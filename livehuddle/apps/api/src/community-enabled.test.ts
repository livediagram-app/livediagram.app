import { describe, expect, it } from 'vitest';
import { communityEnabled } from './community-enabled';

describe('communityEnabled', () => {
  it('is on unless explicitly switched off', () => {
    expect(communityEnabled({})).toBe(true);
    expect(communityEnabled({ COMMUNITY_ENABLED: '' })).toBe(true);
    expect(communityEnabled({ COMMUNITY_ENABLED: 'true' })).toBe(true);
    expect(communityEnabled({ COMMUNITY_ENABLED: 'yes' })).toBe(true);
    for (const off of ['false', 'FALSE', ' false ', '0', 'off', 'Off']) {
      expect(communityEnabled({ COMMUNITY_ENABLED: off }), off).toBe(false);
    }
  });
});
