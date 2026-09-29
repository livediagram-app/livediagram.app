// The account avatar's picture resolution (docs/specs/014-identity/profile-picture.md §2).

import { describe, expect, it } from 'vitest';
import {
  accountInitial,
  pictureHost,
  resolveProfilePicture,
  sizedPictureUrl,
  type ClerkPictureSource,
} from './account-avatar';

const GOOGLE = 'https://img.clerk.com/google-picture';
const UPLOADED = 'https://img.clerk.com/uploaded-picture';
const DEFAULT_AVATAR = 'https://img.clerk.com/default-avatar';
const SIZED = '?width=96&height=96&fit=crop';

const user = (over: Partial<ClerkPictureSource> = {}): ClerkPictureSource => ({
  hasImage: false,
  imageUrl: DEFAULT_AVATAR,
  externalAccounts: [],
  ...over,
});

describe('resolveProfilePicture', () => {
  it("prefers the Google account's picture", () => {
    const picture = resolveProfilePicture(
      user({
        hasImage: true,
        imageUrl: UPLOADED,
        externalAccounts: [
          { provider: 'github', imageUrl: 'https://img.clerk.com/github' },
          { provider: 'google', imageUrl: GOOGLE },
        ],
      }),
    );
    expect(picture).toBe(`${GOOGLE}${SIZED}`);
  });

  it('falls back to the Clerk profile image when it is a real picture', () => {
    expect(resolveProfilePicture(user({ hasImage: true, imageUrl: UPLOADED }))).toBe(
      `${UPLOADED}${SIZED}`,
    );
  });

  it("ignores Clerk's generated avatar when hasImage is false", () => {
    expect(resolveProfilePicture(user())).toBeNull();
  });

  it('skips a Google account without a picture', () => {
    const picture = resolveProfilePicture(
      user({
        hasImage: true,
        imageUrl: UPLOADED,
        externalAccounts: [{ provider: 'google', imageUrl: '' }],
      }),
    );
    expect(picture).toBe(`${UPLOADED}${SIZED}`);
  });

  it('skips a Google picture that is not https, then tries the profile image', () => {
    const picture = resolveProfilePicture(
      user({
        hasImage: true,
        imageUrl: UPLOADED,
        externalAccounts: [{ provider: 'google', imageUrl: 'http://img.clerk.com/x' }],
      }),
    );
    expect(picture).toBe(`${UPLOADED}${SIZED}`);
  });

  it('returns null when no source yields a usable URL', () => {
    expect(resolveProfilePicture(user({ hasImage: true, imageUrl: 'not a url' }))).toBeNull();
  });
});

describe('sizedPictureUrl', () => {
  it('rejects http and malformed URLs', () => {
    expect(sizedPictureUrl('http://img.clerk.com/a')).toBeNull();
    expect(sizedPictureUrl('javascript:alert(1)')).toBeNull();
    expect(sizedPictureUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(sizedPictureUrl('/relative.png')).toBeNull();
    expect(sizedPictureUrl('')).toBeNull();
  });

  it('sizes Clerk image URLs and leaves other hosts alone', () => {
    expect(sizedPictureUrl('https://img.clerk.com/abc?width=400&quality=90')).toBe(
      'https://img.clerk.com/abc?width=96&quality=90&height=96&fit=crop',
    );
    expect(sizedPictureUrl('https://lh3.googleusercontent.com/a/xyz=s96-c')).toBe(
      'https://lh3.googleusercontent.com/a/xyz=s96-c',
    );
  });
});

describe('accountInitial', () => {
  it("derives the initial from first name, username, then '?'", () => {
    expect(accountInitial({ firstName: 'webber', username: 'wt' })).toBe('W');
    expect(accountInitial({ firstName: null, username: 'tom' })).toBe('T');
    expect(accountInitial({ firstName: null, username: null })).toBe('?');
    expect(accountInitial(null)).toBe('?');
  });
});

describe('pictureHost', () => {
  it('names the host only, never the path', () => {
    expect(pictureHost('https://img.clerk.com/secret-id?width=96')).toBe('img.clerk.com');
    expect(pictureHost('nonsense')).toBe('invalid');
  });
});
