import { describe, expect, it } from 'vitest';
import {
  isProfilePictureUrl,
  MAX_PICTURE_URL_LEN,
  PROFILE_PICTURE_ORIGIN,
  profilePictureOf,
  sizedPictureUrl,
} from './picture';

const GOOGLE = 'https://lh3.googleusercontent.com/a/ACg8ocJ1abcDEF_ghi-jkl=s96-c';

describe('isProfilePictureUrl', () => {
  it("takes Google's picture URLs", () => {
    expect(isProfilePictureUrl(GOOGLE)).toBe(true);
    expect(isProfilePictureUrl('https://lh3.googleusercontent.com/a/abc')).toBe(true);
    expect(PROFILE_PICTURE_ORIGIN).toBe('https://lh3.googleusercontent.com');
  });

  it('refuses anything else', () => {
    for (const bad of [
      null,
      undefined,
      42,
      '',
      'http://lh3.googleusercontent.com/a/abc',
      'https://lh3.googleusercontent.com.evil.example/a/abc',
      'https://evil.example/lh3.googleusercontent.com',
      'https://user:pw@lh3.googleusercontent.com/a/abc',
      'https://lh3.googleusercontent.com:8443/a/abc',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      'not a url',
      `https://lh3.googleusercontent.com/a/${'x'.repeat(MAX_PICTURE_URL_LEN)}`,
    ]) {
      expect(isProfilePictureUrl(bad), String(bad)).toBe(false);
    }
    expect(profilePictureOf('https://evil.example/a.png')).toBeNull();
    expect(profilePictureOf(GOOGLE)).toBe(GOOGLE);
  });
});

describe('sizedPictureUrl', () => {
  it('replaces the size Google was asked for', () => {
    expect(sizedPictureUrl(GOOGLE, 40)).toBe(
      'https://lh3.googleusercontent.com/a/ACg8ocJ1abcDEF_ghi-jkl=s40-c',
    );
    expect(sizedPictureUrl('https://lh3.googleusercontent.com/a/abc', 96)).toBe(
      'https://lh3.googleusercontent.com/a/abc=s96-c',
    );
  });

  it('falls back to the default size when the size is no number', () => {
    for (const px of [Number.NaN, Infinity, -Infinity, '40' as unknown as number]) {
      expect(sizedPictureUrl(GOOGLE, px)).toBe(
        'https://lh3.googleusercontent.com/a/ACg8ocJ1abcDEF_ghi-jkl=s96-c',
      );
    }
  });

  it('keeps the size in bounds and leaves other shapes alone', () => {
    expect(sizedPictureUrl(GOOGLE, 2)).toMatch(/=s16-c$/);
    expect(sizedPictureUrl(GOOGLE, 5000)).toMatch(/=s1024-c$/);
    expect(sizedPictureUrl('https://lh3.googleusercontent.com/a/abc?x=1', 40)).toBe(
      'https://lh3.googleusercontent.com/a/abc?x=1',
    );
  });
});
