// The profile picture URL contract (docs/specs/014-identity/profile-picture.md §2, §6): what the
// api and the room accept, and what the editor draws.

import { describe, expect, it } from 'vitest';
import { isProfilePictureUrl, MAX_PICTURE_URL_LEN, PROFILE_PICTURE_HOST } from './profile-picture';

describe('isProfilePictureUrl', () => {
  it("accepts an https URL on Clerk's image host", () => {
    expect(PROFILE_PICTURE_HOST).toBe('img.clerk.com');
    expect(isProfilePictureUrl('https://img.clerk.com/eyJ0eXBlIjoicHJveHkifQ?width=96')).toBe(true);
  });

  it('rejects other hosts, other schemes, look-alike hosts and non-strings', () => {
    for (const bad of [
      'http://img.clerk.com/x',
      'https://evil.example/x',
      'https://img.clerk.com.evil.example/x',
      'https://user@evil.example/img.clerk.com',
      'javascript:alert(1)',
      '',
      null,
      undefined,
      42,
      { url: 'https://img.clerk.com/x' },
    ]) {
      expect(isProfilePictureUrl(bad)).toBe(false);
    }
  });

  it('rejects a URL over the length cap', () => {
    const long = `https://img.clerk.com/${'a'.repeat(MAX_PICTURE_URL_LEN)}`;
    expect(isProfilePictureUrl(long)).toBe(false);
    expect(isProfilePictureUrl(long.slice(0, MAX_PICTURE_URL_LEN))).toBe(true);
  });

  it('rejects credentials and non-default ports', () => {
    expect(isProfilePictureUrl('https://a:b@img.clerk.com/x')).toBe(false);
    expect(isProfilePictureUrl('https://img.clerk.com:8443/x')).toBe(false);
  });
});
