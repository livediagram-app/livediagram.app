// The profile picture's resolution and URL transform (docs/specs/014-identity/profile-picture.md §1,
// §2).

import { describe, expect, it } from 'vitest';
import {
  accountInitial,
  clerkImageSource,
  resolveProfilePicture,
  type ClerkPictureSource,
} from './account-avatar';

// Clerk image URLs name their source in a base64url JSON path segment (spec §1).
const clerkUrl = (source: object): string =>
  `https://img.clerk.com/${btoa(JSON.stringify(source)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;

const UPLOADED = clerkUrl({ type: 'proxy', src: 'https://images.clerk.dev/uploaded/img_abc' });
const COPIED = clerkUrl({ type: 'proxy', src: 'https://images.clerk.dev/oauth_google/img_def' });
const GOOGLE = clerkUrl({
  type: 'proxy',
  src: 'https://lh3.googleusercontent.com/a/ACg8oc=s1000-c',
  s: 'sig',
});
const DEFAULT_AVATAR = clerkUrl({ type: 'default', iid: 'ins_1', rid: 'user_1', initials: 'W' });

const user = (over: Partial<ClerkPictureSource> = {}): ClerkPictureSource => ({
  hasImage: false,
  imageUrl: DEFAULT_AVATAR,
  externalAccounts: [],
  ...over,
});

describe('clerkImageSource', () => {
  it('reads the source Clerk encodes in the URL', () => {
    expect(clerkImageSource(UPLOADED)).toBe('upload');
    expect(clerkImageSource(COPIED)).toBe('oauth');
    expect(clerkImageSource(DEFAULT_AVATAR)).toBe('default');
    expect(clerkImageSource(GOOGLE)).toBe('other');
  });

  it('never calls anything it cannot read an upload', () => {
    expect(clerkImageSource('https://img.clerk.com/not-base64-json')).toBe('unknown');
    expect(clerkImageSource('https://evil.example/eyJ0eXBlIjoicHJveHkifQ')).toBe('unknown');
    expect(clerkImageSource('nonsense')).toBe('unknown');
    const lookalike = clerkUrl({ type: 'proxy', src: 'https://images.clerk.dev.evil/uploaded/x' });
    expect(clerkImageSource(lookalike)).toBe('other');
  });
});

describe('resolveProfilePicture', () => {
  const google = [{ provider: 'google', imageUrl: GOOGLE }];

  it('puts a picture the person uploaded over the Google one', () => {
    expect(
      resolveProfilePicture(user({ hasImage: true, imageUrl: UPLOADED, externalAccounts: google })),
    ).toBe(UPLOADED);
  });

  it("prefers the Google account's picture over Clerk's copy of it", () => {
    expect(
      resolveProfilePicture(user({ hasImage: true, imageUrl: COPIED, externalAccounts: google })),
    ).toBe(GOOGLE);
  });

  it("falls back to Clerk's copy with no Google account", () => {
    expect(resolveProfilePicture(user({ hasImage: true, imageUrl: COPIED }))).toBe(COPIED);
  });

  it("never shows Clerk's generated avatar", () => {
    expect(resolveProfilePicture(user())).toBeNull();
    expect(resolveProfilePicture(user({ hasImage: false, imageUrl: UPLOADED }))).toBeNull();
  });

  it('skips a Google account without a usable picture', () => {
    expect(
      resolveProfilePicture(
        user({
          hasImage: true,
          imageUrl: COPIED,
          externalAccounts: [
            { provider: 'google', imageUrl: '' },
            { provider: 'google', imageUrl: 'https://lh3.googleusercontent.com/a/x=s96-c' },
          ],
        }),
      ),
    ).toBe(COPIED);
  });

  it("accepts only https URLs on Clerk's image host", () => {
    expect(
      resolveProfilePicture(user({ hasImage: true, imageUrl: 'http://img.clerk.com/x' })),
    ).toBeNull();
    expect(
      resolveProfilePicture(user({ hasImage: true, imageUrl: 'https://evil.example/x' })),
    ).toBeNull();
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
